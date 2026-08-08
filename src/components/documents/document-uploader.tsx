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
  status: "pending" | "uploading" | "confirming" | "done" | "error";
  error?: string;
}

const ACCEPT_ATTR = Object.keys(ALLOWED_DOCUMENT_TYPES).join(",");

/**
 * Uploads directly to S3 via a presigned URL (XHR, not fetch, so we get
 * upload progress events), then confirms with our API to create the
 * Document row. Two-phase by design: if the S3 PUT fails, no DB row is
 * ever created, so the document list never shows a "ghost" upload.
 */
export function DocumentUploader({ target, onComplete, onError }: DocumentUploaderProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (file: File) => {
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
        const presignUrl =
          target.mode === "new"
            ? `/api/projects/${target.projectId}/documents/presign`
            : `/api/documents/${target.documentId}/versions/presign`;

        const presignRes = await fetch(presignUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });

        if (!presignRes.ok) {
          const { error } = await presignRes.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(error || "Could not start upload");
        }

        const { uploadUrl, key } = await presignRes.json();

        setQueue((q) =>
          q.map((item) => (item.file === file ? { ...item, status: "uploading" } : item))
        );

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const progress = Math.round((e.loaded / e.total) * 100);
            setQueue((q) => q.map((item) => (item.file === file ? { ...item, progress } : item)));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload to storage failed (${xhr.status})`));
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(file);
        });

        setQueue((q) =>
          q.map((item) => (item.file === file ? { ...item, status: "confirming" } : item))
        );

        const confirmUrl =
          target.mode === "new"
            ? `/api/projects/${target.projectId}/documents`
            : `/api/documents/${target.documentId}/versions`;

        const confirmRes = await fetch(confirmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
            ...(target.mode === "new" ? { category: target.category } : {}),
          }),
        });

        if (!confirmRes.ok) {
          const { error } = await confirmRes.json().catch(() => ({ error: "Could not save document" }));
          throw new Error(error || "Could not save document");
        }

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
              {(item.status === "uploading" || item.status === "confirming") && (
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
