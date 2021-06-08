import {
  SOLANA_RPC_URL,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  REGION,
  FOLDER,
  BUCKET,
} from './config';

import S3 from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk';

const sample_json = {
  address: 'GcoKtAmTy5QyuijXSmJKBtFdt99e6Buza18Js7j9AJ6e',
  programId: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  baseCurrency: 'ALEPH',
  quoteCurrency: 'USDC',
  isFill: true,
  isOut: false,
  isBid: false,
  isMaker: true,
  openOrdersSlot: 5,
  feeTier: 6,
  side: 'sell',
  price: 0.2229,
  feeCost: -0.028196,
  size: 253,
  loadTimestamp: '2021-06-08T22:06:22.283Z',
};

AWS.config.logger = console;

let loadTimestamp = new Date().toISOString();

const buf = Buffer.from(JSON.stringify(sample_json));

const bucket = new S3({
  accessKeyId: AWS_ACCESS_KEY, // For example, 'AKIXXXXXXXXXXXGKUY'.
  secretAccessKey: AWS_SECRET_ACCESS_KEY, // For example, 'm+XXXXXXXXXXXXXXXXXXXXXXDDIajovY+R0AGR'.
  region: REGION, // For example, 'us-east-1'.
});

const params = {
  Bucket: BUCKET,
  Key: `/data/test_json_${loadTimestamp}.json`,
  Body: buf,
  ACL: 'public-read',
};

bucket.listObjects({ Bucket: BUCKET }, function (err, data) {
  if (err) {
    console.log('There was an error getting your files: ' + err);
    return;
  }
  console.log('Successfully get files.', data);
});

bucket.upload(params, function (err: Error, data: S3.ManagedUpload.SendData) {
  if (err) {
    console.log('There was an error uploading your file: ', err);
    return false;
  }
  console.log('Successfully uploaded file.', data);
  return true;
});
