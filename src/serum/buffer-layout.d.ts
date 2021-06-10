declare module 'buffer-layout';

type Layout = {
  decode: (buffer: Buffer) => string;
};

type Structure = {
  decode: <T = unknown>(buffer: Buffer, offset?) => T;
  span: number;
  head: number;
};

function struct(fields, property?, decodePrefixes?): Structure;
