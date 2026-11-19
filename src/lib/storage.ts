import "server-only";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { del as blobDelete, get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";
import { env } from "./env";
import { BusinessRuleError, NotFoundError } from "./errors";

/**
 * Private object storage for complaint photos (ADR-011, ADR-022).
 *
 * Two interchangeable backends behind one interface:
 * - Vercel Blob with private access (when BLOB_READ_WRITE_TOKEN is set), used on Vercel;
 * - any S3 API (Cloudflare R2, AWS S3, MinIO) for self-hosting.
 *
 * Files are never public: the app streams them to the browser only after the
 * same access check as the complaint they belong to.
 */
export type StoredFile = { body: ReadableStream<Uint8Array>; contentType: string };

interface Backend {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  open(key: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
  ping(): Promise<void>;
}

class BlobBackend implements Backend {
  constructor(private readonly token: string) {}

  async put(key: string, body: Buffer, contentType: string) {
    await blobPut(key, body, { access: "private", contentType, token: this.token, addRandomSuffix: false });
  }

  async open(key: string): Promise<StoredFile> {
    const result = await blobGet(key, { access: "private", token: this.token });
    if (!result?.stream) throw new NotFoundError("Image not found.");
    return { body: result.stream, contentType: result.blob.contentType ?? "image/webp" };
  }

  async remove(key: string) {
    await blobDelete(key, { token: this.token });
  }

  async ping() {
    await blobList({ limit: 1, token: this.token });
  }
}

class S3Backend implements Backend {
  private readonly client: S3Client;

  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async open(key: string): Promise<StoredFile> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!object.Body) throw new NotFoundError("Image not found.");
    return {
      body: Readable.toWeb(object.Body as Readable) as ReadableStream<Uint8Array>,
      contentType: object.ContentType ?? "image/webp",
    };
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async ping() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

const backend: Backend | null = env.BLOB_READ_WRITE_TOKEN
  ? new BlobBackend(env.BLOB_READ_WRITE_TOKEN)
  : env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? new S3Backend(env.S3_BUCKET)
    : null;

export const storageEnabled = backend !== null;

function use(): Backend {
  if (!backend) throw new BusinessRuleError("Photo uploads are not set up on this server yet.", "storage-disabled");
  return backend;
}

export const storage = {
  put: (key: string, body: Buffer, contentType: string) => use().put(key, body, contentType),
  open: (key: string) => use().open(key),
  remove: (key: string) => use().remove(key),
  ping: () => use().ping(),
};
