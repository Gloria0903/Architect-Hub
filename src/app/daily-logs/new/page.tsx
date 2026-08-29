"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import {
  Select,
  Textarea,
  Field,
} from "@/components/ui/form-field";

import { useStore } from "@/store/app-store";

import { CheckCircle, Paperclip } from "lucide-react";

import { DocumentUploader } from "@/components/documents/document-uploader";

const MIN_WORK_DESCRIPTION_LENGTH = 10;

export default function NewDailyLogPage() {
  const router = useRouter();

  const {
    projects,
    addLog,
    refresh,
  } = useStore();

  // Two-phase flow: the log itself is submitted first (so it exists as a
  // real record with an id), THEN attachments are uploaded tied to that
  // specific log entry via dailyLogId — rather than being only loosely
  // associated with the project the whole time.
  const [createdLogId, setCreatedLogId] =
    useState<string | null>(null);

  const [attachedCount, setAttachedCount] =
    useState(0);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [uploadError, setUploadError] =
    useState("");

  const [progress] =
    useState(50);

  const [form, setForm] = useState({
    projectId: "",
    workCompleted: "",
    challenges: "",
    pendingWork: "",
    nextActions: "",
  });

  const workCompletedLength =
    form.workCompleted.trim().length;

  const workCompletedTooShort =
    workCompletedLength > 0 &&
    workCompletedLength <
      MIN_WORK_DESCRIPTION_LENGTH;

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");

    if (!form.projectId) {
      setError(
        "Please select a project."
      );
      return;
    }

    if (
      workCompletedLength <
      MIN_WORK_DESCRIPTION_LENGTH
    ) {
      setError(
        `Please describe the work completed in at least ${MIN_WORK_DESCRIPTION_LENGTH} characters.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const created = await addLog({
        projectId: form.projectId,
        workCompleted:
          form.workCompleted.trim(),
        challenges:
          form.challenges.trim(),
        pendingWork:
          form.pendingWork.trim(),
        nextActions:
          form.nextActions.trim(),
        progress,
      });

      // Move to the attach-files step now that the log has a real id.
      setCreatedLogId(created.id);
    } catch (err) {
      const message =
        err instanceof Error &&
        err.message
          ? err.message
          : "Failed to submit daily log. Please try again.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    router.push("/daily-logs");
  }

  if (createdLogId) {
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-lg">
          <div className="mb-5 text-center">
            <CheckCircle
              size={40}
              className="mx-auto mb-3 text-moss"
            />

            <h2 className="font-display text-[18px] font-bold text-ink">
              Log submitted
            </h2>

            <p className="mt-1 text-[12.5px] text-muted">
              Attach drawings, site photos, or other files to today&apos;s entry — optional.
            </p>
          </div>

          <Card className="p-5">
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] text-muted">
              <Paperclip size={12} />
              Attach files to this log entry
            </label>

            <DocumentUploader
              target={{
                mode: "new",
                projectId: form.projectId,
                category: "SITE_REPORT",
                dailyLogId: createdLogId,
              }}
              multiple
              onComplete={async () => {
                setAttachedCount((n) => n + 1);
                await refresh();
              }}
              onError={setUploadError}
            />

            {uploadError && (
              <p className="mt-1.5 text-[12px] text-brick">
                {uploadError}
              </p>
            )}

            {attachedCount > 0 && (
              <p className="mt-2 text-[11.5px] text-moss">
                {attachedCount} file{attachedCount === 1 ? "" : "s"} attached to this log entry.
              </p>
            )}

            <div className="mt-4 flex justify-end border-t border-line pt-3">
              <button
                type="button"
                onClick={finish}
                className="rounded-md bg-ink px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink/90"
              >
                {attachedCount > 0 ? "Done" : "Skip — no attachments"}
              </button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="mb-0.5 font-display text-[20px] font-bold text-ink">
          Submit daily log
        </h1>

        <p className="mb-5 text-[12px] text-muted">
          Required before close of business
          each day. All entries are permanent
          and visible to supervisors. You&apos;ll
          be able to attach files to this
          entry on the next step.
        </p>

        <Card className="p-5">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {/* PROJECT */}
            <Field
              label="Project"
              required
            >
              <Select
                required
                value={form.projectId}
                onChange={(e) => {
                  setForm((current) => ({
                    ...current,
                    projectId:
                      e.target.value,
                  }));

                  setError("");
                }}
              >
                <option value="">
                  Select your project
                </option>

                {projects.map((project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.sheetNo} —{" "}
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>

            {/* WORK COMPLETED */}
            <Field
              label="Work completed today"
              required
            >
              <Textarea
                required
                minLength={
                  MIN_WORK_DESCRIPTION_LENGTH
                }
                rows={3}
                value={
                  form.workCompleted
                }
                onChange={(e) => {
                  setForm((current) => ({
                    ...current,
                    workCompleted:
                      e.target.value,
                  }));

                  setError("");
                }}
                placeholder="Describe what was completed today in detail…"
              />

              <div className="mt-1 flex items-center justify-between">
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
                value={
                  form.challenges
                }
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    challenges:
                      e.target.value,
                  }))
                }
                placeholder="Any blockers, delays, or issues to flag…"
              />
            </Field>

            {/* PENDING WORK */}
            <Field label="Pending work">
              <Textarea
                rows={2}
                value={
                  form.pendingWork
                }
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    pendingWork:
                      e.target.value,
                  }))
                }
                placeholder="What remains outstanding…"
              />
            </Field>

            {/* NEXT ACTIONS */}
            <Field label="Next actions">
              <Textarea
                rows={2}
                value={
                  form.nextActions
                }
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    nextActions:
                      e.target.value,
                  }))
                }
                placeholder="What happens next and by when…"
              />
            </Field>

            {/* ERROR */}
            {error && (
              <div className="rounded-md border border-brick/30 bg-brick/5 px-3 py-2">
                <p className="text-[12px] text-brick">
                  {error}
                </p>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 border-t border-line pt-1">
              <button
                type="button"
                onClick={() =>
                  router.back()
                }
                disabled={submitting}
                className="rounded-md border border-line px-4 py-2 text-[12.5px] text-muted disabled:opacity-60"
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
                className="rounded-md bg-ink px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink/90 disabled:opacity-60"
              >
                {submitting
                  ? "Submitting…"
                  : "Submit log — then attach files"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
