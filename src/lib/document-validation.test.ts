import { describe, expect, it } from "vitest";
import { sniffDangerousSignature, validateDocumentUpload } from "./document-validation";

describe("sniffDangerousSignature", () => {
  it("flags a Windows PE executable by its MZ header", () => {
    // This is the exact signature of the .exe that was committed to
    // uploads/ before this check existed.
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const result = sniffDangerousSignature(buffer);
    expect(result.dangerous).toBe(true);
    expect(result.label).toMatch(/Windows executable/i);
  });

  it("flags a Linux ELF binary", () => {
    const buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
    expect(sniffDangerousSignature(buffer).dangerous).toBe(true);
  });

  it("flags a shell script with a shebang", () => {
    const buffer = Buffer.from("#!/bin/bash\necho hi");
    expect(sniffDangerousSignature(buffer).dangerous).toBe(true);
  });

  it("does not flag a real PDF", () => {
    const buffer = Buffer.from("%PDF-1.4\n%...");
    expect(sniffDangerousSignature(buffer).dangerous).toBe(false);
  });

  it("does not flag ZIP-based Office formats (.docx/.xlsx/.pptx)", () => {
    // These share the ZIP signature; the declared-type allow-list is the
    // real gate for these, not the byte sniff.
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(sniffDangerousSignature(buffer).dangerous).toBe(false);
  });

  it("does not flag an empty or tiny buffer", () => {
    expect(sniffDangerousSignature(Buffer.from([])).dangerous).toBe(false);
    expect(sniffDangerousSignature(Buffer.from([0x00])).dangerous).toBe(false);
  });
});

describe("validateDocumentUpload", () => {
  it("accepts a PDF within size limits", () => {
    const result = validateDocumentUpload({
      fileName: "site-report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5 * 1024 * 1024,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unrecognized MIME type", () => {
    const result = validateDocumentUpload({
      fileName: "payload.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/isn't supported/i);
  });

  it("rejects octet-stream unless the filename has a known CAD/Revit extension", () => {
    const disguised = validateDocumentUpload({
      fileName: "payload.exe",
      mimeType: "application/octet-stream",
      sizeBytes: 1024,
    });
    expect(disguised.ok).toBe(false);

    const legit = validateDocumentUpload({
      fileName: "floor-plan.rvt",
      mimeType: "application/octet-stream",
      sizeBytes: 1024,
    });
    expect(legit.ok).toBe(true);
  });

  it("rejects files over the type's size limit", () => {
    const result = validateDocumentUpload({
      fileName: "huge.pdf",
      mimeType: "application/pdf",
      sizeBytes: 51 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/under 50MB/);
  });

  it("rejects empty files", () => {
    const result = validateDocumentUpload({
      fileName: "empty.pdf",
      mimeType: "application/pdf",
      sizeBytes: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });
});
