import { Connection, PublicKey } from '@solana/web3.js';
import { Market, OpenOrders } from '@project-serum/serum';
import { Event } from '@project-serum/serum/lib/queue';
import MarketsJSON from './config/markets.json';
import BN from 'bn.js';
import { writeFileSync } from 'fs';

import { config } from 'dotenv';
config();

const INFO_LEVEL = 'INFO';

// Object that defines a market's metadata
type MarketMeta = {
  address: string;
  name: string;
  deprecated: boolean;
  programId: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  _baseSplTokenDecimals?: number;
  _quoteSplTokenDecimals?: number;
};

interface FullEvent extends Event {
  clientOrderId: BN;
  side: string;
  price: number;
  feeCost: number;
  size: number;
}

type FullEventMeta = {
  address: string;
  programId: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  isFill: boolean;
  isOut: boolean;
  isBid: boolean;
  isMaker: boolean;
  openOrdersSlot: number;
  feeTier: number;
  nativeQuantityRelease: BN;
  nativeQuantityPaid: BN;
  nativeFeeOrRebate: BN;
  orderId: BN;
  openOrders: PublicKey;
  clientOrderId: BN;
  side: string;
  price: number;
  feeCost: number;
  size: number;
  loadTimestamp: string;
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

    let connection = new Connection(`${process.env.RPC}`);
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

    // let queueOffset = getQueueOffset(events, marketMeta, db);

    // let newEvents = events.slice(0, queueOffset);

    // await addOwnerMappings(newEvents, db, connection, marketMeta);
    // insertCurrencyMeta(marketMeta, db);

    // Only insert filled events to save space
    // let filledEvents = newEvents.filter((item, i, ar) => item.eventFlags['fill']);
    //insertEvents(filledEvents, marketMeta, loadTimestamp);

    // Insert all events for more convenient matching
    //insertStringEvents(newEvents, marketEventsLength, marketMeta, loadTimestamp, db);

    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  let loadTimestamp = new Date().toISOString();

  console.log(all_market_events);

  writeFileSync(
    // execution path expected to be the root folder
    `./output/all_market_events_${loadTimestamp}.json`,
    JSON.stringify(all_market_events),
  );
};

main();
