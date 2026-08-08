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
    // Fail loudly at import time in dev; in prod this should never happen
    // because the platform config validates env before boot.
    // eslint-disable-next-line no-console
    console.warn(`[s3] Missing required env var: ${key}`);
  }
}

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  // If AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are unset, the SDK falls
  // back to the default provider chain (IAM role, EC2/ECS metadata, etc).
  // This is the preferred path in production — do not hardcode keys there.
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const BUCKET = process.env.AWS_S3_BUCKET as string;
const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes to complete an upload/download

/**
 * Builds a namespaced object key so files are organized and collisions
 * across projects are impossible. Keeping the original extension helps
 * S3 console browsing and content-type inference on GET.
 */
export function buildDocumentKey(projectId: string, originalFileName: string) {
  const ext = originalFileName.includes(".")
    ? originalFileName.slice(originalFileName.lastIndexOf("."))
    : "";
  return `projects/${projectId}/documents/${randomUUID()}${ext}`;
}

/**
 * Returns a presigned PUT URL the browser can upload directly to, so file
 * bytes never pass through our app server (avoids Next.js body size limits
 * and doubles our effective upload throughput).
 */
export async function getUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
}) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
    ServerSideEncryption: "AES256",
  });
  const url = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  return url;
}

/**
 * Returns a short-lived presigned GET URL for previewing/downloading a
 * document. We never store or expose permanent public S3 URLs — every
 * access is time-boxed and requires the caller to already be authorized
 * to view the project (checked before this is called).
 */
export async function getDownloadUrl(key: string, downloadFileName?: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(downloadFileName
      ? { ResponseContentDisposition: `attachment; filename="${downloadFileName}"` }
      : {}),
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
