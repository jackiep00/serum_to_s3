import { Event } from '@project-serum/serum/lib/queue';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// Object that defines a market's metadata
export type MarketMeta = {
  address: PublicKey;
  name: string;
  deprecated: boolean;
  programId: PublicKey;
  baseCurrency?: string;
  quoteCurrency?: string;
  _baseSplTokenDecimals?: number;
  _quoteSplTokenDecimals?: number;
};

export interface FullEvent extends Event {
  clientOrderId: BN;
  side: string;
  price: number;
  feeCost: number;
  size: number;
}

export type FullEventMeta = {
  address: PublicKey;
  programId: PublicKey;
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
