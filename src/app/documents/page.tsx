"use client";

import {
  useRef,
  useState,
} from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";

import {
  formatFileSize,
  useStore,
} from "@/store/app-store";

import {
  Archive,
  Download,
  File,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

const typeIcon: Record<
  string,
  React.ReactNode
> = {
  pdf: (
    <FileText
      size={16}
      className="text-brick"
    />
  ),

  dwg: (
    <File
      size={16}
      className="text-blueprint"
    />
  ),

  xlsx: (
    <FileText
      size={16}
      className="text-moss"
    />
  ),

  image: (
    <ImageIcon
      size={16}
      className="text-ochre"
    />
  ),

  archive: (
    <Archive
      size={16}
      className="text-muted"
    />
  ),

  video: (
    <Film
      size={16}
      className="text-muted"
    />
  ),

  default: (
    <FileText
      size={16}
      className="text-muted"
    />
  ),
};

function iconFor(
  mimeType: string,
  name: string
) {
  const lowerName =
    name.toLowerCase();

  if (
    mimeType.startsWith("image/") ||
    /\.(png|jpg|jpeg|webp|gif|tif|tiff|bmp|svg)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.image;
  }

  if (
    mimeType === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
    return typeIcon.pdf;
  }

  if (
    /\.(dwg|dxf|rvt|rfa|rte|skp|ifc|ifczip|dgn|3dm)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.dwg;
  }

  if (
    mimeType.includes("sheet") ||
    /\.(xlsx|xls|csv)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.xlsx;
  }

  if (
    /\.(zip|rar|7z)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.archive;
  }

  if (
    mimeType.startsWith("video/") ||
    /\.(mp4|mov|webm)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.video;
  }

  return typeIcon.default;
}

/**
 * Client-side file filter.
 *
 * IMPORTANT:
 * This is only a UI-level filter.
 * The API must still perform the real validation/security checks.
 */
const ACCEPTED_FILE_TYPES = [
  ".pdf",

  // CAD / BIM
  ".dwg",
  ".dxf",
  ".rvt",
  ".rfa",
  ".rte",
  ".skp",
  ".ifc",
  ".ifczip",
  ".dgn",
  ".3dm",

  // Adobe / design
  ".ai",
  ".eps",
  ".psd",

  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".bmp",
  ".svg",

  // Documents
  ".doc",
  ".docx",
  ".txt",
  ".rtf",

  // Spreadsheets
  ".xls",
  ".xlsx",
  ".csv",

  // Presentations
  ".ppt",
  ".pptx",

  // Archives
  ".zip",
  ".rar",
  ".7z",

  // Data
  ".json",
  ".xml",

  // Video
  ".mp4",
  ".mov",
  ".webm",
].join(",");

export default function DocumentsPage() {
  const {
    projects,
    documents,
    uploadDocument,
    removeDocument,
  } = useStore();

  /**
   * Current document list filter.
   *
   * "all" means show documents from all projects.
   */
  const [
    filterProject,
    setFilterProject,
  ] = useState("all");

  /**
   * Project that new uploads should belong to.
   *
   * Kept separate from filterProject so selecting an upload
   * destination doesn't unexpectedly change the document list.
   */
  const [
    uploadProject,
    setUploadProject,
  ] = useState("");

  const [
    dragging,
    setDragging,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  /**
   * Documents currently visible in the table.
   */
  const visible =
    filterProject === "all"
      ? documents
      : documents.filter(
          (file) =>
            file.projectId ===
            filterProject
        );

  /**
   * Open the browser's file picker.
   */
  function openFilePicker() {
    if (uploading) {
      return;
    }

    setError("");
    setSuccess("");

    if (fileInputRef.current) {
      /**
       * Reset the input so selecting the same file again
       * still triggers onChange.
       */
      fileInputRef.current.value =
        "";

      fileInputRef.current.click();
    }
  }

  /**
   * Upload one or more files.
   */
  async function handleFiles(
    list: FileList | null
  ) {
    if (!list || list.length === 0) {
      return;
    }

    /**
     * If the current document filter is a specific project,
     * use that project automatically.
     *
     * Otherwise use the project selected in "Upload to project".
     */
    const targetProject =
      filterProject !== "all"
        ? filterProject
        : uploadProject;

    if (!targetProject) {
      setError(
        "Please choose a project before uploading a file."
      );
      return;
    }

    const files =
      Array.from(list);

    if (files.length === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setUploading(true);

    const failedFiles: string[] = [];
    const successfulFiles: string[] =
      [];

    try {
      for (const file of files) {
        try {
          console.log(
            "[Documents] Starting upload:",
            {
              name: file.name,
              size: file.size,
              type: file.type,
              projectId:
                targetProject,
            }
          );

          /**
           * IMPORTANT:
           *
           * Do not upload directly to S3 from this component.
           *
           * uploadDocument() handles:
           *
           * Documents page
           *      ↓
           * app-store
           *      ↓
           * /api/documents
           *      ↓
           * validation/security
           *      ↓
           * storage.ts
           *      ↓
           * S3 or local storage
           */
          await uploadDocument(
            targetProject,
            file,
            "OTHER"
          );

          successfulFiles.push(
            file.name
          );

          console.log(
            "[Documents] Upload successful:",
            file.name
          );
        } catch (fileError) {
          console.error(
            `[Documents] Failed to upload ${file.name}:`,
            fileError
          );

          failedFiles.push(
            file.name
          );
        }
      }

      /**
       * Show a useful result after all files have been attempted.
       */
      if (failedFiles.length > 0) {
        if (
          successfulFiles.length > 0
        ) {
          setError(
            `Uploaded ${successfulFiles.length} ${
              successfulFiles.length === 1
                ? "file"
                : "files"
            }, but failed to upload: ${failedFiles.join(
              ", "
            )}`
          );
        } else if (
          failedFiles.length === 1
        ) {
          setError(
            `Failed to upload "${failedFiles[0]}".`
          );
        } else {
          setError(
            `Failed to upload ${failedFiles.length} files: ${failedFiles.join(
              ", "
            )}`
          );
        }

        return;
      }

      if (
        successfulFiles.length > 0
      ) {
        setSuccess(
          successfulFiles.length === 1
            ? `"${successfulFiles[0]}" uploaded successfully.`
            : `${successfulFiles.length} files uploaded successfully.`
        );
      }
    } catch (e) {
      /**
       * This is a final safety net.
       * Individual file failures are already handled above.
       */
      console.error(
        "[Documents] Upload process failed:",
        e
      );

      setError(
        e instanceof Error
          ? e.message
          : "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);

      /**
       * Clear the input after processing.
       * This allows the same file to be selected again.
       */
      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  function handleFileInputChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files =
      e.target.files;

    if (!files || files.length === 0) {
      return;
    }

    void handleFiles(files);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault();
    e.stopPropagation();

    if (uploading) {
      return;
    }

    setDragging(true);
  }

  function handleDragLeave(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault();
    e.stopPropagation();

    setDragging(false);
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault();
    e.stopPropagation();

    setDragging(false);

    if (uploading) {
      return;
    }

    void handleFiles(
      e.dataTransfer.files
    );
  }

  function handleDropZoneKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>
  ) {
    if (uploading) {
      return;
    }

    if (
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      openFilePicker();
    }
  }

  async function handleDelete(
    id: string,
    name: string
  ) {
    if (uploading) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${name}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await removeDocument(id);

      setSuccess(
        `"${name}" deleted successfully.`
      );
    } catch (e) {
      console.error(
        "[Documents] Document deletion failed:",
        e
      );

      setError(
        e instanceof Error
          ? e.message
          : "Failed to delete document."
      );
    }
  }

  return (
    <AppShell>
      <div>
        {/* ─────────────────────────────────────────────
            HEADER
        ───────────────────────────────────────────── */}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">
              Documents
            </h1>

            <p className="text-muted text-[12px] mt-0.5">
              Drawings, CAD/BIM files,
              BOQs, contracts, reports,
              images and project media
            </p>
          </div>

          <button
            type="button"
            onClick={openFilePicker}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2
                  size={15}
                  className="animate-spin"
                />

                Uploading...
              </>
            ) : (
              <>
                <Upload size={15} />

                Upload files
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept={
              ACCEPTED_FILE_TYPES
            }
            onChange={
              handleFileInputChange
            }
          />
        </div>

        {/* ─────────────────────────────────────────────
            UPLOAD PROJECT
        ───────────────────────────────────────────── */}

        <div className="mb-3">
          <label
            htmlFor="upload-project"
            className="text-[11px] text-muted mr-2"
          >
            Upload to project:
          </label>

          <select
            id="upload-project"
            value={uploadProject}
            onChange={(e) => {
              setUploadProject(
                e.target.value
              );

              setError("");
              setSuccess("");
            }}
            disabled={uploading}
            className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none disabled:opacity-60"
          >
            <option value="">
              Select a project...
            </option>

            {projects.map(
              (project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.sheetNo} —{" "}
                  {project.name}
                </option>
              )
            )}
          </select>
        </div>

        {/* ─────────────────────────────────────────────
            DRAG & DROP
        ───────────────────────────────────────────── */}

        <div
          onClick={() => {
            if (!uploading) {
              openFilePicker();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={
            handleDropZoneKeyDown
          }
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-disabled={uploading}
          className={`
            border-2
            border-dashed
            rounded-card
            p-8
            text-center
            mb-4
            transition-colors
            ${
              uploading
                ? "opacity-60 cursor-not-allowed"
                : "cursor-pointer"
            }
            ${
              dragging
                ? "border-blueprint bg-blueprint-bg"
                : "border-line bg-surface hover:border-blueprint/40"
            }
          `}
        >
          {uploading ? (
            <>
              <Loader2
                size={25}
                className="mx-auto mb-2 text-blueprint animate-spin"
              />

              <div className="text-ink font-medium text-[13px]">
                Uploading files...
              </div>

              <p className="text-muted text-[12px] mt-1">
                Please wait while the
                files are uploaded.
              </p>
            </>
          ) : (
            <>
              <Upload
                size={22}
                className={`
                  mx-auto mb-2
                  ${
                    dragging
                      ? "text-blueprint"
                      : "text-muted"
                  }
                `}
              />

              <div className="text-ink font-medium text-[13px]">
                {dragging
                  ? "Drop files here"
                  : "Drag and drop files here"}
              </div>

              <p className="text-muted text-[12px] mt-1">
                or click to browse
              </p>

              <p className="text-muted text-[11px] mt-2">
                CAD/BIM • PDF • Office •
                Images • Archives • Site
                videos
              </p>

              <p className="text-muted text-[11px] mt-1">
                Files up to 250MB depending
                on file type
              </p>
            </>
          )}
        </div>

        {/* ─────────────────────────────────────────────
            ERROR
        ───────────────────────────────────────────── */}

        {error && (
          <div
            role="alert"
            className="border border-brick/30 bg-brick/5 rounded-md p-3 mb-4"
          >
            <p className="text-brick text-[12px]">
              {error}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            SUCCESS
        ───────────────────────────────────────────── */}

        {success && (
          <div
            role="status"
            className="border border-moss/30 bg-moss/5 rounded-md p-3 mb-4"
          >
            <p className="text-moss text-[12px]">
              {success}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            FILTER
        ───────────────────────────────────────────── */}

        <div className="flex items-center gap-2 mb-4">
          <label
            htmlFor="filter-project"
            className="sr-only"
          >
            Filter documents by project
          </label>

          <select
            id="filter-project"
            value={filterProject}
            onChange={(e) => {
              const value =
                e.target.value;

              setFilterProject(value);

              /**
               * When filtering to a specific project,
               * automatically make it the upload destination too.
               *
               * Returning to "All projects" does not erase the
               * previously selected upload project.
               */
              if (value !== "all") {
                setUploadProject(
                  value
                );
              }

              setError("");
              setSuccess("");
            }}
            className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none"
          >
            <option value="all">
              All projects
            </option>

            {projects.map(
              (project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.sheetNo} —{" "}
                  {project.name}
                </option>
              )
            )}
          </select>

          <span className="ml-auto text-[11px] text-muted font-mono">
            {visible.length}{" "}
            {visible.length === 1
              ? "file"
              : "files"}
          </span>
        </div>

        {/* ─────────────────────────────────────────────
            DOCUMENT TABLE
        ───────────────────────────────────────────── */}

        <Card className="overflow-hidden">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-muted text-[12.5px]">
              No documents yet. Upload
              one above to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-vellum">
                  <tr className="text-muted text-left">
                    <th className="font-medium px-4 py-2.5">
                      File
                    </th>

                    <th className="font-medium px-4 py-2.5">
                      Project
                    </th>

                    <th className="font-medium px-4 py-2.5">
                      Size
                    </th>

                    <th className="font-medium px-4 py-2.5">
                      Uploaded
                    </th>

                    <th className="font-medium px-4 py-2.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map(
                    (file) => (
                      <tr
                        key={file.id}
                        className="border-t border-line hover:bg-vellum/40 transition-colors"
                      >
                        {/* FILE */}

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {iconFor(
                              file.mimeType,
                              file.name
                            )}

                            <span className="text-ink font-medium truncate max-w-[300px]">
                              {file.name}
                            </span>
                          </div>
                        </td>

                        {/* PROJECT */}

                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {file.project
                            ?.sheetNo ||
                            "—"}{" "}
                          —{" "}
                          {file.project
                            ?.name ||
                            "Unknown project"}
                        </td>

                        {/* SIZE */}

                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {formatFileSize(
                            file.fileSize
                          )}
                        </td>

                        {/* DATE */}

                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {new Date(
                            file.uploadedAt
                          ).toLocaleDateString()}
                        </td>

                        {/* ACTIONS */}

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <a
                              href={
                                file.fileUrl ||
                                `/api/documents/${file.id}`
                              }
                              download={
                                file.name
                              }
                              className="text-blueprint hover:text-blueprint/70"
                              title="Download"
                              aria-label={`Download ${file.name}`}
                            >
                              <Download
                                size={15}
                              />
                            </a>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  file.id,
                                  file.name
                                )
                              }
                              disabled={
                                uploading
                              }
                              className="text-muted hover:text-brick disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                              aria-label={`Delete ${file.name}`}
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}