import cron from 'node-cron';
import { MARKETS } from '@project-serum/serum';
import { MarketMeta } from './types';
import { Connection } from '@solana/web3.js';
import { SOLANA_RPC_URL } from './config';
import { logger } from './utils';
import { Scraper } from './scraper';

const SECONDS_BETWEEN_RUNS = 3;

export const orchestrator = async function () {
  logger.info('Starting app');
  const connection = new Connection(SOLANA_RPC_URL);
  const activeMarkets: MarketMeta[] = MARKETS.filter((market) => !market.deprecated);
  const scrapers: Scraper[] = activeMarkets.map((market) => new Scraper(market));

  // TODO: generate a target filename and make it accessible
  cron.schedule(`*/${SECONDS_BETWEEN_RUNS} * * * * *`, async () => {
    logger.info('Starting run');
    await Promise.all(scrapers.map((scraper) => scraper.getParseSaveEventsAsync(connection)));
    logger.info('Run complete');
  });
};
