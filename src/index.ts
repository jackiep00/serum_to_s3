import { Connection } from '@solana/web3.js';
import { Market, MARKETS } from '@project-serum/serum';
import { createWriteStream, appendFile } from 'fs';
import { MarketMeta, FullEvent, FullEventMeta } from './types';
import {
  SOLANA_RPC_URL,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  REGION,
  FOLDER,
  BUCKET,
} from './config';
import { decodeRecentEvents } from './events';
import { batchUploadtoS3 } from './batch_upload';
import { logger } from './utils';

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
  for (const event of events) {
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

const formatEvents = function (
  events: FullEvent[],
  marketMeta: MarketMeta,
  loadTimestamp: string,
): FullEventMeta[] {
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

const main = async function () {
  logger.info('Starting app');
  const loadTimestamp = new Date().toISOString();
  let eventFilename = `output/all_market_events_${loadTimestamp}.csv`;
  const filenameTemplate = 'output/all_market_events_';
  const waitTime = 0;
  const numPullsInBatch = 75;

  // Remove deprecated items
  const activeMarkets: MarketMeta[] = MARKETS.filter((item) => !item['deprecated']);
  createWriteStream(eventFilename);

  logger.info('Pulling market data');
  /* Perform numPullsInBatch pulls for each of the activeMarkets */
  for (let iPulls = 0; iPulls < numPullsInBatch; iPulls++) {
    for (let i = 0; i < activeMarkets.length; i++) {
      const marketMeta = activeMarkets[i];
      const connection = new Connection(SOLANA_RPC_URL);
      const market = await Market.load(
        connection,
        marketMeta['address'],
        {},
        marketMeta['programId'],
      );

      // @ts-ignore ~ ignore typescript errors re private variables
      marketMeta['_baseSplTokenDecimals'] = market._baseSplTokenDecimals;
      // @ts-ignore ~ ignore typescript errors re private variables
      marketMeta['_quoteSplTokenDecimals'] = market._quoteSplTokenDecimals;
      marketMeta['baseCurrency'] = marketMeta['name'].split('/')[0];
      marketMeta['quoteCurrency'] = marketMeta['name'].split('/')[1];

      const accountInfo = await connection.getAccountInfo(market['_decoded'].eventQueue);
      if (!accountInfo) {
        throw new Error(
          `Event queue account for market ${marketMeta['address']} not found`,
        );
      }

      const { header, events } = decodeRecentEvents(
        accountInfo.data,
        marketMeta.lastSeqNum,
      );

      marketMeta.lastSeqNum = header.seqNum;
      const loadTimestamp = new Date().toISOString();
      const currentMarket = formatEvents(events, marketMeta, loadTimestamp);
      writeEventsToCSV(currentMarket, eventFilename);

      eventFilename = await batchUploadtoS3(
        eventFilename,
        filenameTemplate,
        AWS_ACCESS_KEY,
        AWS_SECRET_ACCESS_KEY,
        REGION,
        BUCKET,
        FOLDER,
        'private',
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

main();
