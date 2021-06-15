import * as cron from 'node-cron';
import { Market, MARKETS } from '@project-serum/serum';
import { MarketMeta, FullEvent, FullEventMeta } from './types';
import { pullAndSaveSerumEventsToCSV } from './pull_and_save_serum_events';
import { writeFile, readFileSync } from 'fs';
import { BATCH_FILENAME } from './config';

const SECONDS_BETWEEN_RUNS = 3;
const activeMarkets: MarketMeta[] = MARKETS.filter((item) => !item['deprecated']);

// // TODO: generate a target filename and make it accessible

// cron.schedule(`*/${SECONDS_BETWEEN_RUNS} * * * * *`, () => {
//   // cron.schedule(`*/3 * * * *`, () => {
//   activeMarkets.forEach(async (market) => {
//     pullAndSaveSerumEventsToCSV(market);
//   });
// });

// // every hour
// cron.schedule(`0 * * * * *`, () => {
//   // attempt a batch upload?
//   // metadataScraper.getParseSaveMetadataAsync(connection);
// });
