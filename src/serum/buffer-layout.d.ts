declare module 'buffer-layout';

type Layout = {
  decode: (buffer: Buffer) => string;
};

type HeaderLayout = {
  decode: (buffer: Buffer) => string;
  span: number;
  head: number;
};
