"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { useStore } from "@/store/app-store";
import { CheckCircle } from "lucide-react";
import { DocumentUploader } from "@/components/documents/document-uploader";

export default function NewDailyLogPage() {
  const router = useRouter();
  const { projects, addLog, refresh } = useStore();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [progress, setProgress] = useState(50);
  const [form, setForm] = useState({ projectId: "", workCompleted: "", challenges: "", pendingWork: "", nextActions: "" });

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
      // Attachments (if any) already uploaded via DocumentUploader as the
      // user added them — they're tied to the project, not the log entry
      // itself, same as every other document in the system.
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
              <label className="text-[12px] text-muted block mb-1.5">Attach files (optional)</label>
              {form.projectId ? (
                <DocumentUploader
                  key={form.projectId}
                  target={{ mode: "new", projectId: form.projectId, category: "SITE_REPORT" }}
                  onComplete={refresh}
                  onError={setUploadError}
                />
              ) : (
                <div className="border border-dashed rounded-md p-5 text-center text-[12px] border-line text-muted">
                  Select a project above to attach drawings, photos, or documents.
                </div>
              )}
              {uploadError && <p className="text-brick text-[12px] mt-1.5">{uploadError}</p>}
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