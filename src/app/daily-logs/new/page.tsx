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

import { CheckCircle } from "lucide-react";

import { DocumentUploader } from "@/components/documents/document-uploader";

const MIN_WORK_DESCRIPTION_LENGTH = 10;

export default function NewDailyLogPage() {
  const router = useRouter();

  const {
    projects,
    addLog,
    refresh,
  } = useStore();

  const [submitted, setSubmitted] =
    useState(false);

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
      await addLog({
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

      /*
       * Files uploaded through the
       * DocumentUploader are already
       * associated with the selected
       * project.
       */

      setSubmitted(true);

      setTimeout(() => {
        router.push("/daily-logs");
      }, 1800);
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

  if (submitted) {
    return (
      <AppShell>
        <div className="mx-auto mt-20 max-w-lg text-center">
          <CheckCircle
            size={48}
            className="mx-auto mb-4 text-moss"
          />

          <h2 className="font-display text-[18px] font-bold text-ink">
            Log submitted
          </h2>

          <p className="mt-1 text-[12.5px] text-muted">
            Your daily log was submitted
            successfully.
          </p>

          <p className="mt-1 text-[12px] text-muted">
            Redirecting to daily logs…
          </p>
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
          and visible to supervisors.
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
                  setUploadError("");
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

            {/* PROJECT PROGRESS */}
            <div className="rounded-md border border-line bg-slate-50/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <label className="block text-[12px] text-muted">
                    Project progress
                  </label>

                  <p className="mt-0.5 text-[11px] text-muted">
                    Calculated automatically
                    from project tasks and
                    milestones.
                  </p>
                </div>

                <span className="font-mono text-[15px] font-semibold text-blueprint">
                  Calculated
                </span>
              </div>

              <p className="text-[11px] text-muted">
                Daily logs record site activity.
                Project progress is determined
                from the completion of project
                deliverables.
              </p>
            </div>

            {/* ATTACHMENTS */}
            <div>
              <label className="mb-1.5 block text-[12px] text-muted">
                Attach files (optional)
              </label>

              {form.projectId ? (
                <DocumentUploader
                  key={form.projectId}
                  target={{
                    mode: "new",
                    projectId:
                      form.projectId,
                    category:
                      "SITE_REPORT",
                  }}
                  multiple
                  onComplete={refresh}
                  onError={setUploadError}
                />
              ) : (
                <div className="rounded-lg border-2 border-dashed border-line bg-vellum/30 p-8 text-center">
                  <p className="text-[13px] font-medium text-ink">
                    Select a project first
                  </p>

                  <p className="mt-1 text-[11.5px] text-muted">
                    After selecting a project,
                    drag and drop your drawings,
                    photos, or documents here.
                  </p>
                </div>
              )}

              {uploadError && (
                <p className="mt-1.5 text-[12px] text-brick">
                  {uploadError}
                </p>
              )}
            </div>

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
                  : "Submit log"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}