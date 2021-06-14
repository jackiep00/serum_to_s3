import { config } from 'dotenv';
config();

const throwError = (err: string) => {
  throw new Error(err);
};

export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL
  ? process.env.SOLANA_RPC_URL
  : throwError(`Must specify valid SOLANA_RPC_URL. Got: ${process.env.SOLANA_RPC_URL}`);

export const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY
  ? process.env.AWS_ACCESS_KEY
  : throwError(`Must specify valid AWS_ACCESS_KEY. Got: ${process.env.AWS_ACCESS_KEY}`);

export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
  ? process.env.AWS_SECRET_ACCESS_KEY
  : throwError(
      `Must specify valid AWS_SECRET_ACCESS_KEY. Got: ${process.env.AWS_SECRET_ACCESS_KEY}`,
    );

export const REGION = process.env.REGION
  ? process.env.REGION
  : throwError(`Must specify valid REGION. Got: ${process.env.REGION}`);

export const BUCKET = process.env.BUCKET
  ? process.env.BUCKET
  : throwError(`Must specify valid BUCKET. Got: ${process.env.BUCKET}`);

export const FOLDER = process.env.FOLDER ? process.env.FOLDER : '';

export const BATCH_FILENAME = `pipeline/batchFilename.json`;
