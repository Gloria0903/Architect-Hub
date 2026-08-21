"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  ALLOWED_DOCUMENT_TYPES,
  validateDocumentUpload,
} from "@/lib/document-validation";

type UploadTarget =
  | { mode: "new"; projectId: string; category: string }
  | { mode: "version"; documentId: string };

interface DocumentUploaderProps {
  target: UploadTarget;
  onComplete: () => void | Promise<void>;
  onError?: (message: string) => void;
  buttonLabel?: string;
  multiple?: boolean;
  /** Show a drop zone around the button. Defaults to false so existing
   * inline usages (next to a select, etc.) don't suddenly grow a big box. */
  dropzone?: boolean;
}

interface UploadItem {
  id: string;
  name: string;
  status: "uploading" | "success" | "error";
  error?: string;
}

const ACCEPT_ATTR = [
  ...Object.keys(ALLOWED_DOCUMENT_TYPES),
  ".rvt",
  ".rfa",
  ".rte",
  ".dwg",
  ".dxf",
  ".skp",
  ".ifc",
  ".ifczip",
  ".dgn",
  ".3dm",
].join(",");

// Uploads can legitimately take a while (large CAD/BIM files, slow
// connections), but they must never hang forever and look like the button
// silently did nothing. If S3/the network stalls, this turns that into a
// visible error instead of an infinite spinner.
const UPLOAD_TIMEOUT_MS = 120_000;

function uploadUrl(target: UploadTarget): string {
  return target.mode === "new"
    ? "/api/documents"
    : `/api/documents/${target.documentId}/versions`;
}

function buildFormData(target: UploadTarget, file: File): FormData {
  const formData = new FormData();
  formData.append("file", file, file.name);

  if (target.mode === "new") {
    formData.append("projectId", target.projectId);
    formData.append("category", target.category);
  }

  return formData;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return { error: text || `Request failed with HTTP ${response.status}` };
}

function extractErrorMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string" && record.error) return record.error;
    if (typeof record.message === "string" && record.message)
      return record.message;
  }

  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403)
    return "You do not have permission to upload documents to this project.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 429) return "Too many uploads at once. Please wait a moment and try again.";

  return `Upload failed (HTTP ${status}). Please try again.`;
}

export function DocumentUploader({
  target,
  onComplete,
  onError,
  buttonLabel = "Upload files",
  multiple = true,
  dropzone = false,
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  const updateItem = useCallback(
    (id: string, update: Partial<UploadItem>) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...update } : item))
      );
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  /**
   * Upload a single file. Every branch either returns true/false or throws
   * inside a try/catch that reports the error — there is no path where this
   * can fail without the caller (and the user) finding out.
   */
  const uploadOne = useCallback(
    async (file: File, itemId: string): Promise<boolean> => {
      const validation = validateDocumentUpload({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      if (!validation.ok) {
        const message = validation.error || "This file cannot be uploaded.";
        updateItem(itemId, { status: "error", error: message });
        onError?.(message);
        return false;
      }

      if (file.size <= 0) {
        const message = `"${file.name}" is empty.`;
        updateItem(itemId, { status: "error", error: message });
        onError?.(message);
        return false;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      try {
        const response = await fetch(uploadUrl(target), {
          method: "POST",
          body: buildFormData(target, file),
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        const body = await parseResponseBody(response);

        if (!response.ok) {
          throw new Error(extractErrorMessage(response.status, body));
        }

        if (typeof body !== "object" || body === null || !("id" in body)) {
          throw new Error(
            "The server accepted the upload but did not return a document record."
          );
        }

        updateItem(itemId, { status: "success", error: undefined });
        return true;
      } catch (error) {
        const message =
          error instanceof Error && error.name === "AbortError"
            ? "Upload timed out. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Upload failed. Please try again.";

        console.error("[DocumentUploader] Upload failed:", {
          file: file.name,
          error,
        });

        updateItem(itemId, { status: "error", error: message });
        onError?.(message);
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [onError, target, updateItem]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[] | null) => {
      try {
        onError?.("");

        if (!fileList) return;

        const files = Array.from(fileList);
        if (files.length === 0) return;

        // Visible feedback the instant files are chosen — before any
        // validation or network call — so a picked file is never silently
        // dropped.
        const newItems: UploadItem[] = files.map((file, index) => ({
          id: `${Date.now()}-${index}-${file.name}`,
          name: file.name,
          status: "uploading",
        }));

        setItems((current) => [...current, ...newItems]);
        setUploading(true);

        let successful = 0;

        for (let i = 0; i < files.length; i++) {
          const ok = await uploadOne(files[i], newItems[i].id);
          if (ok) successful++;
        }

        if (successful > 0) {
          try {
            await onComplete();
          } catch (refreshError) {
            console.error(
              "[DocumentUploader] Refresh after upload failed:",
              refreshError
            );
          }
        }
      } catch (error) {
        // Last-resort net: nothing above should throw past uploadOne's own
        // try/catch, but if something unexpected does, surface it instead
        // of letting it vanish as an unhandled rejection.
        const message =
          error instanceof Error ? error.message : "Something went wrong while uploading.";
        console.error("[DocumentUploader] Unexpected failure:", error);
        onError?.(message);
      } finally {
        setUploading(false);
      }
    },
    [onComplete, onError, uploadOne]
  );

  const openPicker = useCallback(() => {
    if (uploading) return;
    const el = inputRef.current;
    if (!el) {
      console.error("[DocumentUploader] File input ref is not attached.");
      onError?.("Could not open the file picker. Please reload the page and try again.");
      return;
    }
    el.value = "";
    el.click();
  }, [uploading, onError]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.currentTarget.files;
      void handleFiles(files);
      event.currentTarget.value = "";
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (uploading) return;
      void handleFiles(event.dataTransfer.files);
    },
    [handleFiles, uploading]
  );

  const pickerButton = (
    <div className="flex items-center gap-2">
      <Button type="button" onClick={openPicker} disabled={uploading} className="gap-2">
        {uploading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Upload size={15} />
        )}
        {uploading ? "Uploading..." : buttonLabel}
      </Button>

      <input
        ref={inputRef}
        type="file"
        multiple={target.mode === "new" ? multiple : false}
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={handleInputChange}
        disabled={uploading}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {dropzone ? (
        <div
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`cursor-pointer rounded-md border border-dashed p-6 text-center transition-colors ${
            dragging ? "border-blueprint bg-blueprint-bg" : "border-line"
          } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <Upload size={22} className="mx-auto mb-2 text-muted" />
          <p className="text-[12.5px] font-medium text-ink">
            {uploading ? "Uploading…" : dragging ? "Drop files here" : "Drag and drop files, or click to browse"}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple={target.mode === "new" ? multiple : false}
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={handleInputChange}
            disabled={uploading}
          />
        </div>
      ) : (
        pickerButton
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-ink">{item.name}</p>

                {item.status === "uploading" && (
                  <p className="mt-0.5 text-[11px] text-muted">Uploading...</p>
                )}

                {item.status === "success" && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-moss">
                    <CheckCircle2 size={12} />
                    Uploaded successfully
                  </p>
                )}

                {item.status === "error" && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-brick">
                    <AlertTriangle size={12} />
                    {item.error || "Upload failed."}
                  </p>
                )}
              </div>

              {item.status === "uploading" && (
                <Loader2 size={15} className="shrink-0 animate-spin text-blueprint" />
              )}

              {item.status === "success" && (
                <CheckCircle2 size={16} className="shrink-0 text-moss" />
              )}

              {item.status === "error" && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 text-muted hover:text-brick"
                  aria-label={`Remove ${item.name}`}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
