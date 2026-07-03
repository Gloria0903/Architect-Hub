"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, Button, ErrorBanner, Spinner, EmptyState } from "@/components/ui/form";
import {
  projects as projectsApi, communications as commsApi,
  Project, Communication, CommunicationType, ApiError,
} from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { MessageSquare, Plus, ExternalLink, Search } from "lucide-react";

const COMM_TYPES: { value: CommunicationType; label: string }[] = [
  { value: "MEETING_MINUTES", label: "Meeting minutes" },
  { value: "CLIENT_INSTRUCTION", label: "Client instruction" },
  { value: "DESIGN_COMMENT", label: "Design comment" },
  { value: "APPROVAL_RECORD", label: "Approval record" },
  { value: "EMAIL_SUMMARY", label: "Email summary" },
  { value: "CHANGE_REQUEST", label: "Change request" },
];

const TYPE_COLORS: Record<string, string> = {
  MEETING_MINUTES: "bg-blueprint-bg text-blueprint",
  CLIENT_INSTRUCTION: "bg-ochre-bg text-ochre",
  DESIGN_COMMENT: "bg-moss-bg text-moss",
  APPROVAL_RECORD: "bg-moss-bg text-moss",
  EMAIL_SUMMARY: "bg-blueprint-bg text-blueprint",
  CHANGE_REQUEST: "bg-brick-bg text-brick",
};

interface FlatComm {
  comm: Communication;
  project: Project;
}

export default function ClientCommsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [flat, setFlat] = useState<FlatComm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CommunicationType | "ALL">("ALL");
  const [projectFilter, setProjectFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: projs } = await projectsApi.list({ pageSize: 100 });
      setProjects(projs);
      const commsPerProject = await Promise.all(
        projs.map(async (p) => {
          const comms = await commsApi.list(p.id, search || undefined).catch(() => [] as Communication[]);
          return comms.map((c) => ({ comm: c, project: p }));
        }),
      );
      const all = commsPerProject.flat().sort(
        (a, b) => new Date(b.comm.occurredAt).getTime() - new Date(a.comm.occurredAt).getTime(),
      );
      setFlat(all);
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => { load(); }, [load]);

  if (authLoading) return <AppShell><Spinner /></AppShell>;

  const visible = flat
    .filter((f) => typeFilter === "ALL" || f.comm.type === typeFilter)
    .filter((f) => projectFilter === "all" || f.project.id === projectFilter);

  return (
    <AppShell>
      <Topbar
        title="Client communications"
        subtitle="Meeting minutes, instructions, approvals and change requests — all searchable"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-surface border border-line rounded-md px-3 py-1.5 text-[12px] text-muted flex-1 min-w-48 max-w-72">
          <Search size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or content…"
            className="flex-1 bg-transparent focus:outline-none text-ink placeholder:text-muted/60"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CommunicationType | "ALL")}
          className="border border-line rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blueprint/40"
        >
          <option value="ALL">All types</option>
          {COMM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="border border-line rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blueprint/40"
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Log entry
        </Button>
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare size={28} />}
            title="No communications logged"
            body="Meeting minutes, instructions, and approvals logged here will be instantly searchable and available during any project takeover."
            action={<Button onClick={() => setAddOpen(true)}><Plus size={14} />Log first entry</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ comm, project }) => (
            <Card key={comm.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-[3px] px-2 py-0.5 text-[10px] font-medium tracking-wide ${TYPE_COLORS[comm.type] ?? "bg-vellum text-muted"}`}
                    >
                      {COMM_TYPES.find((t) => t.value === comm.type)?.label ?? comm.type}
                    </span>
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-[11px] text-muted hover:text-blueprint flex items-center gap-0.5"
                    >
                      {project.name} <ExternalLink size={10} className="ml-0.5" />
                    </Link>
                  </div>
                  <h3 className="font-medium text-ink text-[13px] mt-0.5">{comm.subject}</h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[11px] text-muted">
                    {new Date(comm.occurredAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {comm.createdBy.firstName} {comm.createdBy.lastName}
                  </div>
                </div>
              </div>
              <p className="text-[12.5px] text-muted leading-relaxed">{comm.content}</p>
            </Card>
          ))}
        </div>
      )}

      {addOpen && (
        <AddCommModal
          projects={projects}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); load(); }}
        />
      )}
    </AppShell>
  );
}

function AddCommModal({
  projects,
  onClose,
  onAdded,
}: {
  projects: Project[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [type, setType] = useState<CommunicationType>("MEETING_MINUTES");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!projectId || !subject.trim() || !content.trim()) {
      setError("Project, subject, and content are required."); return;
    }
    setSaving(true); setError(null);
    try {
      await commsApi.create(projectId, {
        type,
        subject,
        content,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Log client communication" width="md">
      <div className="flex flex-col gap-3.5 mb-4">
        <Field label="Project" required>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as CommunicationType)}>
              {COMM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date of occurrence" required>
            <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Subject" required>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Client review — floor plan revision B"
          />
        </Field>
        <Field label="Notes / content" required>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="Record decisions, instructions, approvals, and follow-ups…"
          />
        </Field>
      </div>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Save entry"}</Button>
      </div>
    </Modal>
  );
}
