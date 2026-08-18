import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { putObjectBuffer, getObjectBuffer, deleteObject } from "@/lib/s3";

/**
 * Storage for uploaded documents and avatars. Automatically uses S3 the
 * moment AWS_S3_BUCKET and AWS_REGION are set in .env — no code changes
 * needed to go from local dev to production, just environment config.
 * Falls back to local disk when those aren't set, so local development
 * keeps working without every machine needing real AWS credentials.
 *
 * Callers (document/avatar routes) only ever deal with fileKey/fileSize —
 * this file is the only place that knows or cares which backend is active.
 */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const isS3Configured = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION);

if (!isS3Configured && process.env.NODE_ENV === "production") {

  console.warn(
    "[storage] AWS_S3_BUCKET/AWS_REGION not set in a production environment — " +
      "falling back to local disk. Uploaded files will NOT survive a redeploy " +
      "on most hosting platforms. Set both env vars to switch to S3."
  );
}

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

// Used to set a correct Content-Type in S3 when the browser didn't supply
// one (some CAD/Office formats report as octet-stream).
const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function saveUploadedFile(
  file: File,
  preReadBuffer?: Buffer
): Promise<{ fileKey: string; fileSize: number }> {
  const ext = path.extname(file.name);
  const fileKey = `${randomUUID()}${ext}`;
  const buffer = preReadBuffer ?? Buffer.from(await file.arrayBuffer());

  if (isS3Configured) {
    const contentType = file.type || EXT_TO_MIME[ext.toLowerCase()] || "application/octet-stream";
    await putObjectBuffer(fileKey, buffer, contentType);
  } else {
    await ensureDir();
    await fs.writeFile(path.join(UPLOAD_DIR, fileKey), buffer);
  }

  return { fileKey, fileSize: buffer.length };
}

export async function readStoredFile(fileKey: string): Promise<Buffer> {
  if (isS3Configured) {
    return getObjectBuffer(fileKey);
  }
  // Guard against path traversal — fileKey must not escape the upload dir.
  const safeName = path.basename(fileKey);
  return fs.readFile(path.join(UPLOAD_DIR, safeName));
}

export async function deleteStoredFile(fileKey: string): Promise<void> {
  if (isS3Configured) {
    try {
      await deleteObject(fileKey);
    } catch {
      // Object may already be gone — not fatal.
    }
    return;
  }
  const safeName = path.basename(fileKey);
  try {
    await fs.unlink(path.join(UPLOAD_DIR, safeName));
  } catch {
    // File may already be gone — not fatal.
  }
}