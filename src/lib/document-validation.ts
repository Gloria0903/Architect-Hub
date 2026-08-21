/**
 * Central validation for project/document uploads.
 *
 * IMPORTANT:
 * MIME types are not reliable for many architectural/CAD/BIM files.
 * Browsers frequently report files such as DWG, RVT, RFA, IFC and SKP
 * as application/octet-stream or another generic MIME type.
 *
 * Therefore validation uses:
 *
 * 1. File extension
 * 2. Declared MIME type
 * 3. File size
 * 4. Dangerous binary signature detection
 *
 * The server remains the final authority.
 */

export interface DocumentValidationResult {
  ok: boolean;
  error?: string;
}

interface DocumentTypeRule {
  label: string;
  maxSizeMb: number;
}

/**
 * MIME types that are explicitly recognized.
 *
 * Extension validation below is still used because many legitimate
 * architectural files have unreliable browser MIME types.
 */
export const ALLOWED_DOCUMENT_TYPES: Record<
  string,
  DocumentTypeRule
> = {
  // Documents
  "application/pdf": {
    label: "PDF",
    maxSizeMb: 100,
  },

  "application/msword": {
    label: "Word document",
    maxSizeMb: 50,
  },

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    {
      label: "Word document",
      maxSizeMb: 50,
    },

  "text/plain": {
    label: "Text",
    maxSizeMb: 25,
  },

  "application/rtf": {
    label: "Rich text document",
    maxSizeMb: 25,
  },

  // Spreadsheets
  "application/vnd.ms-excel": {
    label: "Excel spreadsheet",
    maxSizeMb: 50,
  },

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    {
      label: "Excel spreadsheet",
      maxSizeMb: 50,
    },

  "text/csv": {
    label: "CSV",
    maxSizeMb: 50,
  },

  // Presentations
  "application/vnd.ms-powerpoint": {
    label: "PowerPoint presentation",
    maxSizeMb: 100,
  },

  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    {
      label: "PowerPoint presentation",
      maxSizeMb: 100,
    },

  // Images
  "image/png": {
    label: "PNG image",
    maxSizeMb: 50,
  },

  "image/jpeg": {
    label: "JPEG image",
    maxSizeMb: 50,
  },

  "image/webp": {
    label: "WebP image",
    maxSizeMb: 50,
  },

  "image/gif": {
    label: "GIF image",
    maxSizeMb: 50,
  },

  "image/bmp": {
    label: "BMP image",
    maxSizeMb: 50,
  },

  "image/tiff": {
    label: "TIFF image",
    maxSizeMb: 100,
  },

  "image/svg+xml": {
    label: "SVG image",
    maxSizeMb: 25,
  },

  // Common CAD MIME types
  "application/acad": {
    label: "DWG",
    maxSizeMb: 250,
  },

  "image/vnd.dwg": {
    label: "DWG",
    maxSizeMb: 250,
  },

  "application/dxf": {
    label: "DXF",
    maxSizeMb: 250,
  },

  "image/vnd.dxf": {
    label: "DXF",
    maxSizeMb: 250,
  },

  // Generic binary files are handled through the extension allow-list.
  "application/octet-stream": {
    label: "Project file",
    maxSizeMb: 250,
  },

  // Archives
  "application/zip": {
    label: "ZIP archive",
    maxSizeMb: 250,
  },

  "application/x-7z-compressed": {
    label: "7-Zip archive",
    maxSizeMb: 250,
  },

  "application/vnd.rar": {
    label: "RAR archive",
    maxSizeMb: 250,
  },

  // Data
  "application/json": {
    label: "JSON",
    maxSizeMb: 25,
  },

  "application/xml": {
    label: "XML",
    maxSizeMb: 25,
  },

  "text/xml": {
    label: "XML",
    maxSizeMb: 25,
  },
};

/**
 * Extension-based rules.
 *
 * This is essential because Windows/browser combinations commonly report
 * CAD/BIM files as application/octet-stream.
 */
const ALLOWED_EXTENSIONS: Record<string, DocumentTypeRule> = {
  // CAD / BIM
  ".dwg": {
    label: "DWG",
    maxSizeMb: 250,
  },

  ".dxf": {
    label: "DXF",
    maxSizeMb: 250,
  },

  ".rvt": {
    label: "Revit project",
    maxSizeMb: 500,
  },

  ".rfa": {
    label: "Revit family",
    maxSizeMb: 250,
  },

  ".rte": {
    label: "Revit template",
    maxSizeMb: 500,
  },

  ".ifc": {
    label: "IFC model",
    maxSizeMb: 500,
  },

  ".ifczip": {
    label: "Compressed IFC model",
    maxSizeMb: 500,
  },

  ".skp": {
    label: "SketchUp model",
    maxSizeMb: 500,
  },

  ".3dm": {
    label: "Rhino model",
    maxSizeMb: 500,
  },

  ".dgn": {
    label: "MicroStation drawing",
    maxSizeMb: 250,
  },

  // Documents
  ".pdf": {
    label: "PDF",
    maxSizeMb: 100,
  },

  ".doc": {
    label: "Word document",
    maxSizeMb: 50,
  },

  ".docx": {
    label: "Word document",
    maxSizeMb: 50,
  },

  ".txt": {
    label: "Text",
    maxSizeMb: 25,
  },

  ".rtf": {
    label: "Rich text document",
    maxSizeMb: 25,
  },

  // Spreadsheets
  ".xls": {
    label: "Excel spreadsheet",
    maxSizeMb: 50,
  },

  ".xlsx": {
    label: "Excel spreadsheet",
    maxSizeMb: 50,
  },

  ".csv": {
    label: "CSV",
    maxSizeMb: 50,
  },

  // Presentations
  ".ppt": {
    label: "PowerPoint presentation",
    maxSizeMb: 100,
  },

  ".pptx": {
    label: "PowerPoint presentation",
    maxSizeMb: 100,
  },

  // Images
  ".png": {
    label: "PNG image",
    maxSizeMb: 50,
  },

  ".jpg": {
    label: "JPEG image",
    maxSizeMb: 50,
  },

  ".jpeg": {
    label: "JPEG image",
    maxSizeMb: 50,
  },

  ".webp": {
    label: "WebP image",
    maxSizeMb: 50,
  },

  ".gif": {
    label: "GIF image",
    maxSizeMb: 50,
  },

  ".bmp": {
    label: "BMP image",
    maxSizeMb: 50,
  },

  ".tif": {
    label: "TIFF image",
    maxSizeMb: 100,
  },

  ".tiff": {
    label: "TIFF image",
    maxSizeMb: 100,
  },

  ".svg": {
    label: "SVG image",
    maxSizeMb: 25,
  },

  // Adobe / design source files
  ".ai": {
    label: "Adobe Illustrator file",
    maxSizeMb: 100,
  },

  ".eps": {
    label: "EPS artwork",
    maxSizeMb: 100,
  },

  ".psd": {
    label: "Photoshop file",
    maxSizeMb: 500,
  },

  // Archives
  ".zip": {
    label: "ZIP archive",
    maxSizeMb: 250,
  },

  ".7z": {
    label: "7-Zip archive",
    maxSizeMb: 250,
  },

  ".rar": {
    label: "RAR archive",
    maxSizeMb: 250,
  },

  // Project video / site walk-throughs
  ".mp4": {
    label: "MP4 video",
    maxSizeMb: 500,
  },

  ".mov": {
    label: "MOV video",
    maxSizeMb: 500,
  },

  ".webm": {
    label: "WebM video",
    maxSizeMb: 500,
  },

  // Data / project exports
  ".json": {
    label: "JSON",
    maxSizeMb: 25,
  },

  ".xml": {
    label: "XML",
    maxSizeMb: 25,
  },
};

/**
 * Extensions that must NEVER be accepted.
 *
 * These are explicitly blocked even if somebody tries to disguise them
 * with a generic MIME type.
 */
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".msi",
  ".com",
  ".scr",
  ".bat",
  ".cmd",
  ".ps1",
  ".psm1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".sh",
  ".bash",
  ".zsh",
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".cgi",
]);

/**
 * Dangerous binary signatures.
 *
 * These checks are independent of the filename and MIME type.
 */
const DANGEROUS_SIGNATURES: {
  bytes: number[];
  label: string;
}[] = [
  // Windows PE executable
  {
    bytes: [0x4d, 0x5a],
    label: "Windows executable (.exe/.dll)",
  },

  // Linux ELF executable
  {
    bytes: [0x7f, 0x45, 0x4c, 0x46],
    label: "Linux executable (ELF)",
  },

  // Mach-O / Java class signature
  {
    bytes: [0xca, 0xfe, 0xba, 0xbe],
    label: "Mach-O / Java executable",
  },

  // Script beginning with #!
  {
    bytes: [0x23, 0x21],
    label: "script with shebang (#!)",
  },
];

/**
 * Check the first bytes of a file for dangerous executable signatures.
 */
export function sniffDangerousSignature(
  buffer: Buffer
): {
  dangerous: boolean;
  label?: string;
} {
  for (const signature of DANGEROUS_SIGNATURES) {
    if (
      signature.bytes.every(
        (byte, index) => buffer[index] === byte
      )
    ) {
      return {
        dangerous: true,
        label: signature.label,
      };
    }
  }

  return {
    dangerous: false,
  };
}

/**
 * Validate an uploaded project/document file.
 */
export function validateDocumentUpload(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): DocumentValidationResult {
  const fileName = params.fileName.trim();
  const mimeType =
    params.mimeType.trim().toLowerCase();
  const sizeBytes = params.sizeBytes;

  if (!fileName) {
    return {
      ok: false,
      error: "A file name is required.",
    };
  }

  if (sizeBytes <= 0) {
    return {
      ok: false,
      error: "File appears to be empty.",
    };
  }

  const lowerName = fileName.toLowerCase();

  /**
   * Extract the final extension.
   */
  const lastDot = lowerName.lastIndexOf(".");
  const extension =
    lastDot >= 0
      ? lowerName.slice(lastDot)
      : "";

  /**
   * Block executable/script extensions before doing anything else.
   */
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: `Files with the "${extension}" extension are not allowed for security reasons.`,
    };
  }

  /**
   * Prefer the extension rule because it is more reliable for CAD/BIM
   * files than browser MIME detection.
   */
  const extensionRule =
    ALLOWED_EXTENSIONS[extension];

  /**
   * If the extension is known, validate against that rule.
   */
  if (extensionRule) {
    const maxBytes =
      extensionRule.maxSizeMb *
      1024 *
      1024;

    if (sizeBytes > maxBytes) {
      return {
        ok: false,
        error: `${extensionRule.label} files must be under ${extensionRule.maxSizeMb}MB (got ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
      };
    }

    return {
      ok: true,
    };
  }

  /**
   * If there is no recognized extension, fall back to the MIME type.
   */
  const mimeRule =
    ALLOWED_DOCUMENT_TYPES[mimeType];

  if (!mimeRule) {
    return {
      ok: false,
      error:
        `File type "${mimeType || "unknown"}" isn't supported. ` +
        "Supported project files include CAD/BIM, PDF, Office documents, " +
        "spreadsheets, presentations, images, archives, JSON and XML.",
    };
  }

  const maxBytes =
    mimeRule.maxSizeMb * 1024 * 1024;

  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `${mimeRule.label} files must be under ${mimeRule.maxSizeMb}MB (got ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  return {
    ok: true,
  };
}
