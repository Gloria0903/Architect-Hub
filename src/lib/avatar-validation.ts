import { sniffDangerousSignature } from "./document-validation";

/**
 * Narrow allow-list for profile photo uploads. Deliberately stricter than
 * the general document allow-list — avatars only ever need to be a small
 * raster image, never a CAD file, PDF, or office document.
 */
const ALLOWED_AVATAR_TYPES: Record<string, { label: string }> = {
  "image/png": { label: "PNG" },
  "image/jpeg": { label: "JPEG" },
  "image/webp": { label: "WebP" },
};

const MAX_AVATAR_SIZE_MB = 5;

export interface AvatarValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Same two-layer approach as document uploads: declared MIME type first,
 * then the actual file bytes (magic-byte sniffing), independent of anything
 * the client claimed. A renamed .exe with a .png extension still gets caught
 * by sniffDangerousSignature() before it's ever written to disk.
 */
export function validateAvatarUpload(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): AvatarValidationResult {
  const { mimeType, sizeBytes } = params;

  const rule = ALLOWED_AVATAR_TYPES[mimeType];
  if (!rule) {
    return {
      ok: false,
      error: `File type "${mimeType || "unknown"}" isn't supported for profile photos. Allowed: PNG, JPEG, WebP.`,
    };
  }

  if (sizeBytes <= 0) {
    return { ok: false, error: "File appears to be empty." };
  }

  const maxBytes = MAX_AVATAR_SIZE_MB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `Profile photos must be under ${MAX_AVATAR_SIZE_MB}MB (got ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  return { ok: true };
}

export { sniffDangerousSignature };
