import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  putObjectBuffer,
  getObjectBuffer,
  deleteObject,
} from "@/lib/s3";

/**
 * Storage for uploaded documents and avatars.
 *
 * S3 is used when AWS_S3_BUCKET and AWS_REGION are configured.
 * Otherwise files are stored locally in /uploads.
 *
 * Documents can provide a relative storage directory such as:
 *
 *   projects/<projectId>/documents
 *
 * The generated fileKey is always returned to the caller and is the
 * canonical identifier used for subsequent downloads/deletes.
 */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const isS3Configured = Boolean(
  process.env.AWS_S3_BUCKET &&
    process.env.AWS_REGION
);

if (
  !isS3Configured &&
  process.env.NODE_ENV === "production"
) {
  console.warn(
    "[storage] AWS_S3_BUCKET/AWS_REGION not set in a production environment. " +
      "Falling back to local disk. Uploaded files will NOT survive a redeploy " +
      "on most hosting platforms. Set both env vars to switch to S3."
  );
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, {
    recursive: true,
  });
}

// Used when the browser supplies a generic MIME type.
const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

/**
 * Normalise a relative storage directory.
 *
 * Prevents callers from escaping the storage root through paths such as:
 *
 *   ../../somewhere
 */
function safeStorageDirectory(
  directory?: string
): string {
  if (!directory) {
    return "";
  }

  const normalised = directory
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const parts = normalised
    .split("/")
    .filter(Boolean);

  if (
    parts.some(
      (part) =>
        part === "." ||
        part === ".."
    )
  ) {
    throw new Error(
      "Invalid storage directory."
    );
  }

  return parts.join("/");
}

/**
 * Save an uploaded file.
 *
 * directory is optional for backwards compatibility.
 *
 * Example:
 *
 *   saveUploadedFile(
 *     file,
 *     buffer,
 *     `projects/${projectId}/documents`
 *   )
 */
export async function saveUploadedFile(
  file: File,
  preReadBuffer?: Buffer,
  directory?: string
): Promise<{
  fileKey: string;
  fileSize: number;
}> {
  const safeDirectory =
    safeStorageDirectory(directory);

  const ext = path
    .extname(file.name)
    .toLowerCase();

  const generatedName =
    `${randomUUID()}${ext}`;

  const fileKey = safeDirectory
    ? `${safeDirectory}/${generatedName}`
    : generatedName;

  const buffer =
    preReadBuffer ??
    Buffer.from(
      await file.arrayBuffer()
    );

  if (buffer.length === 0) {
    throw new Error(
      "Cannot save an empty file."
    );
  }

  if (isS3Configured) {
    const contentType =
      file.type ||
      EXT_TO_MIME[ext] ||
      "application/octet-stream";

    await putObjectBuffer(
      fileKey,
      buffer,
      contentType
    );
  } else {
    const localPath =
      path.join(
        UPLOAD_DIR,
        fileKey
      );

    await ensureDir(
      path.dirname(localPath)
    );

    await fs.writeFile(
      localPath,
      buffer
    );
  }

  return {
    fileKey,
    fileSize: buffer.length,
  };
}

/**
 * Read a stored file.
 */
export async function readStoredFile(
  fileKey: string
): Promise<Buffer> {
  if (!fileKey) {
    throw new Error(
      "File key is required."
    );
  }

  if (isS3Configured) {
    return getObjectBuffer(
      fileKey
    );
  }

  const normalised =
    fileKey.replace(/\\/g, "/");

  const parts = normalised
    .split("/")
    .filter(Boolean);

  if (
    parts.some(
      (part) =>
        part === "." ||
        part === ".."
    )
  ) {
    throw new Error(
      "Invalid file key."
    );
  }

  const localPath =
    path.join(
      UPLOAD_DIR,
      ...parts
    );

  return fs.readFile(
    localPath
  );
}

/**
 * Delete a stored file.
 */
export async function deleteStoredFile(
  fileKey: string
): Promise<void> {
  if (!fileKey) {
    return;
  }

  if (isS3Configured) {
    try {
      await deleteObject(
        fileKey
      );
    } catch {
      // Object may already be gone.
    }

    return;
  }

  const normalised =
    fileKey.replace(/\\/g, "/");

  const parts = normalised
    .split("/")
    .filter(Boolean);

  if (
    parts.some(
      (part) =>
        part === "." ||
        part === ".."
    )
  ) {
    return;
  }

  const localPath =
    path.join(
      UPLOAD_DIR,
      ...parts
    );

  try {
    await fs.unlink(
      localPath
    );
  } catch {
    // File may already be gone.
  }
}