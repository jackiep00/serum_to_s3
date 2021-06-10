import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js';
import { decodeEventQueue, decodeRequestQueue } from './queue';
import { FullEvent } from './../types';
import { getMintDecimals, Market, MarketOptions } from '@project-serum/serum/lib/market';

export class FullMarket extends Market {
  static async load(
    connection: Connection,
    address: PublicKey,
    options: MarketOptions = {},
    programId: PublicKey,
  ) {
    const { owner, data } = throwIfNull(
      await connection.getAccountInfo(address),
      'Market not found',
    );
    if (!owner.equals(programId)) {
      throw new Error('Address not owned by program: ' + owner.toBase58());
    }
    const decoded = this.getLayout(programId).decode(data);
    if (
      !decoded.accountFlags.initialized ||
      !decoded.accountFlags.market ||
      !decoded.ownAddress.equals(address)
    ) {
      throw new Error('Invalid market');
    }
    const [baseMintDecimals, quoteMintDecimals] = await Promise.all([
      getMintDecimals(connection, decoded.baseMint),
      getMintDecimals(connection, decoded.quoteMint),
    ]);
    return new FullMarket(
      decoded,
      baseMintDecimals,
      quoteMintDecimals,
      options,
      programId,
    );
  }

  async loadFillsAndContext(connection: Connection, limit = 100) {
    // TODO: once there's a separate source of fills use that instead

    const result = throwIfNull(
      // @ts-expect-error 2341
      await connection.getAccountInfoAndContext(this._decoded.eventQueue),
    );
    const value = throwIfNull(result.value);
    console.log(result);
    const [header, events] = decodeEventQueue(value.data, limit);

    for (const event of events) {
      event.solSlotNum = result.context.slot;
      event.sequenceNum = header.seqNum;
    }

    return events
      .filter((event) => event.eventFlags.fill && event.nativeQuantityPaid.gtn(0))
      .map(this.parseFillEvent.bind(this));
  }
}

function throwIfNull<T>(value: T | null, message = 'account not found'): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}
