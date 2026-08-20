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

const AWS_REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

if (!AWS_REGION) {
  throw new Error("AWS_REGION is not configured.");
}

if (!BUCKET) {
  throw new Error("AWS_S3_BUCKET is not configured.");
}

/**
 * AWS S3 client.
 *
 * If explicit AWS credentials are provided, they are used.
 * Otherwise, AWS SDK falls back to its default credential provider chain
 * such as IAM roles in production.
 */
export const s3 = new S3Client({
  region: AWS_REGION,

  credentials:
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
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
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
    ServerSideEncryption: "AES256",
  });

  return getSignedUrl(s3, command, {
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
    Bucket: BUCKET,
    Key: key,

    ...(downloadFileName
      ? {
          ResponseContentDisposition: `attachment; filename="${downloadFileName}"`,
        }
      : {}),
  });

  return getSignedUrl(s3, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
}

/**
 * Deletes an object from S3.
 */
export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
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

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
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
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
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