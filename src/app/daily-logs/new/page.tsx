"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { useStore } from "@/store/app-store";
import { CheckCircle } from "lucide-react";
import { DocumentUploader } from "@/components/documents/document-uploader";

const MIN_WORK_DESCRIPTION_LENGTH = 10;

export default function NewDailyLogPage() {
  const router = useRouter();
  const { projects, addLog, refresh } = useStore();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [progress, setProgress] = useState(50);

  const [form, setForm] = useState({
    projectId: "",
    workCompleted: "",
    challenges: "",
    pendingWork: "",
    nextActions: "",
  });

  const workCompletedLength = form.workCompleted.trim().length;
  const workCompletedTooShort =
    workCompletedLength > 0 &&
    workCompletedLength < MIN_WORK_DESCRIPTION_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    // Validate project
    if (!form.projectId) {
      setError("Please select a project.");
      return;
    }

    // Validate work description
    if (workCompletedLength < MIN_WORK_DESCRIPTION_LENGTH) {
      setError(
        `Please describe the work completed in at least ${MIN_WORK_DESCRIPTION_LENGTH} characters.`
      );
      return;
    }

    setSubmitting(true);

    try {
      await addLog({
        projectId: form.projectId,
        workCompleted: form.workCompleted.trim(),
        challenges: form.challenges.trim(),
        pendingWork: form.pendingWork.trim(),
        nextActions: form.nextActions.trim(),
        progress,
      });

      /*
       * Attachments uploaded through DocumentUploader are already
       * associated with the selected project. They do not need to be
       * uploaded again when the daily log is submitted.
       */

      setSubmitted(true);

      setTimeout(() => {
        router.push("/daily-logs");
      }, 1800);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to submit daily log. Please try again.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <CheckCircle
            size={48}
            className="mx-auto text-moss mb-4"
          />

          <h2 className="font-display font-bold text-[18px] text-ink">
            Log submitted
          </h2>

          <p className="text-muted text-[12.5px] mt-1">
            Your daily log was submitted successfully.
          </p>

          <p className="text-muted text-[12px] mt-1">
            Redirecting to daily logs…
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="font-display font-bold text-[20px] text-ink mb-0.5">
          Submit daily log
        </h1>

        <p className="text-muted text-[12px] mb-5">
          Required before close of business each day. All entries are
          permanent and visible to supervisors.
        </p>

        <Card className="p-5">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {/* PROJECT */}
            <Field label="Project" required>
              <Select
                required
                value={form.projectId}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    projectId: e.target.value,
                  }));

                  setError("");
                }}
              >
                <option value="">Select your project</option>

                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sheetNo} — {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            {/* WORK COMPLETED */}
            <Field label="Work completed today" required>
              <Textarea
                required
                minLength={MIN_WORK_DESCRIPTION_LENGTH}
                rows={3}
                value={form.workCompleted}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    workCompleted: e.target.value,
                  }));

                  setError("");
                }}
                placeholder="Describe what was completed today in detail…"
              />

              <div className="flex justify-between items-center mt-1">
                <p
                  className={`text-[11px] ${
                    workCompletedTooShort
                      ? "text-brick"
                      : "text-muted"
                  }`}
                >
                  {workCompletedTooShort
                    ? `Please enter at least ${MIN_WORK_DESCRIPTION_LENGTH} characters.`
                    : "Minimum 10 characters required."}
                </p>

                <span
                  className={`font-mono text-[11px] ${
                    workCompletedTooShort
                      ? "text-brick"
                      : "text-muted"
                  }`}
                >
                  {workCompletedLength}/10
                </span>
              </div>
            </Field>

            {/* CHALLENGES */}
            <Field label="Challenges encountered">
              <Textarea
                rows={2}
                value={form.challenges}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    challenges: e.target.value,
                  }))
                }
                placeholder="Any blockers, delays, or issues to flag…"
              />
            </Field>

            {/* PENDING WORK */}
            <Field label="Pending work">
              <Textarea
                rows={2}
                value={form.pendingWork}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pendingWork: e.target.value,
                  }))
                }
                placeholder="What remains outstanding…"
              />
            </Field>

            {/* NEXT ACTIONS */}
            <Field label="Next actions">
              <Textarea
                rows={2}
                value={form.nextActions}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    nextActions: e.target.value,
                  }))
                }
                placeholder="What happens next and by when…"
              />
            </Field>

            {/* PROJECT PROGRESS */}
<div className="border border-line rounded-md p-4 bg-slate-50/50">
  <div className="flex items-center justify-between mb-2">
    <div>
      <label className="text-[12px] text-muted block">
        Project progress
      </label>
      <p className="text-[11px] text-muted mt-0.5">
        Calculated automatically from project tasks and milestones.
      </p>
    </div>

    <span className="font-mono text-[15px] text-blueprint font-semibold">
      Calculated
    </span>
  </div>

  <p className="text-[11px] text-muted">
    Daily logs record site activity. Project progress is determined from
    the completion of project deliverables.
  </p>
</div>

            {/* ATTACHMENTS */}
            <div>
              <label className="text-[12px] text-muted block mb-1.5">
                Attach files (optional)
              </label>

              {form.projectId ? (
                <DocumentUploader
                  key={form.projectId}
                  target={{
                    mode: "new",
                    projectId: form.projectId,
                    category: "SITE_REPORT",
                  }}
                  onComplete={refresh}
                  onError={setUploadError}
                />
              ) : (
                <div className="border border-dashed rounded-md p-5 text-center text-[12px] border-line text-muted">
                  Select a project above to attach drawings,
                  photos, or documents.
                </div>
              )}

              {uploadError && (
                <p className="text-brick text-[12px] mt-1.5">
                  {uploadError}
                </p>
              )}
            </div>

            {/* ERROR */}
            {error && (
              <div className="border border-brick/30 bg-brick/5 rounded-md px-3 py-2">
                <p className="text-brick text-[12px]">
                  {error}
                </p>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 pt-1 border-t border-line">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={submitting}
                className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  submitting ||
                  !form.projectId ||
                  workCompletedLength <
                    MIN_WORK_DESCRIPTION_LENGTH
                }
                className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium hover:bg-ink/90 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit log"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
