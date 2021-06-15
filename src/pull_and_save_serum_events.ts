import { Connection } from '@solana/web3.js';
import { Market, MARKETS } from '@project-serum/serum';
import { appendFile, readFileSync, readFile, access, writeFile } from 'fs';
import {
  SOLANA_RPC_URL,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  REGION,
  FOLDER,
  BUCKET,
  BATCH_FILENAME,
} from './config';
import { MarketMeta, FullEventMeta, FullEvent } from './types';
import { decodeRecentEvents } from './events';
import { batchUploadtoS3 } from './batch_upload';

// for a given market and filename:

const convertFullEventMetaToCsv = (event: FullEventMeta): string =>
  [
    event.address.toString(),
    event.programId.toString(),
    event.baseCurrency ?? '',
    event.quoteCurrency ?? '',
    event.isFill,
    event.isOut,
    event.isBid,
    event.isMaker,
    event.openOrdersSlot,
    event.feeTier,
    event.nativeQuantityRelease.toString(),
    event.nativeQuantityPaid.toString(),
    event.nativeFeeOrRebate.toString(),
    event.orderId.toString(),
    event.openOrders,
    event.clientOrderId.toString(),
    event.side,
    event.price,
    event.feeCost,
    event.size,
    event.loadTimestamp,
  ].join();

const writeEventsToCSV = function (events: FullEventMeta[], eventFilename: string) {
  for (let event of events) {
    const event_csv = convertFullEventMetaToCsv(event) + '\n';
    // console.log('writing ' + event_csv);

    appendFile(eventFilename, event_csv, (err) => {
      if (err) {
        console.log('error ' + err);
      } else {
        // console.log('wrote ' + event_csv);
      }
    });
  }
};

const formatEvents = async function (
  events: FullEvent[],
  marketMeta: MarketMeta,
  loadTimestamp: string,
): Promise<FullEventMeta[]> {
  const fullMetaEvents: FullEventMeta[] = [];
  for (const event of events) {
    const fullMetaEvent: FullEventMeta = {
      address: marketMeta['address'],
      programId: marketMeta['programId'],
      baseCurrency: marketMeta['baseCurrency'],
      quoteCurrency: marketMeta['quoteCurrency'],
      isFill: event.eventFlags['fill'] ? true : false,
      isOut: event.eventFlags['out'] ? true : false,
      isBid: event.eventFlags['bid'] ? true : false,
      isMaker: event.eventFlags['maker'] ? true : false,
      openOrdersSlot: event.openOrdersSlot,
      feeTier: event.feeTier,
      nativeQuantityRelease: event.nativeQuantityReleased,
      nativeQuantityPaid: event.nativeQuantityPaid,
      nativeFeeOrRebate: event.nativeFeeOrRebate,
      orderId: event.orderId,
      openOrders: event.openOrders,
      clientOrderId: event.clientOrderId,
      side: event.side,
      price: event.price,
      feeCost: event.feeCost,
      size: event.size,
      loadTimestamp: loadTimestamp,
    };
    fullMetaEvents.push(fullMetaEvent);
  }

  return fullMetaEvents;
};

// the function supports having a target write filename, but
// by default, use
export async function pullAndSaveSerumEventsToCSV(
  targetMarket: MarketMeta,
  fileName: string = readFileSync(BATCH_FILENAME, { encoding: 'utf8', flag: 'r' }),
  filenameTemplate: string = 'output/all_market_events_',
): Promise<void> {
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

  // Contrary to the docs - you need to pass programID as well it seems
  let market = await Market.load(connection, marketAddress, {}, programID);

  // Ignoring the fact that we're grabbing private variables from serum.Markets
  // @ts-ignore
  marketMeta['_baseSplTokenDecimals'] = market._baseSplTokenDecimals;
  // @ts-ignore
  marketMeta['_quoteSplTokenDecimals'] = market._quoteSplTokenDecimals;
  // console.log(marketMeta['name']);

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

  // let marketEventsLength = events.length;
  // console.log(marketEventsLength);

  // console.log('Pulling event queue at ' + loadTimestamp, INFO_LEVEL, marketMeta);

  const currentMarket = await formatEvents(events, marketMeta, loadTimestamp);

  // all_market_events.push(...currentMarket);

  writeEventsToCSV(currentMarket, fileName);
}
