declare module 'buffer-layout' {
  export abstract class Layout<T = unknown> {
    span: number;
    property?: string;

    constructor(span: number, property?: string);

    decode(b: Buffer, offset?: number): T;
    encode(src: T, b: Buffer, offset?: number): number;
    getSpan(b: Buffer, offset?: number): number;
    replicate(name: string): this;
  }
  export class Structure<T = unknown> extends Layout<T> {
    span: number;
  }

  export class Blob<T = unknown> extends Layout<T> {
    span: number;

    encode(src: Buffer, b: Buffer, offset?: number): number;
  }

  export class UInt<T = unknown> extends Layout<T> {}

  export class BitStructure extends Layout {
    fields: BitField[];
    addBoolean(property: string): boolean;
  }

  class BitField {
    container: BitStructure;
    bits: number;
    valueMask: number;
    start: number;
    wordMask: number;
    property: string;

    constructor(container: BitStructure, bits: number, property: string);
  }

  export function greedy(elementSpan?: number, property?: string): Layout<number>;
  export function offset<T>(
    layout: Layout<T>,
    offset?: number,
    property?: string,
  ): Layout<T>;

  export function u8(property?: string): Layout<number>;
  export function u16(property?: string): Layout<number>;
  export function u24(property?: string): Layout<number>;
  export function u32(property?: string): Layout<number>;
  export function u40(property?: string): Layout<number>;
  export function u48(property?: string): Layout<number>;
  export function nu64(property?: string): Layout<number>;
  export function u16be(property?: string): Layout<number>;
  export function u24be(property?: string): Layout<number>;
  export function u32be(property?: string): Layout<number>;
  export function u40be(property?: string): Layout<number>;
  export function u48be(property?: string): Layout<number>;
  export function nu64be(property?: string): Layout<number>;
  export function s8(property?: string): Layout<number>;
  export function s16(property?: string): Layout<number>;
  export function s24(property?: string): Layout<number>;
  export function s32(property?: string): Layout<number>;
  export function s40(property?: string): Layout<number>;
  export function s48(property?: string): Layout<number>;
  export function ns64(property?: string): Layout<number>;
  export function s16be(property?: string): Layout<number>;
  export function s24be(property?: string): Layout<number>;
  export function s32be(property?: string): Layout<number>;
  export function s40be(property?: string): Layout<number>;
  export function s48be(property?: string): Layout<number>;
  export function ns64be(property?: string): Layout<number>;
  export function f32(property?: string): Layout<number>;
  export function f32be(property?: string): Layout<number>;
  export function f64(property?: string): Layout<number>;
  export function f64be(property?: string): Layout<number>;
  export function struct<T>(
    fields: Layout<any>[],
    property?: string,
    decodePrefixes?: boolean,
  ): Layout<T>;
  export function bits(
    word: Layout<number>,
    msb?: boolean,
    property?: string,
  ): BitStructure;
  export function seq<T>(
    elementLayout: Layout<T>,
    count: number | Layout<number>,
    property?: string,
  ): Layout<T[]>;
  export function union(discr: Layout<any>, defaultLayout?: any, property?: string): any;
  export function unionLayoutDiscriminator(layout: Layout<any>, property?: string): any;
  export function blob(
    length: number | Layout<number>,
    property?: string,
  ): Layout<Buffer>;
  export function cstr(property?: string): Layout<string>;
  export function utf8(maxSpan: number, property?: string): Layout<string>;
}