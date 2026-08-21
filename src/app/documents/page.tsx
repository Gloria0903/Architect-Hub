"use client";

import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";

import {
  FileText,
  File,
  ImageIcon,
  Download,
  Trash2,
  Archive,
  Film,
} from "lucide-react";

import {
  useStore,
  formatFileSize,
} from "@/store/app-store";

import { DocumentUploader } from "@/components/documents/document-uploader";

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
    mimeType.startsWith(
      "image/"
    ) ||
    /\.(png|jpg|jpeg|webp|gif|tif|tiff|bmp|svg)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.image;
  }

  if (
    mimeType ===
      "application/pdf" ||
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
    mimeType.includes(
      "sheet"
    ) ||
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
    mimeType.startsWith(
      "video/"
    ) ||
    /\.(mp4|mov|webm)$/i.test(
      lowerName
    )
  ) {
    return typeIcon.video;
  }

  return typeIcon.default;
}

export default function DocumentsPage() {
  const {
    projects,
    documents,
    removeDocument,
    refresh,
  } = useStore();

  const [
    filterProject,
    setFilterProject,
  ] = useState("all");

  const [
    uploadProject,
    setUploadProject,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  /*
   * If a project is selected in the
   * filter, that same project becomes
   * the upload target.
   */
  const selectedUploadProject =
    filterProject !== "all"
      ? filterProject
      : uploadProject;

  const visible =
    filterProject === "all"
      ? documents
      : documents.filter(
          (file) =>
            file.projectId ===
            filterProject
        );

  function handleProjectChange(
    value: string
  ) {
    setUploadProject(value);
    setFilterProject(value);
    setError("");
  }

  async function handleDelete(
    id: string,
    name: string
  ) {
    const confirmed =
      window.confirm(
        `Delete "${name}"?\n\nThis cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await removeDocument(id);
    } catch (deleteError) {
      console.error(
        "[Documents] Document deletion failed:",
        deleteError
      );

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete document."
      );
    }
  }

  return (
    <AppShell>
      <div>
        {/* HEADER */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[20px] font-bold text-ink">
              Documents
            </h1>

            <p className="mt-0.5 text-[12px] text-muted">
              Drawings, CAD/BIM files,
              BOQs, contracts, reports,
              images and project media
            </p>
          </div>
        </div>

        {/* UPLOAD SECTION */}
        <Card className="mb-5 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="mr-2 text-[11px] text-muted">
                Upload to project:
              </label>

              <select
                value={
                  selectedUploadProject
                }
                onChange={(e) =>
                  handleProjectChange(
                    e.target.value
                  )
                }
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] outline-none"
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

            {selectedUploadProject ? (
              <DocumentUploader
                key={
                  selectedUploadProject
                }
                target={{
                  mode: "new",
                  projectId:
                    selectedUploadProject,
                  category: "OTHER",
                }}
                buttonLabel="Upload files"
                multiple
                onComplete={
                  refresh
                }
                onError={(message) =>
                  setError(message)
                }
              />
            ) : (
              <button
                type="button"
                onClick={() =>
                  setError(
                    "Please select a project before uploading a file."
                  )
                }
                className="rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-ink/90"
              >
                Upload files
              </button>
            )}
          </div>

          <p className="mt-3 text-[11px] text-muted">
            Select a project, click
            <strong className="mx-1 font-medium text-ink">
              Upload files
            </strong>
            and choose your file from
            your computer. The upload
            starts automatically.
          </p>
        </Card>

        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-md border border-brick/30 bg-brick/5 p-3">
            <div className="flex items-start gap-2">
              <FileText
                size={15}
                className="mt-0.5 shrink-0 text-brick"
              />

              <div>
                <p className="text-[12px] font-medium text-brick">
                  Error
                </p>

                <p className="mt-0.5 text-[12px] text-brick/80">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FILTER */}
        <div className="mb-4 flex items-center gap-2">
          <select
            value={filterProject}
            onChange={(e) => {
              const value =
                e.target.value;

              setFilterProject(value);

              if (
                value !== "all"
              ) {
                setUploadProject(
                  value
                );
              }

              setError("");
            }}
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] outline-none"
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

          <span className="ml-auto font-mono text-[11px] text-muted">
            {visible.length}{" "}
            {visible.length === 1
              ? "file"
              : "files"}
          </span>
        </div>

        {/* DOCUMENTS TABLE */}
        <Card className="overflow-hidden">
          {visible.length ===
          0 ? (
            <div className="p-8 text-center text-[12.5px] text-muted">
              No documents yet.
              Upload one above to
              get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-vellum">
                  <tr className="text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">
                      File
                    </th>

                    <th className="px-4 py-2.5 font-medium">
                      Project
                    </th>

                    <th className="px-4 py-2.5 font-medium">
                      Size
                    </th>

                    <th className="px-4 py-2.5 font-medium">
                      Uploaded
                    </th>

                    <th className="px-4 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map(
                    (file) => (
                      <tr
                        key={
                          file.id
                        }
                        className="border-t border-line transition-colors hover:bg-vellum/40"
                      >
                        {/* FILE */}
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            {iconFor(
                              file.mimeType,
                              file.name
                            )}

                            <span className="max-w-[300px] truncate font-medium text-ink">
                              {
                                file.name
                              }
                            </span>
                          </div>
                        </td>

                        {/* PROJECT */}
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {file
                            .project
                            ?.sheetNo ||
                            "—"}{" "}
                          —{" "}
                          {file
                            .project
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
                                size={
                                  15
                                }
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
                              className="text-muted hover:text-brick"
                              title="Delete"
                              aria-label={`Delete ${file.name}`}
                            >
                              <Trash2
                                size={
                                  15
                                }
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