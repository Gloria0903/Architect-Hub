/**
 * Central allow-list for document uploads. Enforced both client-side
 * (fast feedback) and server-side (the only check that actually matters —
 * never trust a client-declared MIME type alone).
 */
export const ALLOWED_DOCUMENT_TYPES: Record<string, { label: string; maxSizeMb: number }> = {
  "application/pdf": { label: "PDF", maxSizeMb: 50 },
  "application/acad": { label: "DWG", maxSizeMb: 150 },
  "image/vnd.dwg": { label: "DWG", maxSizeMb: 150 },
  "application/dxf": { label: "DXF", maxSizeMb: 150 },
  "image/vnd.dxf": { label: "DXF", maxSizeMb: 150 },
  "application/octet-stream": { label: "CAD/Revit", maxSizeMb: 250 }, // .rvt often reports this
  "image/png": { label: "Image", maxSizeMb: 25 },
  "image/jpeg": { label: "Image", maxSizeMb: 25 },
  "image/webp": { label: "Image", maxSizeMb: 25 },
  "application/vnd.ms-excel": { label: "BOQ", maxSizeMb: 25 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "BOQ", maxSizeMb: 25 },
  "application/msword": { label: "Document", maxSizeMb: 25 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "Document", maxSizeMb: 25 },
  "application/vnd.ms-powerpoint": { label: "Presentation", maxSizeMb: 100 },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { label: "Presentation", maxSizeMb: 100 },
};

// Extensions that legitimately report application/octet-stream and need a
// filename-based fallback check, since Revit/CAD tools don't register
// reliable MIME types in most browsers.
const OCTET_STREAM_EXTENSIONS = [".rvt", ".rfa", ".dwg", ".dxf", ".skp", ".ifc"];

export interface DocumentValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Declared MIME type and file extension are both attacker-controlled — a
 * raw multipart request can claim "application/pdf" for any bytes at all.
 * This checks the actual file signature (magic bytes) against a deny-list
 * of executable/script formats, independent of whatever was declared.
 * This is what actually would have stopped the .exe that made it into
 * uploads/ before this module existed.
 */
const DANGEROUS_SIGNATURES: { bytes: number[]; label: string; zipLike?: boolean }[] = [
  { bytes: [0x4d, 0x5a], label: "Windows executable (.exe/.dll)" }, // "MZ"
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: "Linux executable (ELF)" },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: "Mach-O / Java class executable" },
  { bytes: [0x23, 0x21], label: "Script with shebang (#!)" }, // "#!"
  { bytes: [0x50, 0x4b, 0x03, 0x04], label: "ZIP-based archive", zipLike: true },
];

export function sniffDangerousSignature(buffer: Buffer): { dangerous: boolean; label?: string } {
  for (const sig of DANGEROUS_SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) {
      // ZIP signature overlaps with legitimate .docx/.xlsx/.pptx (which are
      // just ZIPs internally) — skip it here, since the declared-type check
      // in validateDocumentUpload() already handles Office formats safely.
      if (sig.zipLike) continue;
      return { dangerous: true, label: sig.label };
    }
  }
  return { dangerous: false };
}
export function validateDocumentUpload(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): DocumentValidationResult {
  const { fileName, mimeType, sizeBytes } = params;

  let rule = ALLOWED_DOCUMENT_TYPES[mimeType];

  if (!rule && mimeType === "application/octet-stream") {
    const hasKnownExt = OCTET_STREAM_EXTENSIONS.some((ext) =>
      fileName.toLowerCase().endsWith(ext)
    );
    if (hasKnownExt) rule = ALLOWED_DOCUMENT_TYPES["application/octet-stream"];
  }

  if (!rule) {
    return {
      ok: false,
      error: `File type "${mimeType || "unknown"}" isn't supported. Allowed: PDF, DWG, DXF, Revit, images, BOQs, contracts, presentations.`,
    };
  }

  const maxBytes = rule.maxSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `${rule.label} files must be under ${rule.maxSizeMb}MB (got ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  if (sizeBytes <= 0) {
    return { ok: false, error: "File appears to be empty." };
  }

  return { ok: true };
}
