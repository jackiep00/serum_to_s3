import { Connection, PublicKey } from '@solana/web3.js';
import { Market, MARKETS } from '@project-serum/serum';
import { MarketMeta, FullEvent, FullEventMeta } from './types';
import {
  SOLANA_RPC_URL,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  REGION,
  FOLDER,
  BUCKET,
} from './config';
import {
  createReadStream,
  createWriteStream,
  WriteStream,
  writeFile,
  write,
  appendFile,
} from 'fs';
import { decodeRecentEvents } from './events';
import { batchUploadtoS3 } from './batcher';

// import { writeFileSync } from 'fs';
import S3 from 'aws-sdk/clients/s3';

const INFO_LEVEL = 'INFO';
const TOP_MARKETS = MARKETS.filter((item) =>
  ['xCOPE/USDC', 'ETH/USDC', 'BTC/USDC', 'RAY/USDT', 'FTT/USDT'].includes(item.name),
);

const fullEventMetaToCsv = (event: FullEventMeta): string => {
  const result = [
    event.address.toString() ?? '',
    event.programId.toString() ?? '',
    event.baseCurrency ?? '',
    event.quoteCurrency ?? '',
    event.isFill ?? '',
    event.isOut ?? '',
    event.isBid ?? '',
    event.isMaker ?? '',
    event.openOrdersSlot ?? '',
    event.feeTier ?? '',
    event.nativeQuantityRelease.toString() ?? '',
    event.nativeQuantityPaid.toString() ?? '',
    event.nativeFeeOrRebate.toString() ?? '',
    event.orderId.toString() ?? '',
    event.openOrders ?? '',
    event.clientOrderId.toString() ?? '',
    event.side ?? '',
    event.price ?? '',
    event.feeCost ?? '',
    event.size ?? '',
    event.loadTimestamp ?? '',
  ];

  return result.join();
};

const formatEvents = async function (
  events: FullEvent[],
  marketMeta: MarketMeta,
  loadTimestamp: string,
): Promise<FullEventMeta[]> {
  const full_meta_events: FullEventMeta[] = [];
  for (const event of events) {
    const full_meta_event: FullEventMeta = {
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
    full_meta_events.push(full_meta_event);
  }

  return full_meta_events;
};

const uploadToS3 = async function (
  fileName: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  bucket_name: string,
  folder_name: string,
  ACL: string,
): Promise<any> {
  const readStream = createReadStream(fileName);

  const bucket = new S3({
    accessKeyId: accessKeyId, // For example, 'AKIXXXXXXXXXXXGKUY'.
    secretAccessKey: secretAccessKey, // For example, 'm+XXXXXXXXXXXXXXXXXXXXXXDDIajovY+R0AGR'.
    region: region, // For example, 'us-east-1'.
  });

  const params = {
    Bucket: bucket_name,
    Key: folder_name ? `${folder_name}/${fileName}` : fileName,
    Body: readStream,
    ACL: ACL,
  };

  return new Promise((resolve, reject) => {
    bucket.upload(params, function (err: Error, data: S3.ManagedUpload.SendData) {
      readStream.destroy();

      if (err) {
        return reject(err);
      }

      return resolve(data);
    });
  });
};

const main = async function () {
  let loadTimestamp = new Date().toISOString();
  const eventFilename = `output/all_market_events_${loadTimestamp}.csv`;
  const waitTime = 0;
  const numPullsInBatch = 2;

  // Remove deprecated items
  const activeMarkets: MarketMeta[] = TOP_MARKETS.filter(
    (item, i, ar) => !item['deprecated'],
  );

  const eventWriter = createWriteStream(eventFilename);

  let all_market_events: FullEventMeta[] = [];
  for (let iPulls = 0; iPulls < numPullsInBatch; iPulls++) {
    for (let i = 0; i < activeMarkets.length; i++) {
      console.log(i);

      let marketMeta = activeMarkets[i];

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

      console.log(marketMeta['name']);

      let loadTimestamp = new Date().toISOString();
      // let events: FullEvent[] = await market.loadFillsAndContext(connection, 1000);

      const accountInfo = await connection.getAccountInfo(market['_decoded'].eventQueue);
      if (accountInfo === null) {
        throw new Error(`Event queue account for market ${marketAddress} not found`);
      }
      const { header, events } = decodeRecentEvents(
        accountInfo.data,
        marketMeta.lastSeqNum,
      );

      marketMeta.lastSeqNum = header.seqNum;

      let marketEventsLength = events.length;
      console.log(marketEventsLength);

      console.log('Pulling event queue at ' + loadTimestamp, INFO_LEVEL, marketMeta);

      const currentMarket = await formatEvents(events, marketMeta, loadTimestamp);

      all_market_events.push(...currentMarket);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  const full_event_csv = all_market_events.map((fullEvent) => {
    return fullEventMetaToCsv(fullEvent);
  });

  for (let event_csv of full_event_csv) {
    console.log('writing ' + event_csv);

    appendFile(eventFilename, event_csv, (err) => {
      if (err) {
        console.log('error ' + err);
      } else {
        console.log('wrote ' + event_csv);
      }
    });
  }

  await uploadToS3(
    eventFilename,
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    REGION,
    BUCKET,
    FOLDER,
    'private',
  );
};

main();
