"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { useStore, formatFileSize } from "@/store/app-store";
import { CheckCircle, X, FileText } from "lucide-react";

export default function NewDailyLogPage() {
  const router = useRouter();
  const { projects, addLog, uploadDocument } = useStore();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(50);
  const [form, setForm] = useState({ projectId: "", workCompleted: "", challenges: "", pendingWork: "", nextActions: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles(f => [...f, ...Array.from(list)]);
  }

  function removeFile(idx: number) {
    setFiles(f => f.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await addLog({
        projectId: form.projectId,
        workCompleted: form.workCompleted,
        challenges: form.challenges,
        pendingWork: form.pendingWork,
        nextActions: form.nextActions,
        progress,
      });
      // Attach any selected files to the project's documents.
      for (const file of files) {
        await uploadDocument(form.projectId, file);
      }
      setSubmitted(true);
      setTimeout(() => router.push("/daily-logs"), 1800);
    } catch (err) {
      setError((err as Error).message || "Failed to submit log");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <CheckCircle size={48} className="mx-auto text-moss mb-4" />
          <h2 className="font-display font-bold text-[18px] text-ink">Log submitted</h2>
          <p className="text-muted text-[12.5px] mt-1">Redirecting to daily logs…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="font-display font-bold text-[20px] text-ink mb-0.5">Submit daily log</h1>
        <p className="text-muted text-[12px] mb-5">Required before close of business each day. All entries are permanent and visible to supervisors.</p>
        <Card className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Project" required>
              <Select required value={form.projectId} onChange={e => setForm(f=>({...f,projectId:e.target.value}))}>
                <option value="">Select your project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
              </Select>
            </Field>
            <Field label="Work completed today" required>
              <Textarea required rows={3} value={form.workCompleted} onChange={e=>setForm(f=>({...f,workCompleted:e.target.value}))} placeholder="Describe what was completed today in detail…" />
            </Field>
            <Field label="Challenges encountered">
              <Textarea rows={2} value={form.challenges} onChange={e=>setForm(f=>({...f,challenges:e.target.value}))} placeholder="Any blockers, delays, or issues to flag…" />
            </Field>
            <Field label="Pending work">
              <Textarea rows={2} value={form.pendingWork} onChange={e=>setForm(f=>({...f,pendingWork:e.target.value}))} placeholder="What remains outstanding…" />
            </Field>
            <Field label="Next actions">
              <Textarea rows={2} value={form.nextActions} onChange={e=>setForm(f=>({...f,nextActions:e.target.value}))} placeholder="What happens next and by when…" />
            </Field>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[12px] text-muted">Overall project progress</label>
                <span className="font-mono text-[13px] text-blueprint font-medium">{progress}%</span>
              </div>
              <input type="range" min={0} max={100} value={progress} onChange={e=>setProgress(Number(e.target.value))} className="w-full accent-blueprint" />
              <div className="w-full h-1.5 bg-line rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-blueprint rounded-full transition-all" style={{width:`${progress}%`}} />
              </div>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                className={`border border-dashed rounded-md p-5 text-center text-[12px] transition-colors cursor-pointer ${dragging ? "border-blueprint bg-blueprint-bg text-blueprint" : "border-line text-muted hover:border-blueprint/50"}`}
              >
                <div className="font-medium text-ink mb-0.5">Attach files (optional)</div>
                Drag and drop drawings, photos, or documents — or click to browse.
              </div>
              {files.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-vellum rounded-md px-3 py-1.5 text-[11.5px]">
                      <span className="flex items-center gap-2 text-ink truncate"><FileText size={13} className="text-muted shrink-0" />{file.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-muted font-mono">{formatFileSize(file.size)}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-muted hover:text-brick"><X size={13} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-brick text-[12px]">{error}</p>}

            <div className="flex justify-end gap-2 pt-1 border-t border-line">
              <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium hover:bg-ink/90 disabled:opacity-60">
                {submitting ? "Submitting…" : "Submit log"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
