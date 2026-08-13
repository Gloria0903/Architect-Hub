"use client";
import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useStore, formatFileSize } from "@/store/app-store";
import { FileText, File, ImageIcon, Upload, Download, Trash2 } from "lucide-react";

const typeIcon: Record<string, React.ReactNode> = {
  pdf: <FileText size={16} className="text-brick" />,
  dwg: <File size={16} className="text-blueprint" />,
  xlsx: <FileText size={16} className="text-moss" />,
  image: <ImageIcon size={16} className="text-ochre" />,
  default: <FileText size={16} className="text-muted" />,
};

function iconFor(mimeType: string, name: string) {
  if (mimeType.startsWith("image/")) return typeIcon.image;
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return typeIcon.pdf;
  if (name.endsWith(".dwg") || name.endsWith(".dxf")) return typeIcon.dwg;
  if (mimeType.includes("sheet") || name.endsWith(".xlsx")) return typeIcon.xlsx;
  return typeIcon.default;
}

export default function DocumentsPage() {
  const { projects, documents, uploadDocument, removeDocument } = useStore();
  const [filterProject, setFilterProject] = useState("all");
  const [uploadProject, setUploadProject] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visible = filterProject === "all" ? documents : documents.filter(f => f.projectId === filterProject);

  async function handleFiles(list: FileList | null) {
    console.log("handleFiles called", list, "filterProject:", filterProject, "uploadProject:", uploadProject); // TEMP DEBUG
    if (!list || list.length === 0) return;
    const targetProject = filterProject !== "all" ? filterProject : uploadProject;
    if (!targetProject) {
      setError("Choose a project first (use the project filter or pick one below), then upload.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        await uploadDocument(targetProject, file);
      }
    } catch (e) {
      setError((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await removeDocument(id);
  }

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Documents</h1>
            <p className="text-muted text-[12px] mt-0.5">DWG, DXF, Revit, PDF, images, BOQs, contracts and reports</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90 disabled:opacity-60"
          >
            <Upload size={15} />{uploading ? "Uploading…" : "Upload files"}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {filterProject === "all" && (
          <div className="mb-3">
            <label className="text-[11px] text-muted mr-2">Upload to project:</label>
            <select value={uploadProject} onChange={e => setUploadProject(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
              <option value="">Select a project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
            </select>
          </div>
        )}

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          className={`border-2 border-dashed rounded-card p-8 text-center mb-4 transition-colors cursor-pointer ${dragging ? "border-blueprint bg-blueprint-bg" : "border-line bg-surface hover:border-blueprint/40"}`}
        >
          <Upload size={22} className={`mx-auto mb-2 ${dragging ? "text-blueprint" : "text-muted"}`} />
          <div className="text-ink font-medium text-[13px]">{dragging ? "Drop files here" : "Drag and drop files here"}</div>
          <p className="text-muted text-[12px] mt-1">or click Upload files above — DWG, DXF, RVT, PDF, images, XLSX accepted (up to 50MB)</p>
        </div>

        {error && <p className="text-brick text-[12px] mb-3">{error}</p>}

        <div className="flex items-center gap-2 mb-4">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
          </select>
          <span className="ml-auto text-[11px] text-muted font-mono">{visible.length} files</span>
        </div>

        <Card className="overflow-hidden">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-muted text-[12.5px]">No documents yet. Upload one above to get started.</div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-vellum">
                <tr className="text-muted text-left">
                  <th className="font-medium px-4 py-2.5">File</th>
                  <th className="font-medium px-4 py-2.5">Project</th>
                  <th className="font-medium px-4 py-2.5">Size</th>
                  <th className="font-medium px-4 py-2.5">Uploaded</th>
                  <th className="font-medium px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(f => (
                  <tr key={f.id} className="border-t border-line hover:bg-vellum/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {iconFor(f.mimeType, f.name)}
                        <span className="text-ink font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{f.project?.sheetNo} — {f.project?.name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{formatFileSize(f.fileSize)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{new Date(f.uploadedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <a href={f.fileUrl} download={f.name} className="text-blueprint hover:text-blueprint/70" title="Download">
                          <Download size={15} />
                        </a>
                        <button onClick={() => handleDelete(f.id, f.name)} className="text-muted hover:text-brick" title="Delete">
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