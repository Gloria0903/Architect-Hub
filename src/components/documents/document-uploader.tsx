"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  X,
} from "lucide-react";

import {
  ALLOWED_DOCUMENT_TYPES,
  validateDocumentUpload,
} from "@/lib/document-validation";
import { notifyFilePickerOpening } from "@/lib/file-picker-guard";

type UploadTarget =
  | {
      mode: "new";
      projectId: string;
      category: string;
      /** Links the upload to a specific daily log entry (optional). */
      dailyLogId?: string;
    }
  | {
      mode: "version";
      documentId: string;
    };

interface DocumentUploaderProps {
  target: UploadTarget;
  onComplete: () => void | Promise<void>;
  onError?: (message: string) => void;
  multiple?: boolean;

  /**
   * Kept for compatibility with existing pages.
   *
   * The uploader is now ALWAYS rendered as a drag-and-drop zone.
   * This means both Documents and Daily Logs can safely pass:
   *
   * dropzone={true}
   *
   * without causing a TypeScript error.
   */
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

const UPLOAD_TIMEOUT_MS = 120_000;

function uploadUrl(target: UploadTarget): string {
  return target.mode === "new"
    ? "/api/documents"
    : `/api/documents/${target.documentId}/versions`;
}

function buildFormData(
  target: UploadTarget,
  file: File
): FormData {
  const formData = new FormData();

  formData.append(
    "file",
    file,
    file.name
  );

  if (target.mode === "new") {
    formData.append(
      "projectId",
      target.projectId
    );

    formData.append(
      "category",
      target.category
    );

    if (target.dailyLogId) {
      formData.append(
        "dailyLogId",
        target.dailyLogId
      );
    }
  }

  return formData;
}

async function parseResponseBody(
  response: Response
): Promise<unknown> {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return response
      .json()
      .catch(() => null);
  }

  const text =
    await response.text().catch(() => "");

  return {
    error:
      text ||
      `Request failed with HTTP ${response.status}`,
  };
}

function extractErrorMessage(
  status: number,
  body: unknown
): string {
  if (
    typeof body === "object" &&
    body !== null
  ) {
    const record =
      body as Record<string, unknown>;

    if (
      typeof record.error === "string" &&
      record.error
    ) {
      return record.error;
    }

    if (
      typeof record.message === "string" &&
      record.message
    ) {
      return record.message;
    }
  }

  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission to upload documents to this project.";
  }

  if (status === 413) {
    return "That file is too large to upload.";
  }

  if (status === 429) {
    return "Too many uploads at once. Please wait a moment and try again.";
  }

  return `Upload failed (HTTP ${status}). Please try again.`;
}

export function DocumentUploader({
  target,
  onComplete,
  onError,
  multiple = true,
  dropzone = true,
}: DocumentUploaderProps) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [uploading, setUploading] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [items, setItems] =
    useState<UploadItem[]>([]);

  const updateItem = useCallback(
    (
      id: string,
      update: Partial<UploadItem>
    ) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...update,
              }
            : item
        )
      );
    },
    []
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );
    },
    []
  );

  const uploadOne = useCallback(
    async (
      file: File,
      itemId: string
    ): Promise<boolean> => {
      const validation =
        validateDocumentUpload({
          fileName: file.name,
          mimeType:
            file.type ||
            "application/octet-stream",
          sizeBytes: file.size,
        });

      if (!validation.ok) {
        const message =
          validation.error ||
          "This file cannot be uploaded.";

        updateItem(itemId, {
          status: "error",
          error: message,
        });

        onError?.(message);

        return false;
      }

      if (file.size <= 0) {
        const message =
          `"${file.name}" is empty.`;

        updateItem(itemId, {
          status: "error",
          error: message,
        });

        onError?.(message);

        return false;
      }

      const controller =
        new AbortController();

      const timeout = setTimeout(
        () =>
          controller.abort(),
        UPLOAD_TIMEOUT_MS
      );

      try {
        const response =
          await fetch(
            uploadUrl(target),
            {
              method: "POST",
              body: buildFormData(
                target,
                file
              ),
              credentials:
                "same-origin",
              cache: "no-store",
              signal:
                controller.signal,
            }
          );

        const body =
          await parseResponseBody(
            response
          );

        if (!response.ok) {
          throw new Error(
            extractErrorMessage(
              response.status,
              body
            )
          );
        }

        if (
          typeof body !== "object" ||
          body === null ||
          !("id" in body)
        ) {
          throw new Error(
            "The server accepted the upload but did not return a document record."
          );
        }

        updateItem(itemId, {
          status: "success",
          error: undefined,
        });

        return true;
      } catch (error) {
        const message =
          error instanceof Error &&
          error.name === "AbortError"
            ? "Upload timed out. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Upload failed. Please try again.";

        console.error(
          "[DocumentUploader] Upload failed:",
          {
            file: file.name,
            error,
          }
        );

        updateItem(itemId, {
          status: "error",
          error: message,
        });

        onError?.(message);

        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [
      onError,
      target,
      updateItem,
    ]
  );

  const handleFiles =
    useCallback(
      async (
        fileList:
          | FileList
          | File[]
          | null
      ) => {
        if (!fileList) {
          return;
        }

        const files =
          Array.from(fileList);

        if (
          files.length === 0
        ) {
          return;
        }

        onError?.("");

        /*
         * Version uploads only accept one file.
         *
         * New document uploads can accept multiple
         * files when multiple=true.
         */
        const filesToUpload =
          target.mode === "version"
            ? files.slice(0, 1)
            : multiple
              ? files
              : files.slice(0, 1);

        const newItems =
          filesToUpload.map(
            (
              file,
              index
            ) => ({
              id: `${Date.now()}-${index}-${file.name}`,
              name: file.name,
              status:
                "uploading" as const,
            })
          );

        setItems((current) => [
          ...current,
          ...newItems,
        ]);

        setUploading(true);

        let successful = 0;

        try {
          for (
            let i = 0;
            i < filesToUpload.length;
            i++
          ) {
            const success =
              await uploadOne(
                filesToUpload[i],
                newItems[i].id
              );

            if (success) {
              successful++;
            }
          }

          /*
           * Refresh only after at least one
           * upload was successfully created.
           */
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
          const message =
            error instanceof Error
              ? error.message
              : "Something went wrong while uploading.";

          console.error(
            "[DocumentUploader] Unexpected failure:",
            error
          );

          onError?.(message);
        } finally {
          setUploading(false);
        }
      },
      [
        multiple,
        onComplete,
        onError,
        target.mode,
        uploadOne,
      ]
    );

  const openPicker =
    useCallback(() => {
      if (uploading) {
        return;
      }

      const input =
        inputRef.current;

      if (!input) {
        onError?.(
          "Could not open the file picker. Please reload the page and try again."
        );
        return;
      }

      /*
       * Reset the input so selecting the same
       * file again still triggers onChange.
       */
      input.value = "";

      // Tell AppProvider's focus-refresh listener to stand down for a
      // couple seconds â€” see src/lib/file-picker-guard.ts for why.
      notifyFilePickerOpening();

      input.click();
    }, [uploading, onError]);

  const handleInputChange =
    useCallback(
      (
        event: React.ChangeEvent<HTMLInputElement>
      ) => {
        const files =
          event.currentTarget.files;

        void handleFiles(files);

        event.currentTarget.value =
          "";
      },
      [handleFiles]
    );

  const handleDrop =
    useCallback(
      (
        event: React.DragEvent<HTMLDivElement>
      ) => {
        event.preventDefault();
        event.stopPropagation();

        setDragging(false);

        if (uploading) {
          return;
        }

        void handleFiles(
          event.dataTransfer.files
        );
      },
      [handleFiles, uploading]
    );

  const handleDragEnter =
    useCallback(
      (
        event: React.DragEvent<HTMLDivElement>
      ) => {
        event.preventDefault();
        event.stopPropagation();

        if (!uploading) {
          setDragging(true);
        }
      },
      [uploading]
    );

  const handleDragOver =
    useCallback(
      (
        event: React.DragEvent<HTMLDivElement>
      ) => {
        event.preventDefault();
        event.stopPropagation();

        if (!uploading) {
          setDragging(true);
        }
      },
      [uploading]
    );

  const handleDragLeave =
    useCallback(
      (
        event: React.DragEvent<HTMLDivElement>
      ) => {
        event.preventDefault();
        event.stopPropagation();

        /*
         * Only clear dragging when leaving the
         * actual drop zone rather than moving
         * between its child elements.
         */
        const currentTarget =
          event.currentTarget;

        const relatedTarget =
          event.relatedTarget;

        if (
          relatedTarget instanceof Node &&
          currentTarget.contains(
            relatedTarget
          )
        ) {
          return;
        }

        setDragging(false);
      },
      []
    );

  return (
    <div className="space-y-3">
      {/* 
       * DRAG & DROP UPLOAD ZONE
       *
       * This is intentionally the only upload
       * control. There is no Upload button.
       *
       * Clicking the zone still opens the native
       * file picker as a fallback.
       */}
      <div
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-disabled={uploading}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          group
          cursor-pointer
          rounded-lg
          border-2
          border-dashed
          p-8
          text-center
          transition-all
          duration-150
          select-none
          outline-none
          focus-visible:ring-2
          focus-visible:ring-blueprint/40

          ${
            dragging
              ? "border-blueprint bg-blueprint-bg scale-[1.01]"
              : "border-line bg-surface hover:border-blueprint/50 hover:bg-vellum/40"
          }

          ${
            uploading
              ? "pointer-events-none opacity-70"
              : ""
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={
            target.mode === "new"
              ? multiple
              : false
          }
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={
            handleInputChange
          }
          disabled={uploading}
        />

        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-vellum">
          {uploading ? (
            <Loader2
              size={22}
              className="animate-spin text-blueprint"
            />
          ) : (
            <FileUp
              size={22}
              className={`
                transition-colors
                ${
                  dragging
                    ? "text-blueprint"
                    : "text-muted group-hover:text-blueprint"
                }
              `}
            />
          )}
        </div>

        <p className="text-[13px] font-medium text-ink">
          {uploading
            ? "Uploading files..."
            : dragging
              ? "Drop files here"
              : "Drag & drop files here"}
        </p>

        {!uploading && (
          <>
            <p className="mt-1 text-[11.5px] text-muted">
              Drop your drawings,
              PDFs, images, CAD/BIM
              files or other project
              documents here.
            </p>

            <p className="mt-2 text-[10.5px] text-muted">
              Click here to browse
              files manually if needed.
              Upload starts
              automatically.
            </p>
          </>
        )}
      </div>

      {/* UPLOAD RESULTS */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-ink">
                  {item.name}
                </p>

                {item.status ===
                  "uploading" && (
                  <p className="mt-0.5 text-[11px] text-muted">
                    Uploading...
                  </p>
                )}

                {item.status ===
                  "success" && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-moss">
                    <CheckCircle2
                      size={12}
                    />
                    Uploaded
                    successfully
                  </p>
                )}

                {item.status ===
                  "error" && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-brick">
                    <AlertTriangle
                      size={12}
                    />
                    {item.error ||
                      "Upload failed."}
                  </p>
                )}
              </div>

              {item.status ===
                "uploading" && (
                <Loader2
                  size={15}
                  className="shrink-0 animate-spin text-blueprint"
                />
              )}

              {item.status ===
                "success" && (
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-moss"
                />
              )}

              {item.status ===
                "error" && (
                <button
                  type="button"
                  onClick={() =>
                    removeItem(
                      item.id
                    )
                  }
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