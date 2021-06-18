import { bits, blob, struct, u8, u32 } from 'buffer-layout';
import {
  accountFlagsLayout,
  publicKeyLayout,
  u128,
  u64,
  zeros,
} from '@project-serum/serum/lib/layout';
import { FullEvent } from './types';

interface EventQueueHeader {
  head: number;
  count: number;
  seqNum: number;
}

const EVENT_QUEUE_HEADER = struct<EventQueueHeader>([
  blob(5),
  accountFlagsLayout('accountFlags'),
  u32('head'),
  zeros(4),
  u32('count'),
  zeros(4),
  u32('seqNum'),
  zeros(4),
]);

const EVENT_FLAGS = bits(u8(), false, 'eventFlags');
EVENT_FLAGS.addBoolean('fill');
EVENT_FLAGS.addBoolean('out');
EVENT_FLAGS.addBoolean('bid');
EVENT_FLAGS.addBoolean('maker');

const EVENT = struct<FullEvent>([
  EVENT_FLAGS,
  u8('openOrdersSlot'),
  u8('feeTier'),
  blob(5),
  u64('nativeQuantityReleased'), // Amount the user received
  u64('nativeQuantityPaid'), // Amount the user paid
  u64('nativeFeeOrRebate'),
  u128('orderId'),
  publicKeyLayout('openOrders'),
  u64('clientOrderId'),
]);

export function decodeRecentEvents(buffer: Buffer, lastSeenSeqNum?: number) {
  const header = EVENT_QUEUE_HEADER.decode(buffer);
  const events: FullEvent[] = [];

  if (lastSeenSeqNum !== undefined) {
    const allocLen = Math.floor((buffer.length - EVENT_QUEUE_HEADER.span) / EVENT.span);

    const newEventsCount = header.seqNum - lastSeenSeqNum;

    for (let i = newEventsCount; i > 0; --i) {
      const nodeIndex = (header.head + header.count + allocLen - i) % allocLen;

      // TODO: if nodeIndex is negative, throw an error
      // "seqNum difference outstrips the existing buffer - events have been skipped"
      const decodedItem = EVENT.decode(
        buffer,
        EVENT_QUEUE_HEADER.span + nodeIndex * EVENT.span,
      );
      events.push(decodedItem);
    }
  }

  return { header, events };
}
