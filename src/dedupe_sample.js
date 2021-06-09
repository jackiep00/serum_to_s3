// code chunk one

const EVENT_QUEUE_HEADER = struct([
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

const EVENT = struct([
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
  const nodes: any[] = [];

  if (lastSeenSeqNum !== undefined) {
    const allocLen = Math.floor((buffer.length - EVENT_QUEUE_HEADER.span) / EVENT.span);

    const newEventsCount = header.seqNum - lastSeenSeqNum;

    for (let i = newEventsCount; i > 0; --i) {
      const nodeIndex = (header.head + header.count + allocLen - i) % allocLen;
      const decodedItem = EVENT.decode(
        buffer,
        EVENT_QUEUE_HEADER.span + nodeIndex * EVENT.span,
      );
      nodes.push(decodedItem);
    }
  }

  return { header, nodes };
}

// code chunk two

var lastSeenSeqNum = undefined;

for (let i = 0; i < 50; ++i) {
  const status = await connection.getSignatureStatus(txid);
  console.log({ status: status!.value!.confirmations });

  let orders = await market.loadOrdersForOwner(connection, payer.publicKey);
  console.log({ orders });

  const info = await connection.getAccountInfo(market['_decoded'].eventQueue);
  const { header, nodes } = decodeRecentEvents(info!.data, lastSeenSeqNum);
  console.log({
    header,
    nodes: nodes.map((n) => [
      n.nativeQuantityPaid.toNumber(),
      n.nativeQuantityReleased.toNumber(),
    ]),
  });
  lastSeenSeqNum = header.seqNum;

  const liqorWalletAccounts = await getMultipleAccounts(
    connection,
    tokenWallets,
    'processed' as Commitment,
  );
  const liqorValuesUi = liqorWalletAccounts.map((a, i) =>
    nativeToUi(
      parseTokenAccountData(a.accountInfo.data).amount,
      mangoGroup.mintDecimals[i],
    ),
  );
  console.log({ liqorValuesUi });
  await sleep(500);
}
