"use client";

import { useState, useEffect, useCallback, use } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { DimensionBar } from "@/components/ui/dimension-bar";
import { Modal } from "@/components/ui/modal";
import {
  Field, Input, Select, Textarea, Button, ErrorBanner,
  SuccessBanner, Spinner, EmptyState, Avatar,
} from "@/components/ui/form";
import {
  projects as projectsApi, assignments, dailyLogs as logsApi, documents as docsApi,
  communications as commsApi, finance as financeApi, timeline as timelineApi,
  takeover as takeoverApi, users as usersApi,
  Project, DailyLog, Document, Communication, TimelineEntry, User, FinancialRecord,
  formatKsh, healthToStatus, guessDocCategory, ApiError,
} from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import {
  FileText, History, Upload, MessageSquare, Wallet, Repeat,
  Download, Plus, RefreshCw,
} from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "logs", label: "Daily logs", icon: History },
  { key: "documents", label: "Documents", icon: Upload },
  { key: "comms", label: "Client comms", icon: MessageSquare },
  { key: "finance", label: "Finance", icon: Wallet },
] as const;
type Tab = typeof TABS[number]["key"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useRequireAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [notFound404, setNotFound404] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(() => {
    projectsApi
      .get(id)
      .then(setProject)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound404(true);
        else setError(e.message);
      });
  }, [id]);

  useEffect(() => {
    if (!user) return;
    load();
    usersApi.list().then(setStaff).catch(() => {});
  }, [user, load]);

  if (authLoading || (!project && !notFound404 && !error)) {
    return <AppShell><Spinner /></AppShell>;
  }
  if (notFound404) notFound();
  if (!project) {
    return <AppShell><ErrorBanner message={error ?? "Could not load project."} /></AppShell>;
  }

  const status = healthToStatus(project.health);
  const canManage = user?.role === "ADMIN" ||
    (user?.role === "SUPERVISOR" && project.supervisor.id === user.id);
  const isAssigned = project.assignments.some((a) => a.user.id === user?.id);
  const architects = staff.filter((s) => s.role === "ARCHITECT" && s.isActive);
  const supervisors = staff.filter((s) => s.role === "ADMIN" || s.role === "SUPERVISOR");

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[11.5px] text-muted">
            {project.projectNumber} — {project.location ?? "No location"}
          </div>
          <h1 className="font-display font-bold text-[20px] text-ink mt-0.5">{project.name}</h1>
          <p className="text-muted text-[12.5px] mt-1">{project.clientName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={status} className="px-2.5 py-1" />
          {canManage && (
            <Button variant="secondary" size="sm" onClick={() => setAssignOpen(true)}>
              Assign staff
            </Button>
          )}
          {canManage && (
            <Button variant="danger" size="sm" onClick={() => setTakeoverOpen(true)}>
              <Repeat size={13} /> Take over project
            </Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {/* Quick facts card */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[12px]">
          <div>
            <div className="text-muted mb-1">Architect(s)</div>
            <div className="text-ink font-medium">
              {project.assignments.length === 0
                ? "Unassigned"
                : project.assignments.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ")}
            </div>
          </div>
          <div>
            <div className="text-muted mb-1">Supervisor</div>
            <div className="text-ink font-medium">
              {project.supervisor.firstName} {project.supervisor.lastName}
            </div>
          </div>
          <div>
            <div className="text-muted mb-1">Due date</div>
            <div className="text-ink font-medium font-mono">
              {project.expectedCompletionDate
                ? new Date(project.expectedCompletionDate).toLocaleDateString("en-KE")
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted mb-1">Budget</div>
            <div className="text-ink font-medium font-mono">
              {project.budget ? formatKsh(Number(project.budget)) : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted mb-1">Priority</div>
            <div className="text-ink font-medium capitalize">{project.priority.toLowerCase()}</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-line">
          <div className="text-muted text-[12px] mb-2">Progress — {project.progressPercentage}%</div>
          <DimensionBar progress={project.progressPercentage} status={status} />
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-line overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] border-b-2 -mb-px shrink-0 transition-colors ${
                tab === t.key
                  ? "border-blueprint text-ink font-medium"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {tab === "overview" && (
        <OverviewTab project={project} onRefresh={load} canManage={canManage} />
      )}
      {tab === "logs" && (
        <LogsTab projectId={id} canSubmit={isAssigned || user?.role === "ADMIN"} />
      )}
      {tab === "documents" && <DocumentsTab projectId={id} />}
      {tab === "comms" && <CommsTab projectId={id} canAdd={isAssigned || canManage} />}
      {tab === "finance" && (
        <FinanceTab projectId={id} canEdit={canManage} initial={project.financialRecord} onRefresh={load} />
      )}

      {/* Assign staff modal */}
      {assignOpen && (
        <AssignModal
          projectId={id}
          architects={architects}
          supervisors={supervisors}
          current={project}
          onClose={() => setAssignOpen(false)}
          onDone={() => { setAssignOpen(false); load(); }}
        />
      )}

      {/* Take over modal */}
      {takeoverOpen && (
        <TakeoverModal
          project={project}
          architects={architects}
          onClose={() => setTakeoverOpen(false)}
          onDone={() => { setTakeoverOpen(false); load(); }}
        />
      )}
    </AppShell>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  project,
  onRefresh,
  canManage,
}: {
  project: Project;
  onRefresh: () => void;
  canManage: boolean;
}) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    timelineApi.forProject(project.id).then((r) => setTimeline(r.data)).catch(() => {});
  }, [project.id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="font-medium text-ink text-[13px]">Description</div>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </div>
        <p className="text-[12.5px] text-muted leading-relaxed">
          {project.description || "No description added yet."}
        </p>
        {project.clientContact && (
          <div className="mt-4 pt-4 border-t border-line text-[12px]">
            <span className="text-muted">Client contact:</span>{" "}
            <span className="text-ink">{project.clientContact}</span>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-medium text-ink text-[13px] mb-2.5">Activity timeline</div>
        <div className="flex flex-col gap-2.5 text-[11.5px] max-h-72 overflow-y-auto">
          {timeline.length === 0 && (
            <div className="text-muted">No activity recorded yet.</div>
          )}
          {timeline.map((e) => (
            <div key={e.id} className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blueprint mt-1.5 shrink-0" />
              <div>
                {e.actor && (
                  <span className="text-ink">
                    {e.actor.firstName} {e.actor.lastName}
                  </span>
                )}{" "}
                <span className="text-muted">{actionLabel(e.action)}</span>
                <div className="text-muted font-mono text-[10.5px] mt-0.5">
                  {new Date(e.createdAt).toLocaleString("en-KE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {editOpen && canManage && (
        <EditProjectModal
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    PROJECT_CREATED: "created this project",
    PROJECT_UPDATED: "updated project details",
    PROJECT_ARCHIVED: "archived the project",
    PROJECT_DUPLICATED: "duplicated the project",
    PROJECT_ARCHITECT_ASSIGNED: "assigned an architect",
    PROJECT_ARCHITECT_UNASSIGNED: "unassigned an architect",
    PROJECT_SUPERVISOR_REASSIGNED: "reassigned the supervisor",
    PROJECT_TAKEOVER: "initiated a project takeover",
    DAILY_LOG_SUBMITTED: "submitted a daily log",
    DAILY_LOG_REVISED: "revised a daily log",
    DOCUMENT_UPLOADED: "uploaded a document",
    COMMUNICATION_RECORD_CREATED: "logged a client communication",
    FINANCIAL_RECORD_UPDATED: "updated financial records",
  };
  return map[action] ?? action.toLowerCase().replace(/_/g, " ");
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

function LogsTab({ projectId, canSubmit }: { projectId: string; canSubmit: boolean }) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    logsApi.list(projectId).then((r) => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  return (
    <div>
      {canSubmit && (
        <div className="mb-4">
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus size={14} /> Submit today&rsquo;s log
          </Button>
        </div>
      )}
      {loading ? <Spinner /> : logs.length === 0 ? (
        <Card>
          <EmptyState title="No daily logs yet" body="Assigned architects submit logs each working day." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex justify-between items-center mb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Avatar name={`${log.author.firstName} ${log.author.lastName}`} size="sm" />
                  <span className="text-ink font-medium text-[12.5px]">
                    {log.author.firstName} {log.author.lastName}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-muted">
                  {new Date(log.logDate).toLocaleDateString("en-KE", {
                    weekday: "long", month: "short", day: "numeric",
                  })}{" "}
                  · {log.progressPercentage}% complete
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                <LogField label="Work completed" value={log.workCompleted} />
                {log.challenges && <LogField label="Challenges" value={log.challenges} />}
                {log.pendingWork && <LogField label="Pending work" value={log.pendingWork} />}
                {log.nextActions && <LogField label="Next actions" value={log.nextActions} />}
              </div>
            </Card>
          ))}
        </div>
      )}
      {submitOpen && (
        <SubmitLogModal
          projectId={projectId}
          onClose={() => setSubmitOpen(false)}
          onSubmitted={() => { setSubmitOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function LogField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted mb-1">{label}</div>
      <p className="text-ink leading-relaxed">{value}</p>
    </div>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────────

function DocumentsTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    docsApi.list(projectId).then(setDocs).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const category = guessDocCategory(file.name, file.type);
      const { uploadUrl, storageKey } = await docsApi.requestUploadUrl(projectId, {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category,
      });
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      await docsApi.confirmUpload(projectId, {
        storageKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category,
      });
      load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Upload failed — check that AWS S3 credentials are configured on the backend.",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const { downloadUrl } = await docsApi.getDownloadUrl(projectId, doc.id);
      window.open(downloadUrl, "_blank");
    } catch {
      setError("Could not generate download link.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <label className={`flex items-center gap-1.5 px-4 py-2 bg-ink text-white rounded-md text-[12.5px] font-medium cursor-pointer hover:bg-ink/80 ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}>
          <Upload size={14} />
          {uploading ? "Uploading…" : "Upload document"}
          <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        <span className="text-[11px] text-muted">DWG, DXF, Revit, PDF, images, BOQ, contracts</span>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {loading ? <Spinner /> : docs.length === 0 ? (
        <Card className="p-8 text-center">
          <Upload size={22} className="mx-auto text-muted mb-2" />
          <div className="text-ink font-medium text-[13px]">No documents yet</div>
          <p className="text-muted text-[12px] mt-1">Upload drawings and documents using the button above.</p>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Version</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Uploaded by</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-line hover:bg-vellum">
                  <td className="px-4 py-3 font-medium text-ink">{d.fileName}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">
                    {d.category.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-muted font-mono hidden md:table-cell">v{d.version}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">
                    {d.uploadedBy.firstName} {d.uploadedBy.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">
                    {new Date(d.createdAt).toLocaleDateString("en-KE")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDownload(d)}
                      className="flex items-center gap-1 text-[11px] text-blueprint hover:underline"
                    >
                      <Download size={12} /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── Client comms tab ─────────────────────────────────────────────────────────

const COMM_TYPES = [
  { value: "MEETING_MINUTES", label: "Meeting minutes" },
  { value: "CLIENT_INSTRUCTION", label: "Client instruction" },
  { value: "DESIGN_COMMENT", label: "Design comment" },
  { value: "APPROVAL_RECORD", label: "Approval record" },
  { value: "EMAIL_SUMMARY", label: "Email summary" },
  { value: "CHANGE_REQUEST", label: "Change request" },
];

function CommsTab({ projectId, canAdd }: { projectId: string; canAdd: boolean }) {
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    commsApi.list(projectId, search || undefined).then(setComms).catch(() => {}).finally(() => setLoading(false));
  }, [projectId, search]);

  useEffect(load, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search communications…"
          className="border border-line rounded-md px-3 py-1.5 text-[12px] w-64 focus:outline-none focus:ring-2 focus:ring-blueprint/40"
        />
        {canAdd && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Log communication
          </Button>
        )}
      </div>

      {loading ? <Spinner /> : comms.length === 0 ? (
        <Card>
          <EmptyState
            title="No communications logged"
            body="Meeting minutes, client instructions, approvals, and change requests are all searchable once added."
            action={canAdd ? <Button onClick={() => setAddOpen(true)}><Plus size={14} />Log first entry</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {comms.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="inline-flex items-center rounded-[3px] px-2 py-0.5 text-[10px] font-medium tracking-wide bg-blueprint-bg text-blueprint">
                    {COMM_TYPES.find((t) => t.value === c.type)?.label ?? c.type}
                  </span>
                  <h3 className="font-medium text-ink text-[13px] mt-1">{c.subject}</h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[11px] text-muted">
                    {new Date(c.occurredAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {c.createdBy.firstName} {c.createdBy.lastName}
                  </div>
                </div>
              </div>
              <p className="text-[12.5px] text-muted leading-relaxed">{c.content}</p>
            </Card>
          ))}
        </div>
      )}

      {addOpen && (
        <AddCommModal
          projectId={projectId}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Finance tab ──────────────────────────────────────────────────────────────

function FinanceTab({
  projectId,
  canEdit,
  initial,
  onRefresh,
}: {
  projectId: string;
  canEdit: boolean;
  initial?: FinancialRecord;
  onRefresh: () => void;
}) {
  const [record, setRecord] = useState<FinancialRecord | null>(initial ?? null);
  const [contractValue, setContractValue] = useState(record?.contractValue ?? "");
  const [amountInvoiced, setAmountInvoiced] = useState(record?.amountInvoiced ?? "");
  const [amountPaid, setAmountPaid] = useState(record?.amountPaid ?? "");
  const [paymentDueDate, setPaymentDueDate] = useState(record?.paymentDueDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const outstanding = Number(amountInvoiced || 0) - Number(amountPaid || 0);
  const paidPct = Number(amountInvoiced) > 0
    ? Math.min(100, Math.round((Number(amountPaid) / Number(amountInvoiced)) * 100))
    : 0;

  const statusColor: Record<string, string> = {
    PAID: "text-moss",
    OVERDUE: "text-brick",
    PARTIALLY_PAID: "text-ochre",
    INVOICED: "text-blueprint",
    NOT_INVOICED: "text-muted",
  };

  async function handleSave() {
    if (!contractValue) { setError("Contract value is required."); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      const r = await financeApi.upsertProject(projectId, {
        contractValue: Number(contractValue),
        amountInvoiced: amountInvoiced ? Number(amountInvoiced) : undefined,
        amountPaid: amountPaid ? Number(amountPaid) : undefined,
        paymentDueDate: paymentDueDate || undefined,
      });
      setRecord(r);
      setSuccess(true);
      onRefresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
      {/* Summary cards */}
      <div className="flex flex-col gap-3">
        {[
          { label: "Contract value", value: formatKsh(Number(contractValue || 0)) },
          { label: "Total invoiced", value: formatKsh(Number(amountInvoiced || 0)) },
          { label: "Amount paid", value: formatKsh(Number(amountPaid || 0)), cls: "text-moss" },
          { label: "Outstanding balance", value: formatKsh(outstanding), cls: outstanding > 0 ? "text-brick" : "text-moss" },
        ].map((item) => (
          <Card key={item.label} className="p-3.5">
            <div className="text-muted text-[11px]">{item.label}</div>
            <div className={`font-mono font-medium text-[19px] mt-0.5 ${item.cls ?? "text-ink"}`}>
              {item.value}
            </div>
          </Card>
        ))}
        {record && (
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Payment status</div>
            <div className={`font-medium text-[14px] mt-1 ${statusColor[record.paymentStatus] ?? "text-ink"}`}>
              {record.paymentStatus.replace(/_/g, " ")}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-moss transition-all"
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="text-muted text-[11px] mt-1">{paidPct}% of invoiced amount paid</div>
          </Card>
        )}
      </div>

      {/* Edit form */}
      {canEdit && (
        <Card className="p-4">
          <div className="font-medium text-ink text-[13px] mb-4">Update financial record</div>
          <div className="flex flex-col gap-3.5">
            <Field label="Contract value (KES)" required>
              <Input type="number" value={String(contractValue)} onChange={(e) => setContractValue(e.target.value)} placeholder="18500000" />
            </Field>
            <Field label="Amount invoiced (KES)">
              <Input type="number" value={String(amountInvoiced)} onChange={(e) => setAmountInvoiced(e.target.value)} placeholder="11000000" />
            </Field>
            <Field label="Amount paid (KES)">
              <Input type="number" value={String(amountPaid)} onChange={(e) => setAmountPaid(e.target.value)} placeholder="9200000" />
            </Field>
            <Field label="Payment due date">
              <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />
            </Field>
            {error && <ErrorBanner message={error} />}
            {success && <SuccessBanner message="Financial record saved." />}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save payment record"}
            </Button>
          </div>
        </Card>
      )}
      {!canEdit && !record && (
        <Card className="p-6 text-center text-muted text-[12px]">
          No financial information recorded yet.
        </Card>
      )}
    </div>
  );
}

// ─── Sub-modals ───────────────────────────────────────────────────────────────

function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [progress, setProgress] = useState(String(project.progressPercentage));
  const [dueDate, setDueDate] = useState(project.expectedCompletionDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      await projectsApi.update(project.id, {
        name, description, status,
        progressPercentage: Number(progress),
        expectedCompletionDate: dueDate || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Edit project details">
      <div className="flex flex-col gap-3.5 mb-4">
        <Field label="Project name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {["PLANNING", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED"].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Progress — ${progress}%`}>
            <input
              type="range" min={0} max={100}
              value={progress} onChange={(e) => setProgress(e.target.value)}
              className="w-full mt-1 accent-blueprint"
            />
          </Field>
        </div>
        <Field label="Expected completion">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function AssignModal({
  projectId, architects, supervisors, current, onClose, onDone,
}: {
  projectId: string;
  architects: User[];
  supervisors: User[];
  current: Project;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedArchitectId, setSelectedArchitectId] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [unassignId, setUnassignId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    if (!selectedArchitectId) { setError("Select an architect to assign."); return; }
    setSaving(true); setError(null);
    try {
      await assignments.assignArchitect(projectId, selectedArchitectId, reason || undefined);
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not assign."); }
    finally { setSaving(false); }
  }

  async function handleReassignSupervisor() {
    if (!selectedSupervisorId) { setError("Select a new supervisor."); return; }
    setSaving(true); setError(null);
    try {
      await assignments.reassignSupervisor(projectId, selectedSupervisorId, reason || undefined);
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not reassign."); }
    finally { setSaving(false); }
  }

  async function handleUnassign() {
    if (!unassignId) { setError("Select an architect to remove."); return; }
    setSaving(true); setError(null);
    try {
      await assignments.unassignArchitect(projectId, unassignId);
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not unassign."); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Manage staff assignments" width="md">
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-[12px] font-medium text-ink mb-2">Assign architect</div>
          <div className="flex gap-2">
            <Select value={selectedArchitectId} onChange={(e) => setSelectedArchitectId(e.target.value)} className="flex-1">
              <option value="">Select architect…</option>
              {architects.map((a) => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </Select>
            <Button onClick={handleAssign} disabled={saving}>Assign</Button>
          </div>
        </div>

        {current.assignments.length > 0 && (
          <div>
            <div className="text-[12px] font-medium text-ink mb-2">Remove architect</div>
            <div className="flex gap-2">
              <Select value={unassignId} onChange={(e) => setUnassignId(e.target.value)} className="flex-1">
                <option value="">Select to remove…</option>
                {current.assignments.map((a) => (
                  <option key={a.user.id} value={a.user.id}>
                    {a.user.firstName} {a.user.lastName}
                  </option>
                ))}
              </Select>
              <Button variant="danger" onClick={handleUnassign} disabled={saving}>Remove</Button>
            </div>
          </div>
        )}

        <div>
          <div className="text-[12px] font-medium text-ink mb-2">Reassign supervisor</div>
          <div className="flex gap-2">
            <Select value={selectedSupervisorId} onChange={(e) => setSelectedSupervisorId(e.target.value)} className="flex-1">
              <option value="">Select new supervisor…</option>
              {supervisors.filter((s) => s.id !== current.supervisor.id).map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={handleReassignSupervisor} disabled={saving}>Reassign</Button>
          </div>
        </div>

        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Workload balancing" />
        </Field>

        {error && <ErrorBanner message={error} />}
      </div>
    </Modal>
  );
}

function TakeoverModal({
  project, architects, onClose, onDone,
}: {
  project: Project;
  architects: User[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [toUserId, setToUserId] = useState("");
  const [fromUserId, setFromUserId] = useState(project.assignments[0]?.user.id ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTakeover() {
    setSaving(true); setError(null);
    try {
      await takeoverApi.initiate(project.id, {
        toUserId: toUserId || undefined,
        fromUserId: fromUserId || undefined,
        reason: reason || undefined,
      });
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Takeover failed."); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Take over — ${project.name}`} subtitle="The new architect gets full, instant access to every drawing, log, communication, and financial record." width="md">
      <div className="flex flex-col gap-3.5 mb-4">
        <Field label="Unassign from">
          <Select value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
            <option value="">Nobody (add-only)</option>
            {project.assignments.map((a) => (
              <option key={a.user.id} value={a.user.id}>
                {a.user.firstName} {a.user.lastName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assign to" required>
          <Select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            <option value="">Select replacement architect…</option>
            {architects.map((a) => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reason for handover">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Staff departure, project re-scope" />
        </Field>
      </div>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={handleTakeover} disabled={saving || !toUserId}>
          <RefreshCw size={13} />
          {saving ? "Processing…" : "Confirm takeover"}
        </Button>
      </div>
    </Modal>
  );
}

function SubmitLogModal({
  projectId, onClose, onSubmitted,
}: { projectId: string; onClose: () => void; onSubmitted: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [logDate, setLogDate] = useState(today);
  const [workCompleted, setWorkCompleted] = useState("");
  const [challenges, setChallenges] = useState("");
  const [pendingWork, setPendingWork] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [progress, setProgress] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!workCompleted.trim()) { setError("Work completed is required."); return; }
    setSaving(true); setError(null);
    try {
      await logsApi.submit(projectId, {
        logDate,
        workCompleted,
        challenges: challenges || undefined,
        pendingWork: pendingWork || undefined,
        nextActions: nextActions || undefined,
        progressPercentage: Number(progress),
      });
      onSubmitted();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not submit."); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Submit daily log" width="md">
      <div className="flex flex-col gap-3.5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={logDate} max={today} onChange={(e) => setLogDate(e.target.value)} />
          </Field>
          <Field label={`Progress — ${progress}%`}>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className="w-full mt-2 accent-blueprint" />
          </Field>
        </div>
        <Field label="Work completed" required>
          <Textarea value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} rows={3} placeholder="Describe the work done today…" />
        </Field>
        <Field label="Challenges encountered">
          <Textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={2} placeholder="Any blockers or issues…" />
        </Field>
        <Field label="Pending work">
          <Textarea value={pendingWork} onChange={(e) => setPendingWork(e.target.value)} rows={2} placeholder="What is still outstanding…" />
        </Field>
        <Field label="Next actions">
          <Textarea value={nextActions} onChange={(e) => setNextActions(e.target.value)} rows={2} placeholder="Steps planned for tomorrow…" />
        </Field>
      </div>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? "Submitting…" : "Submit log"}</Button>
      </div>
    </Modal>
  );
}

function AddCommModal({
  projectId, onClose, onAdded,
}: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState("MEETING_MINUTES");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!subject.trim() || !content.trim()) { setError("Subject and content are required."); return; }
    setSaving(true); setError(null);
    try {
      await commsApi.create(projectId, {
        type: type as import("@/lib/api").CommunicationType,
        subject,
        content,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      onAdded();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not add."); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Log client communication">
      <div className="flex flex-col gap-3.5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {COMM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Subject" required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Client review of floor plan revision B" />
        </Field>
        <Field label="Content / notes" required>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Record the key points, decisions, and follow-ups…" />
        </Field>
      </div>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </Modal>
  );
}
