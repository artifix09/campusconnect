import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

/**
 * Object storage over the S3 API: Cloudflare R2 in production, MinIO locally
 * or on university servers (ADR-022). The bucket is private; files are only
 * reachable through short-lived signed URLs issued after an access check.
 */
const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

const SIGNED_URL_SECONDS = 5 * 60;

export const storage = {
  async put(key: string, body: Buffer, contentType: string) {
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition: "inline",
        CacheControl: "private, max-age=300",
      }),
    );
  },

  async remove(key: string) {
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  },

  signedUrl(key: string) {
    return getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
      expiresIn: SIGNED_URL_SECONDS,
    });
  },

  async ping() {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  },
};
