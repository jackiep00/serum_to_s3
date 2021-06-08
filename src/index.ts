import { Connection, PublicKey } from '@solana/web3.js';
import { Market, OpenOrders } from '@project-serum/serum';
import { MarketMeta, FullEvent, FullEventMeta } from './types';
import {
  SOLANA_RPC_URL,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  REGION,
  FOLDER,
  BUCKET,
} from './config';

import MarketsJSON from './config/markets.json';
// import { writeFileSync } from 'fs';
import S3 from 'aws-sdk/clients/s3';

const INFO_LEVEL = 'INFO';

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

const main = async function () {
  const waitTime = 50;
  // Remove deprecated items
  const markets: MarketMeta[] = MarketsJSON.filter((item, i, ar) => !item['deprecated']);

  const all_market_events: FullEventMeta[] = [];
  for (let i = 0; i < markets.length; i++) {
    console.log(i);

    let marketMeta = markets[i];

    marketMeta['baseCurrency'] = marketMeta['name'].split('/')[0];
    marketMeta['quoteCurrency'] = marketMeta['name'].split('/')[1];

    let connection = new Connection(SOLANA_RPC_URL);
    let marketAddress = new PublicKey(marketMeta['address']);
    let programID = new PublicKey(marketMeta['programId']);

    // Contrary to the docs - you need to pass programID as well it seems
    let market = await Market.load(connection, marketAddress, {}, programID);

    // Ignoring the fact that we're grabbing private variables from serum.Markets
    // @ts-ignore
    marketMeta['_baseSplTokenDecimals'] = market._baseSplTokenDecimals;
    // @ts-ignore
    marketMeta['_quoteSplTokenDecimals'] = market._quoteSplTokenDecimals;

    console.log(marketMeta['name']);

    let loadTimestamp = new Date().toISOString();
    let events: FullEvent[] = await market.loadFills(connection, 1000);

    let marketEventsLength = events.length;
    console.log(marketEventsLength);

    console.log('Pulling event queue at ' + loadTimestamp, INFO_LEVEL, marketMeta);

    const currentMarket = await formatEvents(events, marketMeta, loadTimestamp);

    all_market_events.push(...currentMarket);

    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  console.log(all_market_events);

  let loadTimestamp = new Date().toISOString();

  // writeFileSync(
  //   // execution path expected to be the root folder
  //   `./output/all_market_events_${loadTimestamp}.json`,
  //   JSON.stringify(all_market_events),
  // );

  const buf = Buffer.from(JSON.stringify(all_market_events));

  const bucket = new S3({
    accessKeyId: AWS_ACCESS_KEY, // For example, 'AKIXXXXXXXXXXXGKUY'.
    secretAccessKey: AWS_SECRET_ACCESS_KEY, // For example, 'm+XXXXXXXXXXXXXXXXXXXXXXDDIajovY+R0AGR'.
    region: REGION, // For example, 'us-east-1'.
  });

  const params = {
    Bucket: BUCKET,
    Key: `all_market_events_${loadTimestamp}.json`,
    Body: buf,
    ACL: 'public-read',
  };

  bucket.upload(params, function (err: Error, data: S3.ManagedUpload.SendData) {
    if (err) {
      console.log('There was an error uploading your file: ', err);
      return false;
    }
    console.log('Successfully uploaded file.', data);
    return true;
  });
};

main();
