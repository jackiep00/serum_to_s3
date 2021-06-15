import cron from 'node-cron';
import { MARKETS } from '@project-serum/serum';
import { MarketMeta } from './types';
import { Connection } from '@solana/web3.js';
import { SOLANA_RPC_URL } from './config';
import { logger } from './utils';
import { Scraper } from './scraper';

const WAIT_TIME = 0;
const NUM_PULLS_IN_BATCH = 75;
const SECONDS_BETWEEN_RUNS = 3;
const activeMarkets: MarketMeta[] = MARKETS.filter((item) => !item['deprecated']);

export const orchestrator = async function () {
  logger.info('Starting app');
  const connection = new Connection(SOLANA_RPC_URL);
  const activeMarkets: MarketMeta[] = MARKETS.filter((market) => !market['deprecated']);

  // TODO: generate a target filename and make it accessible

  cron.schedule(`*/3 * * * *`, async () => {
    logger.info('Starting run');
    const scrapers: Scraper[] = activeMarkets.map((market) => new Scraper(market));
    await Promise.all(scrapers.map((scraper) => scraper.getParseSaveEventsAsync(connection)));
    logger.info('Batch run complete');
  });
};

// await new Promise((resolve) => setTimeout(resolve, waitTime));
