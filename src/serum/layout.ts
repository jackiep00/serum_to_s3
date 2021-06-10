import { bits, Blob, Layout, u32, UInt, BitStructure } from 'buffer-layout';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

class Zeros extends Blob<Uint8Array> {
  decode(b: Buffer, offset: number) {
    const slice = super.decode(b, offset);
    if (!slice.every((v) => v === 0)) {
      throw new Error('nonzero padding bytes');
    }
    return slice;
  }
}

export function zeros(length: number) {
  return new Zeros(length);
}

class PublicKeyLayout extends Blob<PublicKey> {
  constructor(property: string) {
    super(32, property);
  }

  decode(b: Buffer, offset: number) {
    return new PublicKey(super.decode(b, offset));
  }

  // @ts-ignore ~ args of encode overrides super.encode, which breaks polymorphism
  encode(src: PublicKey, b: Buffer, offset: number) {
    return super.encode(src.toBuffer(), b, offset);
  }
}

export function publicKeyLayout(property: string) {
  return new PublicKeyLayout(property);
}

class BNLayout extends Blob<BN> {
  decode(b: Buffer, offset: number) {
    return new BN(super.decode(b, offset), 10, 'le');
  }

  // @ts-ignore ~ args of encode overrides super.encode, which breaks polymorphism
  encode(src: BN, b: Buffer, offset: number) {
    return super.encode(src.toArrayLike(Buffer, 'le', this.span), b, offset);
  }
}

export function u64(property: string) {
  return new BNLayout(8, property);
}

export function u128(property: string) {
  return new BNLayout(16, property);
}

export class WideBits extends Layout {
  _lower: BitStructure;
  _upper: BitStructure;

  constructor(property?: string) {
    super(8, property);
    this._lower = bits(u32(), false);
    this._upper = bits(u32(), false);
  }

  addBoolean(property: string) {
    if (this._lower.fields.length < 32) {
      this._lower.addBoolean(property);
    } else {
      this._upper.addBoolean(property);
    }
  }

  decode(b: Buffer, offset = 0) {
    const lowerDecoded = this._lower.decode(b, offset);
    const upperDecoded = this._upper.decode(b, offset + this._lower.span);

    // @ts-ignore ~ fix later
    return { ...lowerDecoded, ...upperDecoded };
  }

  encode(src: any, b: Buffer, offset = 0) {
    return (
      this._lower.encode(src, b, offset) +
      this._upper.encode(src, b, offset + this._lower.span)
    );
  }
}

export class VersionedLayout extends Layout {
  version: number;
  inner: Layout;

  constructor(version: number, inner: Layout, property: string) {
    super(inner.span > 0 ? inner.span + 1 : inner.span, property);
    this.version = version;
    this.inner = inner;
  }

  decode(b: Buffer, offset = 0) {
    // if (b.readUInt8(offset) !== this._version) {
    //   throw new Error('invalid version');
    // }
    return this.inner.decode(b, offset + 1);
  }

  encode(src: any, b: Buffer, offset = 0) {
    b.writeUInt8(this.version, offset);
    return 1 + this.inner.encode(src, b, offset + 1);
  }

  getSpan(b: Buffer, offset = 0) {
    return 1 + this.inner.getSpan(b, offset + 1);
  }
}

class EnumLayout extends UInt<number> {
  values: Record<string, number>;

  constructor(values: Record<string, number>, span: number, property: string) {
    super(span, property);
    this.values = values;
  }

  encode(src: number, b: Buffer, offset: number) {
    if (this.values[src] !== undefined) {
      return super.encode(this.values[src], b, offset);
    }
    throw new Error('Invalid ' + this.property);
  }

  // @ts-ignore ~ string | number issue
  decode(b: Buffer, offset: number) {
    const decodedValue = super.decode(b, offset);
    const entry = Object.entries(this.values).find(([, value]) => value === decodedValue);
    if (entry) {
      return entry[0];
    }
    throw new Error('Invalid ' + this.property);
  }
}

export function sideLayout(property: string) {
  return new EnumLayout({ buy: 0, sell: 1 }, 4, property);
}

export function orderTypeLayout(property: string) {
  return new EnumLayout({ limit: 0, ioc: 1, postOnly: 2 }, 4, property);
}

export function selfTradeBehaviorLayout(property: string) {
  return new EnumLayout(
    { decrementTake: 0, cancelProvide: 1, abortTransaction: 2 },
    4,
    property,
  );
}

const ACCOUNT_FLAGS_LAYOUT = new WideBits();
ACCOUNT_FLAGS_LAYOUT.addBoolean('initialized');
ACCOUNT_FLAGS_LAYOUT.addBoolean('market');
ACCOUNT_FLAGS_LAYOUT.addBoolean('openOrders');
ACCOUNT_FLAGS_LAYOUT.addBoolean('requestQueue');
ACCOUNT_FLAGS_LAYOUT.addBoolean('eventQueue');
ACCOUNT_FLAGS_LAYOUT.addBoolean('bids');
ACCOUNT_FLAGS_LAYOUT.addBoolean('asks');

export function accountFlagsLayout(property = 'accountFlags') {
  return ACCOUNT_FLAGS_LAYOUT.replicate(property);
}

export function setLayoutDecoder(layout: Layout, decoder: (...args: any[]) => unknown) {
  const originalDecode = layout.decode;
  layout.decode = function decode(b: Buffer, offset = 0) {
    return decoder(originalDecode.call(this, b, offset));
  };
}

export function setLayoutEncoder(layout: Layout, encoder: (...args: any[]) => unknown) {
  const originalEncode = layout.encode;
  layout.encode = function encode(src, b: Buffer, offset) {
    return originalEncode.call(this, encoder(src), b, offset);
  };

  return layout;
}
