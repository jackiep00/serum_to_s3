import { Connection } from '@solana/web3.js';
import { Market } from '@project-serum/serum';
import { readFileSync, readFile, access, writeFile } from 'fs';
import { SOLANA_RPC_URL, BATCH_FILENAME } from './config';
import { MarketMeta } from './types';
import { decodeRecentEvents } from './events';
import { formatEvents, writeEventsToCSV } from './scraper';

export const pullAndSaveSerumEventsToCSV = async (
  targetMarket: MarketMeta,
  fileName: string = readFileSync(BATCH_FILENAME, { encoding: 'utf8', flag: 'r' }),
  filenameTemplate: string = 'output/all_market_events_',
): Promise<void> => {
  // write the new seqNum
  // write events to a target CSV

  let marketMeta = targetMarket;

  // check the file for the last seqNum - if there isn't a file then write one with the seqNum we get back
  const marketFileName = `./pipeline/${marketMeta['address'].toString()}_seqnum.json`;
  access(marketFileName, (err) => {
    if (err) {
      console.log(
        `No seqnum file for Market ${marketMeta['name']} (${marketMeta[
          'address'
        ].toString()}) detected. Proceeding with script.`,
      );
      return;
    }
    // Read LastSeqNum file
    readFile(marketFileName, 'utf-8', (err, data) => {
      if (err) throw err;

      marketMeta.lastSeqNum = JSON.parse(data);
    });
  });

  marketMeta['baseCurrency'] = marketMeta['name'].split('/')[0];
  marketMeta['quoteCurrency'] = marketMeta['name'].split('/')[1];

  let connection = new Connection(SOLANA_RPC_URL);
  let marketAddress = marketMeta['address'];
  let programID = marketMeta['programId'];
  let market = await Market.load(connection, marketAddress, {}, programID);

  // @ts-ignore
  marketMeta['_baseSplTokenDecimals'] = market._baseSplTokenDecimals;
  // @ts-ignore
  marketMeta['_quoteSplTokenDecimals'] = market._quoteSplTokenDecimals;

  let loadTimestamp = new Date().toISOString();
  const accountInfo = await connection.getAccountInfo(market['_decoded'].eventQueue);
  if (accountInfo === null) {
    throw new Error(`Event queue account for market ${marketAddress} not found`);
  }
  // pull the events since the last seqNum
  const { header, events } = decodeRecentEvents(accountInfo.data, marketMeta.lastSeqNum);

  // write the new seqNum into marketMeta and the seqNum file
  marketMeta.lastSeqNum = header.seqNum;
  writeFile(marketFileName, JSON.stringify(header.seqNum), 'utf-8', (err) => {
    if (err) throw err;
  });

  const currentMarket = formatEvents(events, marketMeta, loadTimestamp);
  writeEventsToCSV(currentMarket, fileName);
};
