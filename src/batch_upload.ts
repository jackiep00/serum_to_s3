import { statSync, createReadStream } from 'fs';
import S3 from 'aws-sdk/clients/s3';
import { logger } from './utils';

const BATCH_FILESIZE_MB = 0.5;

const uploadToS3 = async function (
  fileName: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  bucket_name: string,
  folder_name: string,
  ACL: string,
): Promise<S3.ManagedUpload.SendData> {
  console.log('Upload to S3 being attempted');
  console.log(`Trying to upload ${fileName}`);

  const readStream = createReadStream(fileName);

  const bucket = new S3({
    accessKeyId: accessKeyId, // For example, 'AKIXXXXXXXXXXXGKUY'.
    secretAccessKey: secretAccessKey, // For example, 'm+XXXXXXXXXXXXXXXXXXXXXXDDIajovY+R0AGR'.
    region: region, // For example, 'us-east-1'.
  });

  const params = {
    Bucket: bucket_name,
    Key: folder_name ? `${folder_name}/${fileName}` : fileName,
    Body: readStream,
    ACL: ACL,
  };

  return new Promise((resolve, reject) => {
    bucket.upload(params, function (err: Error, data: S3.ManagedUpload.SendData) {
      readStream.destroy();

      if (err) {
        return reject(err);
      }

      return resolve(data);
    });
  });
};

// this function checks the file to see if it's larger than the threshold before actually uploading
// the filename it returns is current working file
export async function batchUploadtoS3(
  workingFilename: string,
  filenameTemplate: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  bucket_name: string,
  folder_name: string,
  ACL: string,
): Promise<string> {
  logger.info(`Checking filesize of ${workingFilename}`);
  const stats = statSync(workingFilename, { throwIfNoEntry: false });
  // returns undefined if the file does not exist
  const fileSizeMB = stats ? stats.size / (1024 * 1024) : 0;

  if (fileSizeMB > BATCH_FILESIZE_MB) {
    // write the filename to a new const so it doesn't get overwritten during the async
    const uploadFilename = workingFilename;
    console.log(
      await uploadToS3(
        uploadFilename,
        accessKeyId,
        secretAccessKey,
        region,
        bucket_name,
        folder_name,
        ACL,
      ),
    );
    let loadTimestamp = new Date().toISOString();
    return `${filenameTemplate}${loadTimestamp}.csv`;
  }
  return workingFilename;
}

export async function batchUploadtoS3Manager(): Promise<void> {
  let loadTimestamp = new Date().toISOString();
  let eventFilename = `output/all_market_events_${loadTimestamp}.csv`;

  writeFile(BATCH_FILENAME, eventFilename, 'utf-8', (err) => {
    if (err) throw err;
  });

  let test_result = readFileSync(BATCH_FILENAME);

  console.log(test_result.toString());

  // should this part of the code really be in charge of uploading?
  fileName = await batchUploadtoS3(
    fileName,
    filenameTemplate,
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    REGION,
    BUCKET,
    FOLDER,
    'private',
  );
}
