import { statSync, createReadStream } from 'fs';
import S3 from 'aws-sdk/clients/s3';
import { logger } from './utils';

/**
 * This class keeps track of the batched files that we're going to upload to S3
 */
export class S3Uploader {
  fileName: string;
  fileNameTemplate: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  folderName: string;
  ACL: string;
  batchFilesizeMB: number;

  constructor(
    fileNameTemplate: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    bucketName: string,
    folderName: string,
    ACL: string = 'private',
    batchFilesizeMB: number = 0.5,
  ) {
    let loadTimestamp = new Date().toISOString();
    this.fileName = `${fileNameTemplate}${loadTimestamp}.csv`;
    this.fileNameTemplate = fileNameTemplate;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.bucketName = bucketName;
    this.folderName = folderName;
    this.ACL = ACL;
    this.batchFilesizeMB = batchFilesizeMB;
  }

  /**
   * This function checks the file to see if it's larger than the threshold before actually uploading
   * the filename it returns is current working file.
   */
  async batchUploadtoS3(): Promise<void> {
    logger.info(`Checking filesize of ${this.fileName}`);
    const stats = statSync(this.fileName, { throwIfNoEntry: false });
    // Return undefined if the file does not exist
    const fileSizeMB = stats ? stats.size / (1024 * 1024) : 0;

    if (fileSizeMB > this.batchFilesizeMB) {
      const uploadFile = this.fileName;
      await uploadToS3(
        uploadFile,
        this.accessKeyId,
        this.secretAccessKey,
        this.region,
        this.bucketName,
        this.folderName,
        this.ACL,
      );
    }
  }
}

const uploadToS3 = async function (
  fileName: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  bucketName: string,
  folderName: string,
  ACL: string,
): Promise<S3.ManagedUpload.SendData> {
  logger.info('Upload to S3 being attempted');
  logger.info(`Trying to upload ${fileName}`);

  const readStream = createReadStream(fileName);

  const bucket = new S3({
    accessKeyId: accessKeyId, // For example, 'AKIXXXXXXXXXXXGKUY'.
    secretAccessKey: secretAccessKey, // For example, 'm+XXXXXXXXXXXXXXXXXXXXXXDDIajovY+R0AGR'.
    region: region, // For example, 'us-east-1'.
  });

  const params = {
    Bucket: bucketName,
    Key: folderName ? `${folderName}/${fileName}` : fileName,
    Body: readStream,
    ACL: ACL,
  };

  return new Promise((resolve, reject) => {
    bucket.upload(params, function (err: Error, data: S3.ManagedUpload.SendData) {
      readStream.destroy();

      if (err) {
        return reject(err);
      }
      logger.info('Upload to S3 successful');
      return resolve(data);
    });
  });
};
