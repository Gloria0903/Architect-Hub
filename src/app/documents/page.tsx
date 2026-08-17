"use client";

import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useStore, formatFileSize } from "@/store/app-store";
import {
  FileText,
  File,
  ImageIcon,
  Upload,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";

const typeIcon: Record<string, React.ReactNode> = {
  pdf: <FileText size={16} className="text-brick" />,
  dwg: <File size={16} className="text-blueprint" />,
  xlsx: <FileText size={16} className="text-moss" />,
  image: <ImageIcon size={16} className="text-ochre" />,
  default: <FileText size={16} className="text-muted" />,
};

function iconFor(mimeType: string, name: string) {
  const lowerName = name.toLowerCase();

  if (mimeType.startsWith("image/")) {
    return typeIcon.image;
  }

  if (
    mimeType === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
    return typeIcon.pdf;
  }

  if (
    lowerName.endsWith(".dwg") ||
    lowerName.endsWith(".dxf") ||
    lowerName.endsWith(".rvt")
  ) {
    return typeIcon.dwg;
  }

  if (
    mimeType.includes("sheet") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv")
  ) {
    return typeIcon.xlsx;
  }

  return typeIcon.default;
}

export default function DocumentsPage() {
  const {
    projects,
    documents,
    uploadDocument,
    removeDocument,
  } = useStore();

  const [filterProject, setFilterProject] = useState("all");
  const [uploadProject, setUploadProject] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const visible =
    filterProject === "all"
      ? documents
      : documents.filter((file) => file.projectId === filterProject);

  /**
   * Open the native file picker.
   */
  function openFilePicker() {
    if (uploading) return;

    setError("");

    // Reset the input first so selecting the same file again
    // still triggers onChange.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  /**
   * Upload selected files.
   */
  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }

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

    setError("");
    setUploading(true);

    try {
      const files = Array.from(list);

      for (const file of files) {
        console.log("Uploading file:", {
          name: file.name,
          size: file.size,
          type: file.type,
          projectId: targetProject,
        });

        await uploadDocument(
          targetProject,
          file,
          "OTHER"
        );
      }

      console.log("Upload completed successfully.");

      // Keep the project selected after upload.
      // Refresh is already handled inside uploadDocument().
    } catch (e) {
      console.error("Document upload failed:", e);

      setError(
        e instanceof Error
          ? e.message
          : "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  /**
   * File input change handler.
   */
  function handleFileInputChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;

    if (!files || files.length === 0) {
      return;
    }

    void handleFiles(files);
  }

  /**
   * Drag & drop handlers.
   */
  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault();

    if (!uploading) {
      setDragging(true);
    }
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault();
    setDragging(false);

    if (uploading) {
      return;
    }

    void handleFiles(e.dataTransfer.files);
  }

  /**
   * Delete document.
   */
  async function handleDelete(
    id: string,
    name: string
  ) {
    if (
      !confirm(
        `Delete "${name}"?\n\nThis cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError("");

      await removeDocument(id);
    } catch (e) {
      console.error("Document deletion failed:", e);

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
              DWG, DXF, Revit, PDF, images, BOQs,
              contracts and reports
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

          {/* IMPORTANT:
              This input is intentionally hidden.
              The button and drop zone both trigger it.
          */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.dwg,.dxf,.rvt,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.ppt,.pptx,.doc,.docx"
            onChange={handleFileInputChange}
          />
        </div>

        {/* ─────────────────────────────────────────────
            PROJECT SELECTION
        ───────────────────────────────────────────── */}
        <div className="mb-3">
          <label className="text-[11px] text-muted mr-2">
            Upload to project:
          </label>

          <select
            value={
              filterProject !== "all"
                ? filterProject
                : uploadProject
            }
            onChange={(e) => {
              setUploadProject(e.target.value);
              setFilterProject(e.target.value);
              setError("");
            }}
            disabled={uploading}
            className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none disabled:opacity-60"
          >
            <option value="">
              Select a project...
            </option>

            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.sheetNo} — {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* ─────────────────────────────────────────────
            DROP ZONE
        ───────────────────────────────────────────── */}
        <div
          onClick={openFilePicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" ||
              e.key === " "
            ) {
              e.preventDefault();
              openFilePicker();
            }
          }}
          className={`
            border-2
            border-dashed
            rounded-card
            p-8
            text-center
            mb-4
            transition-colors
            cursor-pointer
            ${
              dragging
                ? "border-blueprint bg-blueprint-bg"
                : "border-line bg-surface hover:border-blueprint/40"
            }
            ${
              uploading
                ? "opacity-60 cursor-not-allowed"
                : ""
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
                Uploading file...
              </div>

              <p className="text-muted text-[12px] mt-1">
                Please wait while the file is uploaded.
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
                or click to browse — DWG, DXF, RVT,
                PDF, images, XLSX accepted (up to 50MB)
              </p>
            </>
          )}
        </div>

        {/* ─────────────────────────────────────────────
            ERROR
        ───────────────────────────────────────────── */}
        {error && (
          <div className="border border-brick/30 bg-brick/5 rounded-md p-3 mb-4">
            <p className="text-brick text-[12px]">
              {error}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            FILTER
        ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);

              // Keep upload target synchronized with
              // the selected project.
              if (e.target.value !== "all") {
                setUploadProject(e.target.value);
              }

              setError("");
            }}
            className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none"
          >
            <option value="all">
              All projects
            </option>

            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.sheetNo} — {project.name}
              </option>
            ))}
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
              No documents yet. Upload one above
              to get started.
            </div>
          ) : (
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
                {visible.map((file) => (
                  <tr
                    key={file.id}
                    className="border-t border-line hover:bg-vellum/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {iconFor(
                          file.mimeType,
                          file.name
                        )}

                        <span className="text-ink font-medium truncate max-w-[300px]">
                          {file.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-muted">
                      {file.project?.sheetNo ||
                        "—"}{" "}
                      —{" "}
                      {file.project?.name ||
                        "Unknown project"}
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-muted">
                      {formatFileSize(
                        file.fileSize
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-muted">
                      {new Date(
                        file.uploadedAt
                      ).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {/* DOWNLOAD */}
                        <a
                          href={
                            file.fileUrl ||
                            `/api/documents/${file.id}`
                          }
                          download={file.name}
                          className="text-blueprint hover:text-blueprint/70"
                          title="Download"
                        >
                          <Download size={15} />
                        </a>

                        {/* DELETE */}
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              file.id,
                              file.name
                            )
                          }
                          className="text-muted hover:text-brick"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}