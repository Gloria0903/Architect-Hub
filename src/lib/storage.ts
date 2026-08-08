import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Local-disk storage for uploaded documents. In production this could be swapped
// for S3 / GCS by changing only this file — callers only deal with fileKey/fileUrl.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveUploadedFile(file: File, preReadBuffer?: Buffer): Promise<{ fileKey: string; fileSize: number }> {
  await ensureDir();
  const ext = path.extname(file.name);
  const fileKey = `${randomUUID()}${ext}`;
  const buffer = preReadBuffer ?? Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, fileKey), buffer);
  return { fileKey, fileSize: buffer.length };
}

export async function readStoredFile(fileKey: string): Promise<Buffer> {
  // Guard against path traversal — fileKey must not escape the upload dir.
  const safeName = path.basename(fileKey);
  return fs.readFile(path.join(UPLOAD_DIR, safeName));
}

export async function deleteStoredFile(fileKey: string): Promise<void> {
  const safeName = path.basename(fileKey);
  try {
    await fs.unlink(path.join(UPLOAD_DIR, safeName));
  } catch {
    // File may already be gone — not fatal.
  }
}
