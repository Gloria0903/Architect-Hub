import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const REQUIRED_ENV = ["AWS_REGION", "AWS_S3_BUCKET"] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.warn(`[s3] Missing required env var: ${key}`);
  }
}

// Lazy initialization helpers to prevent throwing errors at build time
function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured.");
  }
  return bucket;
}

let s3Instance: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Instance) return s3Instance;

  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION is not configured.");
  }

  s3Instance = new S3Client({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  return s3Instance;
}

/**
 * Proxy object export for backwards compatibility with `s3.send()`
 */
export const s3 = new Proxy({} as S3Client, {
  get(_target, prop) {const client = getS3Client();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Builds a unique S3 key for a project document.
 *
 * Example:
 * projects/project-id/documents/uuid.pdf
 */
export function buildDocumentKey(
  projectId: string,
  originalFileName: string
): string {
  const ext = originalFileName.includes(".")
    ? originalFileName.slice(originalFileName.lastIndexOf("."))
    : "";

  return `projects/${projectId}/documents/${randomUUID()}${ext}`;
}

/**
 * Creates a presigned PUT URL for direct browser -> S3 uploads.
 */
export async function getUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
    ServerSideEncryption: "AES256",
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
}

/**
 * Creates a short-lived presigned GET URL for downloading a document.
 */
export async function getDownloadUrl(
  key: string,
  downloadFileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,

    ...(downloadFileName
      ? {
          ResponseContentDisposition: `attachment; filename="${downloadFileName}"`,
        }
      : {}),
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
}

/**
 * Deletes an object from S3.
 */
export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

/**
 * Uploads a Buffer directly to S3.
 *
 * Used by storage.ts when the server has already received
 * and validated the uploaded file.
 */
export async function putObjectBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  if (!buffer || buffer.length === 0) {
    throw new Error(`Cannot upload empty buffer to S3: ${key}`);
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
      ContentLength: buffer.length,
      ServerSideEncryption: "AES256",
    })
  );
}

/**
 * Downloads an object from S3 and returns it as a Buffer.
 *
 * Uses transformToByteArray(), which is supported by the AWS SDK v3
 * response body and avoids manually handling Node.js streams.
 */
export async function getObjectBuffer(
  key: string
): Promise<Buffer> {
  const result = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );

  if (!result.Body) {
    throw new Error(
      `S3 returned an empty response for object: ${key}`
    );
  }

  const bytes = await result.Body.transformToByteArray();

  return Buffer.from(bytes);
}