import { statSync, createReadStream } from 'fs';
import S3 from 'aws-sdk/clients/s3';

const BATCH_FILESIZE_MB = 0.5;

const uploadToS3 = async function (
  fileName: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  bucket_name: string,
  folder_name: string,
  ACL: string,
): Promise<any> {
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
  console.log(`Checking filesize of ${workingFilename}`);
  const stats = statSync(workingFilename);
  const fileSizeMB = stats.size / (1024 * 1024);

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
