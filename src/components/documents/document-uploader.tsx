"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ALLOWED_DOCUMENT_TYPES,
  validateDocumentUpload,
} from "@/lib/document-validation";

type UploadTarget =
  | { mode: "new"; projectId: string; category: string }
  | { mode: "version"; documentId: string };

interface DocumentUploaderProps {
  target: UploadTarget;
  onComplete: () => void;
  onError?: (message: string) => void;
}

interface QueuedFile {
  file: File;
  progress: number; // 0-100
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const ACCEPT_ATTR = Object.keys(ALLOWED_DOCUMENT_TYPES).join(",");

/**
 * Uploads via a single multipart POST straight to /api/documents (new) or
 * /api/documents/:id/versions (new version) — one request, not a
 * presign-then-confirm dance. This is deliberate: those routes do
 * server-side magic-byte sniffing on the real file bytes
 * (sniffDangerousSignature in document-validation.ts), which only works
 * because the bytes pass through our server. A direct-to-storage
 * presigned upload would skip that check entirely.
 *
 * XHR (not fetch) is used only so we get upload progress events — fetch
 * still can't report upload progress for a request body.
 */
export function DocumentUploader({ target, onComplete, onError }: DocumentUploaderProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (file: File) => {
      // Fast client-side feedback only — the server repeats this check
      // (and the magic-byte sniff) against the real bytes regardless.
      const validation = validateDocumentUpload({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!validation.ok) {
        setQueue((q) =>
          q.map((item) =>
            item.file === file ? { ...item, status: "error", error: validation.error } : item
          )
        );
        onError?.(validation.error!);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (target.mode === "new") {
          formData.append("projectId", target.projectId);
          formData.append("category", target.category);
        }

        const url =
          target.mode === "new"
            ? "/api/documents"
            : `/api/documents/${target.documentId}/versions`;

        setQueue((q) =>
          q.map((item) => (item.file === file ? { ...item, status: "uploading" } : item))
        );

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const progress = Math.round((e.loaded / e.total) * 100);
            setQueue((q) => q.map((item) => (item.file === file ? { ...item, progress } : item)));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
              return;
            }
            let message = "Upload failed";
            try {
              const body = JSON.parse(xhr.responseText);
              if (body?.error) message = body.error;
            } catch {
              // response wasn't JSON — fall back to the generic message
            }
            reject(new Error(message));
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(formData);
        });

        setQueue((q) =>
          q.map((item) => (item.file === file ? { ...item, status: "done", progress: 100 } : item))
        );
        onComplete();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setQueue((q) =>
          q.map((item) => (item.file === file ? { ...item, status: "error", error: message } : item))
        );
        onError?.(message);
      }
    },
    [target, onComplete, onError]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const incoming: QueuedFile[] = Array.from(files).map((file) => ({
        file,
        progress: 0,
        status: "pending",
      }));
      setQueue((q) => [...q, ...incoming]);
      incoming.forEach((item) => uploadOne(item.file));
    },
    [uploadOne]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">
          PDF, DWG, DXF, Revit, images, BOQs, contracts, presentations
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={target.mode === "new"}
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((item, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.file.name}</p>
                {item.status === "error" ? (
                  <p className="text-xs text-destructive">{item.error}</p>
                ) : item.status === "done" ? (
                  <p className="text-xs text-emerald-600">Uploaded</p>
                ) : (
                  <Progress value={item.progress} className="h-1.5 mt-1" />
                )}
              </div>
              {item.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {item.status === "error" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}