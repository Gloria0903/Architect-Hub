"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useStore } from "@/store/app-store";
import { FileText, File, Image, Upload } from "lucide-react";

const demoFiles = [
  { id: "d1", name: "Karen Residence - Floor Plans Rev C.pdf", project: "p1", size: "4.2 MB", type: "pdf", date: "2026-06-29", author: "Naomi Otieno" },
  { id: "d2", name: "Karen Residence - Site Plan.dwg", project: "p1", size: "8.7 MB", type: "dwg", date: "2026-06-20", author: "Naomi Otieno" },
  { id: "d3", name: "Westlands Office Park - BOQ Rev 2.xlsx", project: "p2", size: "1.1 MB", type: "xlsx", date: "2026-06-22", author: "Samuel Kamau" },
  { id: "d4", name: "Westlands Office Park - Basement Layout.dwg", project: "p2", size: "12.4 MB", type: "dwg", date: "2026-06-18", author: "Samuel Kamau" },
  { id: "d5", name: "Kilimani Apartments - Window Schedule.pdf", project: "p4", size: "2.3 MB", type: "pdf", date: "2026-06-28", author: "Naomi Otieno" },
];

const typeIcon: Record<string, React.ReactNode> = {
  pdf: <FileText size={16} className="text-brick" />,
  dwg: <File size={16} className="text-blueprint" />,
  xlsx: <FileText size={16} className="text-moss" />,
  default: <Image size={16} className="text-muted" />,
};

export default function DocumentsPage() {
  const { projects } = useStore();
  const [filterProject, setFilterProject] = useState("all");
  const [dragging, setDragging] = useState(false);

  const visible = filterProject === "all" ? demoFiles : demoFiles.filter(f => f.project === filterProject);

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Documents</h1>
            <p className="text-muted text-[12px] mt-0.5">DWG, DXF, Revit, PDF, images, BOQs, contracts and reports</p>
          </div>
          <button className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
            <Upload size={15} />Upload files
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); }}
          className={`border-2 border-dashed rounded-card p-8 text-center mb-4 transition-colors cursor-pointer ${dragging ? "border-blueprint bg-blueprint-bg" : "border-line bg-surface hover:border-blueprint/40"}`}
        >
          <Upload size={22} className={`mx-auto mb-2 ${dragging ? "text-blueprint" : "text-muted"}`} />
          <div className="text-ink font-medium text-[13px]">{dragging ? "Drop files here" : "Drag and drop files here"}</div>
          <p className="text-muted text-[12px] mt-1">or click Upload files above — DWG, DXF, RVT, PDF, images, XLSX accepted</p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
          </select>
          <span className="ml-auto text-[11px] text-muted font-mono">{visible.length} files</span>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-vellum">
              <tr className="text-muted text-left">
                <th className="font-medium px-4 py-2.5">File</th>
                <th className="font-medium px-4 py-2.5">Project</th>
                <th className="font-medium px-4 py-2.5">Uploaded by</th>
                <th className="font-medium px-4 py-2.5">Size</th>
                <th className="font-medium px-4 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(f => {
                const project = projects.find(p => p.id === f.project);
                return (
                  <tr key={f.id} className="border-t border-line hover:bg-vellum/40 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {typeIcon[f.type] ?? typeIcon.default}
                        <span className="text-ink font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{project?.sheetNo} — {project?.name}</td>
                    <td className="px-4 py-3 text-muted">{f.author}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{f.size}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{f.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
