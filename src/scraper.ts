import { Connection } from '@solana/web3.js';
import { Market } from '@project-serum/serum';
import { appendFile, writeFile, readFile, access } from 'fs';
import { MarketMeta, FullEvent, FullEventMeta } from './types';
import { decodeRecentEvents } from './events';
import { logger } from './utils';
import { S3Uploader } from './uploader';

export class Scraper {
  targetMarket: MarketMeta;
  uploader: S3Uploader;

  constructor(market: MarketMeta, uploader: S3Uploader) {
    this.targetMarket = market;
    this.uploader = uploader;
  }

  async getParseSaveEventsAsync(connection: Connection) {
    const loadTimestamp = new Date().toISOString();
    let marketMeta = { ...this.targetMarket };

    let fileName = this.uploader.fileName;

    /* Check the file for the last seqNum - if there isn't a file then write one with the seqNum we get back */
    const marketLastSeqFileName = `./pipeline/${marketMeta.address.toString()}_seqnum.json`;
    loadMarketLastSeqNumber(marketMeta, marketLastSeqFileName);
    const market = await Market.load(connection, marketMeta.address, {}, marketMeta.programId);

    marketMeta = constructMarketMeta(market, marketMeta);

    const accountInfo = await fetchAccountInfo(connection, market);
    const { header, events } = decodeRecentEvents(accountInfo.data, marketMeta.lastSeqNum);
    marketMeta.lastSeqNum = header.seqNum;

    writeFile(marketLastSeqFileName, JSON.stringify(header.seqNum), 'utf-8', (err) => {
      if (err) throw err;
    });

    const currentMarket = formatEvents(events, marketMeta, loadTimestamp);
    logger.info(`Writing Market: ${marketMeta.name}`);
    writeEventsToCSV(currentMarket, fileName);
  }
}

const loadMarketLastSeqNumber = (marketMeta: MarketMeta, fileName: string) => {
  /* Check the file for the last seqNum - if there isn't a file then write one with the seqNum we get back */
  access(fileName, (err) => {
    if (err) {
      logger.info(
        `No seqnum file for Market ${
          marketMeta.name
        } (${marketMeta.address.toString()}) detected. Proceeding with script.`,
      );
      return;
    }

    /* Read LastSeqNum file */
    readFile(fileName, 'utf-8', (err, data) => {
      if (err) throw err;

      marketMeta.lastSeqNum = JSON.parse(data);
    });
  });
};

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

export const writeEventsToCSV = (events: FullEventMeta[], eventFilename: string) => {
  for (const event of events) {
    const event_csv = convertFullEventMetaToCsv(event) + '\n';

    appendFile(eventFilename, event_csv, (err) => {
      if (err) {
        logger.error(`error ${err}`);
      }
    });
  }
};

export const formatEvents = (
  events: FullEvent[],
  marketMeta: MarketMeta,
  loadTimestamp: string,
): FullEventMeta[] => {
  const fullMetaEvents: FullEventMeta[] = [];
  for (const event of events) {
    const fullMetaEvent: FullEventMeta = {
      address: marketMeta.address,
      programId: marketMeta.programId,
      baseCurrency: marketMeta.baseCurrency,
      quoteCurrency: marketMeta.quoteCurrency,
      isFill: event.eventFlags.fill ? true : false,
      isOut: event.eventFlags.out ? true : false,
      isBid: event.eventFlags.bid ? true : false,
      isMaker: event.eventFlags.maker ? true : false,
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

const constructMarketMeta = (market: Market, marketMeta: MarketMeta) => {
  const constructedMarketMeta = { ...marketMeta };

  // @ts-ignore ~ ignore typescript errors re private variables
  constructedMarketMeta._baseSplTokenDecimals = market._baseSplTokenDecimals;
  // @ts-ignore ~ ignore typescript errors re private variables
  constructedMarketMeta._quoteSplTokenDecimals = market._quoteSplTokenDecimals;
  constructedMarketMeta.baseCurrency = marketMeta.name.split('/')[0];
  constructedMarketMeta.quoteCurrency = marketMeta.name.split('/')[1];

  return constructedMarketMeta;
};

const fetchAccountInfo = async (connection: Connection, market: Market) => {
  const accountInfo = await connection.getAccountInfo(market['_decoded'].eventQueue);
  if (!accountInfo) {
    throw new Error(`Event queue account for market ${market.address} not found`);
  }

  return accountInfo;
};
