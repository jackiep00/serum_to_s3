import cron from 'node-cron';
import { MARKETS } from '@project-serum/serum';
import { MarketMeta } from './types';
import { Connection } from '@solana/web3.js';
import {
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  BATCH_FILENAME_TEMPLATE,
  FOLDER,
  REGION,
  BUCKET,
  SOLANA_RPC_URL,
} from './config';
import { logger } from './utils';
import { Scraper } from './scraper';
import { S3Uploader } from './uploader';

const SECONDS_BETWEEN_RUNS = 30;

export const orchestrator = async function () {
  logger.info('Starting app');
  const connection = new Connection(SOLANA_RPC_URL);
  const activeMarkets: MarketMeta[] = MARKETS.filter((market) => !market.deprecated);
  const uploader: S3Uploader = new S3Uploader(
    BATCH_FILENAME_TEMPLATE,
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    REGION,
    BUCKET,
    FOLDER,
    'private',
    250,
  );
  const scrapers: Scraper[] = activeMarkets.map((market) => new Scraper(market, uploader));

  // we need to use a cron lock concept because the scrapers are stateful anyway
  let cronLocked = false;
  cron.schedule(`*/${SECONDS_BETWEEN_RUNS} * * * * *`, async () => {
    if (!cronLocked) {
      cronLocked = true;
      try {
        logger.info('Starting conditional upload');
        await uploader.batchUploadtoS3();
        logger.info('Starting scrapers');
        // use await to ensure that we're not uploading a file that's being written to
        await Promise.all(
          scrapers.map((scraper) => scraper.getParseSaveEventsAsync(connection)),
        );
        logger.info('Scraping complete');
      } catch (err) {
        logger.info(err);
      } finally {
        cronLocked = false;
      }
    } else {
      logger.info('Cron blocked');
    }
  });
};
