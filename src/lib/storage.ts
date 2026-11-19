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
import { BusinessRuleError } from "./errors";

/**
 * Object storage over the S3 API: Cloudflare R2 in production, MinIO locally
 * or on university servers (ADR-022). The bucket is private; files are only
 * reachable through short-lived signed URLs issued after an access check.
 */
export const storageEnabled = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

const client = storageEnabled
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    })
  : null;

function bucket() {
  if (!client) throw new BusinessRuleError("Photo uploads are not set up on this server yet.", "storage-disabled");
  return { client, Bucket: env.S3_BUCKET! };
}

const SIGNED_URL_SECONDS = 5 * 60;

export const storage = {
  async put(key: string, body: Buffer, contentType: string) {
    const { client, Bucket } = bucket();
    await client.send(
      new PutObjectCommand({
        Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition: "inline",
        CacheControl: "private, max-age=300",
      }),
    );
  },

  async remove(key: string) {
    const { client, Bucket } = bucket();
    await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
  },

  signedUrl(key: string) {
    const { client, Bucket } = bucket();
    return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), {
      expiresIn: SIGNED_URL_SECONDS,
    });
  },

  async ping() {
    const { client, Bucket } = bucket();
    await client.send(new HeadBucketCommand({ Bucket }));
  },
};
