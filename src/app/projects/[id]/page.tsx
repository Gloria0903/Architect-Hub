"use client";
import { use, useState, useRef } from "react";
import { notFound, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, Field, FormRow } from "@/components/ui/form-field";
import { useStore, formatKsh, formatFileSize, commentTypeLabel, priorityLabel, ProjectStatus, Priority } from "@/store/app-store";
import Link from "next/link";
import { Repeat, Upload, FileText, MessageSquare, Wallet, History, CheckCircle, Pencil, Trash2, Download, File as FileIcon, ArrowRightLeft, Eye, EyeOff, Archive } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { calculateFinancialProgress } from "@/lib/project-progress";

const tabs = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "logs", label: "Daily logs", icon: History },
  { key: "documents", label: "Documents", icon: Upload },
  { key: "comms", label: "Client comms", icon: MessageSquare },
  { key: "finance", label: "Finance", icon: Wallet },
] as const;
type TabKey = (typeof tabs)[number]["key"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const {
    projects, staff, clients, logs, comments, payments, documents,
    addPayment, reassignProject, resolveComment, updateProject, removeProject,
    uploadDocument, removeDocument, toggleDocumentVisibility,
  } = useStore();

  const projectData = projects.find(p => p.id === id);
  if (!projectData) notFound();
  const project = projectData;

  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const canEdit = isAdmin || project.architectId === session?.user?.id || project.supervisorId === session?.user?.id;
  const canReassign = isAdmin;

  const [tab, setTab] = useState<TabKey>("overview");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [payForm, setPayForm] = useState({ amount: "", date: "", reference: "", note: "" });
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
  name: project.name,
  description: project.description ?? "",
  status: project.status as ProjectStatus,
  priority: project.priority as Priority,
  dueDate: project.dueDate,
});
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const client = clients.find(c => c.id === project.clientId);
  const architect = staff.find(s => s.id === project.architectId);
  const supervisor = staff.find(s => s.id === project.supervisorId);
  const architects = staff.filter(s => s.role === "ARCHITECT");
  const projectLogs = logs.filter(l => l.projectId === project.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const projectComments = comments.filter(c => c.projectId === project.id);
  const projectPayments = payments.filter(p => p.projectId === project.id);
  const projectDocuments = documents.filter(d => d.projectId === project.id);

  function handleReassign() {
    if (!reassignTo) return;
    reassignProject(project.id, reassignTo, reassignReason);
    setReassignOpen(false); setReassignTo(""); setReassignReason("");
  }

  function handlePayment(e: React.FormEvent) {
  e.preventDefault();

  const amount = Number(payForm.amount);

  if (!amount || amount <= 0) {
    alert("Please enter a valid payment amount.");
    return;
  }

  if (!payForm.date) {
    alert("Please select the payment date.");
    return;
  }

  const currentOutstanding = Math.max(
    Number(project.budget || 0) -
      Number(project.paid || 0),
    0
  );

  if (currentOutstanding <= 0) {
    alert("This project has no outstanding balance.");
    return;
  }

  if (amount > currentOutstanding) {
    alert(
      `Payment cannot exceed the outstanding contract balance of ${formatKsh(
        currentOutstanding
      )}.`
    );
    return;
  }

  addPayment({
    projectId: project.id,
    amount,
    date: payForm.date,
    reference: payForm.reference,
    note: payForm.note,
  });

  setPayOpen(false);

  setPayForm({
    amount: "",
    date: "",
    reference: "",
    note: "",
  });
}

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    updateProject(project.id, editForm);
    setEditOpen(false);
  }

  async function handleArchiveProject() {
    if (!confirm(`Archive project "${project.name}"? It'll be hidden from the active projects list, but its logs, documents, comments and payments are kept and can be restored later.`)) return;
    await removeProject(project.id);
    router.push("/projects");
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploadError("");
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        await uploadDocument(project.id, file);
      }
    } catch (e) {
      setUploadError((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(docId: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await removeDocument(docId);
  }

  const contractValue = Number(project.budget || 0);
const invoiced = Number(project.invoiced || 0);
const paid = Number(project.paid || 0);

const financialProgress =
  calculateFinancialProgress({
    contractValue: project.budget,
    invoiced: project.invoiced,
    paid: project.paid,
  });

const outstanding =
  financialProgress.outstanding;

const collectedPercentage =
  financialProgress.collectedPercentage;

const invoicedPercentage =
  contractValue > 0
    ? Math.min(Math.round((invoiced / contractValue) * 100), 100)
    : 0;

const paidPercentage =
  contractValue > 0
    ? Math.min(Math.round((paid / contractValue) * 100), 100)
    : 0;

const outstandingPercentage =
  contractValue > 0
    ? Math.min(Math.round((outstanding / contractValue) * 100), 100)
    : 0;
  const statusColor = project.status === "ON_TRACK" ? "#2F7A5E" : project.status === "AT_RISK" ? "#B07F1F" : "#B5502E";

  return (
    <AppShell>
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <div className="font-mono text-[11.5px] text-muted">{project.sheetNo} · {project.location}</div>
            <h1 className="font-display font-bold text-[21px] text-ink mt-0.5">{project.name}</h1>
            <p className="text-muted text-[12.5px] mt-1">{client?.name} — {client?.contactPerson}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <StatusPill status={project.status} className="px-2.5 py-1" />
            {canEdit && (
              <Link href={`/projects/${project.id}/takeover`} className="flex items-center gap-1.5 border border-blueprint text-blueprint rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-blueprint-bg">
                <ArrowRightLeft size={14} />Take over
              </Link>
            )}
            {canEdit && (
              <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 border border-line text-ink rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-vellum">
                <Pencil size={14} />Edit
              </button>
            )}
            {canReassign && (
              <button onClick={() => setReassignOpen(true)} className="flex items-center gap-1.5 bg-brick text-white rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-brick/90">
                <Repeat size={14} />Reassign
              </button>
            )}
            {isAdmin && (
              <button onClick={handleArchiveProject} className="flex items-center gap-1.5 border border-line text-brick rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-brick-bg">
                <Archive size={14} />Archive
              </button>
            )}
          </div>
        </div>

        {/* Project meta */}
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[12px]">
            <div><div className="text-muted mb-1">Architect</div><div className="text-ink font-medium">{architect?.name ?? <span className="text-brick">Unassigned</span>}</div></div>
            <div><div className="text-muted mb-1">Supervisor</div><div className="text-ink font-medium">{supervisor?.name ?? "—"}</div></div>
            <div><div className="text-muted mb-1">Start date</div><div className="text-ink font-mono">{project.startDate}</div></div>
            <div><div className="text-muted mb-1">Due date</div><div className="text-ink font-mono">{project.dueDate}</div></div>
            <div><div className="text-muted mb-1">Priority</div><div className={`font-medium ${project.priority === "HIGH" ? "text-brick" : project.priority === "MEDIUM" ? "text-ochre" : "text-muted"}`}>{priorityLabel(project.priority)}</div></div>
          </div>
          <div className="mt-4 pt-3 border-t border-line">
            <div className="flex items-center justify-between mb-1.5">
  <div>
    <div className="text-muted text-[12px]">
      Overall project progress
    </div>

    <div className="text-[10px] text-muted mt-0.5">
      Based on tasks and milestones
    </div>
  </div>

  <div
    className="font-mono text-[12px]"
    style={{ color: statusColor }}
  >
    {project.progress}%
  </div>
</div>

<div className="w-full h-2 bg-line rounded-full overflow-hidden">
  <div
    className="h-full rounded-full transition-all"
    style={{
      width: `${project.progress}%`,
      background: statusColor,
    }}
  />
</div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-0 mb-4 border-b border-line overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.key ? "border-blueprint text-ink font-medium" : "border-transparent text-muted hover:text-ink"}`}>
                <Icon size={14} />{t.label}
                {t.key === "logs" && projectLogs.length > 0 && <span className="ml-1 bg-blueprint-bg text-blueprint text-[10px] rounded-full px-1.5 font-medium">{projectLogs.length}</span>}
                {t.key === "documents" && projectDocuments.length > 0 && <span className="ml-1 bg-blueprint-bg text-blueprint text-[10px] rounded-full px-1.5 font-medium">{projectDocuments.length}</span>}
                {t.key === "comms" && projectComments.filter(c=>!c.resolvedAt).length > 0 && <span className="ml-1 bg-brick-bg text-brick text-[10px] rounded-full px-1.5 font-medium">{projectComments.filter(c=>!c.resolvedAt).length}</span>}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="font-medium text-ink text-[13px] mb-2">Project description</div>
              <p className="text-[12.5px] text-muted leading-relaxed">{project.description}</p>
              {(project.assignmentHistory?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-line">
                  <div className="font-medium text-ink text-[12px] mb-2">Reassignment history</div>
                  {(project.assignmentHistory ?? []).map(r => (
                    <div key={r.id} className="text-[11.5px] mb-2">
                      <span className="text-muted">{r.date}</span> · Reassigned from <span className="text-ink">{r.fromArchitect?.name ?? "Unassigned"}</span> to <span className="text-ink">{r.toArchitect?.name}</span>
                      {r.performedBy && <span className="text-muted"> (by {r.performedBy.name})</span>}
                      {r.reason && <div className="text-muted mt-0.5 italic">{r.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4">
  <div className="font-medium text-ink text-[13px] mb-2">
    Financial snapshot
  </div>

  <div className="grid grid-cols-2 gap-3 text-[12px]">
    <div>
      <div className="text-muted mb-0.5">
        Contract value
      </div>

      <div className="font-mono text-ink">
        {formatKsh(financialProgress.contractValue)}
      </div>
    </div>

    <div>
      <div className="text-muted mb-0.5">
        Invoiced
      </div>

      <div className="font-mono text-ink">
        {formatKsh(financialProgress.invoiced)}
      </div>

      <div className="text-[10px] text-muted mt-0.5">
        {invoicedPercentage.toFixed(2)}% of contract
      </div>
    </div>

    <div>
      <div className="text-muted mb-0.5">
        Paid
      </div>

      <div className="font-mono text-moss">
        {formatKsh(financialProgress.paid)}
      </div>

      <div className="text-[10px] text-moss mt-0.5">
        {collectedPercentage.toFixed(2)}% collected
      </div>
    </div>

    <div>
      <div className="text-muted mb-0.5">
        Outstanding
      </div>

      <div className="font-mono text-brick">
        {formatKsh(financialProgress.outstanding)}
      </div>

      <div className="text-[10px] text-brick mt-0.5">
        {(100 - collectedPercentage).toFixed(2)}% remaining
      </div>
    </div>
  </div>

  <div className="mt-3 pt-3 border-t border-line">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] text-muted">
        Payment collection
      </span>

      <span className="text-[11px] font-mono text-moss">
        {collectedPercentage.toFixed(2)}%
      </span>
    </div>

    <div className="w-full h-2 bg-line rounded-full overflow-hidden">
      <div
        className="h-full bg-moss rounded-full transition-all"
        style={{
          width: `${collectedPercentage}%`,
        }}
      />
    </div>

    <div className="flex items-center justify-between text-[10.5px] mt-1">
      <span className="text-muted">
        {formatKsh(financialProgress.paid)} received
      </span>

      <span className="text-brick">
        {formatKsh(financialProgress.outstanding)} remaining
      </span>
    </div>
  </div>
</Card>
          </div>
        )}

        {/* Daily logs */}
        {tab === "logs" && (
          <div className="flex flex-col gap-3">
            {projectLogs.length === 0 && <Card className="p-8 text-center text-muted text-[12.5px]">No daily logs submitted for this project yet.</Card>}
            {projectLogs.map(log => {
              const author = staff.find(s => s.id === log.authorId);
              return (
                <Card key={log.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar avatarUrl={author?.avatarUrl} initials={author?.initials} name={author?.name} size={28} fontSize={10} />
                      <div>
                        <div className="text-ink font-medium text-[12.5px]">{author?.name}</div>
                        <div className="text-muted text-[11px]">{log.date}</div>
                      </div>
                    </div>
                    <div className="font-mono text-[12px]" style={{color:"#2451C4"}}>{log.progress}% complete</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                    <div><div className="text-muted mb-1 text-[11px] uppercase tracking-wide">Work completed</div><p className="text-ink leading-relaxed">{log.workCompleted}</p></div>
                    <div><div className="text-muted mb-1 text-[11px] uppercase tracking-wide">Challenges</div><p className="text-ink leading-relaxed">{log.challenges}</p></div>
                    <div><div className="text-muted mb-1 text-[11px] uppercase tracking-wide">Pending</div><p className="text-ink leading-relaxed">{log.pendingWork}</p></div>
                    <div><div className="text-muted mb-1 text-[11px] uppercase tracking-wide">Next actions</div><p className="text-ink leading-relaxed">{log.nextActions}</p></div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Documents */}
        {tab === "documents" && (
          <div className="flex flex-col gap-3">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
            <Card
              className={`p-8 text-center cursor-pointer transition-colors ${dragging ? "border-blueprint bg-blueprint-bg" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            >
              <Upload size={24} className="mx-auto text-muted mb-3" />
              <div className="text-ink font-medium text-[13px]">{uploading ? "Uploading…" : dragging ? "Drop files here" : "Drag and drop drawings or documents"}</div>
              <p className="text-muted text-[12px] mt-1">Supports DWG, DXF, Revit, PDF, images, BOQs, contracts and reports (up to 50MB).</p>
              <button type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }} className="mt-3 bg-ink text-white rounded-md px-4 py-2 text-[12px] font-medium">Browse files</button>
            </Card>
            {uploadError && <p className="text-brick text-[12px]">{uploadError}</p>}

            {projectDocuments.length === 0 ? (
              <Card className="p-6 text-center text-muted text-[12.5px]">No documents uploaded for this project yet.</Card>
            ) : (
              <Card className="divide-y divide-line overflow-hidden">
                {projectDocuments.map(d => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileIcon size={16} className="text-muted shrink-0" />
                      <div className="min-w-0">
                        <div className="text-ink font-medium text-[12.5px] truncate">{d.name}</div>
                        <div className="text-muted text-[11px] font-mono">{formatFileSize(d.fileSize)} · {new Date(d.uploadedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => toggleDocumentVisibility(d.id, !d.clientVisible)}
                        className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-[3px] font-medium ${d.clientVisible ? "bg-moss-bg text-moss" : "text-muted hover:text-ink"}`}
                        title={d.clientVisible ? "Visible to client in the Client Portal — click to hide" : "Not visible to client — click to share via Client Portal"}
                      >
                        {d.clientVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                        {d.clientVisible ? "Client can see" : "Not shared"}
                      </button>
                      <a href={d.fileUrl} download={d.name} className="text-blueprint hover:text-blueprint/70" title="Download"><Download size={15} /></a>
                      <button onClick={() => handleDeleteDoc(d.id, d.name)} className="text-muted hover:text-brick" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* Client comms */}
        {tab === "comms" && (
          <div className="flex flex-col gap-3">
            {projectComments.length === 0 && <Card className="p-8 text-center text-muted text-[12.5px]">No client communications recorded for this project.</Card>}
            {projectComments.map(c => (
              <Card key={c.id} className={`p-4 ${c.resolvedAt ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-ink font-medium text-[13px]">{c.author}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-[3px] font-medium ${c.type === "CHANGE_REQUEST" ? "bg-brick-bg text-brick" : c.type === "APPROVAL" ? "bg-moss-bg text-moss" : c.type === "QUERY" ? "bg-blueprint-bg text-blueprint" : "bg-ochre-bg text-ochre"}`}>{commentTypeLabel(c.type)}</span>
                    </div>
                    <p className="text-[12.5px] text-ink leading-relaxed">{c.content}</p>
                    <div className="text-[11px] text-muted mt-2 font-mono">
                      {new Date(c.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                      {c.resolvedAt && <span className="ml-3 text-moss">✓ Resolved</span>}
                    </div>
                  </div>
                  {!c.resolvedAt && (
                    <button onClick={() => resolveComment(c.id)} className="flex items-center gap-1 text-[11px] text-moss border border-moss/30 rounded px-2 py-1 hover:bg-moss-bg shrink-0">
                      <CheckCircle size={12} />Resolve
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Finance */}
        {tab === "finance" && (
  <div className="flex flex-col gap-3">

    {/* FINANCIAL SUMMARY */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

      {/* CONTRACT */}
      <Card className="p-3.5">
        <div className="text-muted text-[11px]">
          Contract value
        </div>

        <div className="font-mono font-medium text-[16px] text-ink mt-1">
          {formatKsh(contractValue)}
        </div>

        <div className="text-[10.5px] text-muted mt-1">
          100% contract value
        </div>
      </Card>

      {/* INVOICED */}
      <Card className="p-3.5">
        <div className="text-muted text-[11px]">
          Invoiced
        </div>

        <div className="font-mono font-medium text-[16px] text-ink mt-1">
          {formatKsh(invoiced)}
        </div>

        <div className="text-[10.5px] text-blueprint mt-1">
          {invoicedPercentage}% of contract
        </div>
      </Card>

      {/* PAID */}
      <Card className="p-3.5">
        <div className="text-muted text-[11px]">
          Paid
        </div>

        <div className="font-mono font-medium text-[16px] text-moss mt-1">
          {formatKsh(paid)}
        </div>

        <div className="text-[10.5px] text-moss mt-1">
          {paidPercentage}% collected
        </div>
      </Card>

      {/* OUTSTANDING */}
      <Card
        className="p-3.5 cursor-pointer hover:border-moss transition-colors"
        onClick={() => setPayOpen(true)}
      >
        <div className="text-muted text-[11px]">
          Outstanding
        </div>

        <div className="font-mono font-medium text-[16px] text-brick mt-1">
          {formatKsh(outstanding)}
        </div>

        <div className="text-[10.5px] text-brick mt-1">
          {outstandingPercentage}% outstanding
        </div>
      </Card>

    </div>

    {/* PAYMENT PROGRESS */}
    <Card className="p-4">

      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-ink text-[12.5px]">
          Payment progress
        </div>

        <div className="font-mono text-[11px] text-moss">
          {paidPercentage}% collected
        </div>
      </div>

      <div className="w-full h-2.5 bg-line rounded-full overflow-hidden">
        <div
          className="h-full bg-moss rounded-full transition-all"
          style={{
            width: `${paidPercentage}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-[10.5px] text-muted">
          Received: {formatKsh(paid)}
        </div>

        <div className="text-[10.5px] text-brick">
          Outstanding: {formatKsh(outstanding)}
        </div>
      </div>

    </Card>

    {/* PAYMENT HISTORY */}
    <Card className="overflow-hidden">

      <div className="px-4 py-3 border-b border-line flex items-center justify-between">

        <div className="font-medium text-ink text-[12.5px]">
          Payment history
        </div>

        <button
          onClick={() => setPayOpen(true)}
          className="text-[11.5px] text-moss font-medium"
        >
          + Record payment
        </button>

      </div>

      {projectPayments.length === 0 ? (
        <div className="p-6 text-center text-muted text-[12.5px]">
          No payments recorded yet.
        </div>
      ) : (
        projectPayments.map(pay => (
          <div
            key={pay.id}
            className="px-4 py-3 border-t border-line flex items-center justify-between"
          >
            <div>
              <div className="text-ink text-[12.5px] font-medium">
                {pay.note || "Payment"}
              </div>

              <div className="text-muted text-[11.5px] font-mono mt-0.5">
                {pay.reference || "No reference"} · {pay.date}
                {pay.recordedBy &&
                  ` · recorded by ${pay.recordedBy.name}`}
              </div>
            </div>

            <div className="font-mono text-moss font-medium">
              {formatKsh(pay.amount)}
            </div>
          </div>
        ))
      )}

    </Card>

  </div>
)}

        {/* Reassign Modal */}
        <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign project" subtitle="New architect gets instant access to all project history">
          <div className="flex flex-col gap-3.5">
            <div className="bg-vellum rounded-md p-3 text-[12.5px]">
              <div className="text-muted">Currently assigned to</div>
              <div className="text-ink font-medium mt-0.5">{architect?.name ?? <span className="text-brick">Unassigned</span>}</div>
            </div>
            <Field label="Reassign to" required>
              <Select value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                <option value="">Select architect</option>
                {architects.filter(a => a.id !== project.architectId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Reason">
              <Textarea rows={2} value={reassignReason} onChange={e => setReassignReason(e.target.value)} placeholder="Reason for reassignment…" />
            </Field>
            <div className="flex justify-end gap-2 pt-1 border-t border-line">
              <button onClick={() => setReassignOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button onClick={handleReassign} disabled={!reassignTo} className="px-4 py-2 rounded-md text-[12.5px] bg-brick text-white font-medium disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </Modal>

        {/* Edit Project Modal */}
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit project" maxWidth="max-w-xl">
          <form onSubmit={handleEdit} className="flex flex-col gap-3.5">
            <Field label="Project name" required><Input required value={editForm.name} onChange={e => setEditForm(f=>({...f,name:e.target.value}))} /></Field>
            <Field label="Description"><Textarea rows={3} value={editForm.description} onChange={e => setEditForm(f=>({...f,description:e.target.value}))} /></Field>
            <FormRow>
              <Field label="Status">
                <Select value={editForm.status} onChange={e => setEditForm(f=>({...f,status:e.target.value as ProjectStatus}))}>
                  <option value="ON_TRACK">On track</option>
                  <option value="AT_RISK">At risk</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="COMPLETED">Completed</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={editForm.priority} onChange={e => setEditForm(f=>({...f,priority:e.target.value as Priority}))}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </Select>
              </Field>
            </FormRow>
            <div className="grid grid-cols-1 gap-3">
  <div className="rounded-md border border-line bg-vellum px-3 py-2.5">
    <div className="text-[11px] text-muted">
      Project progress
    </div>

    <div className="text-[12.5px] text-ink font-medium mt-0.5">
      Automatically calculated from tasks and milestones
    </div>

    <div className="text-[10.5px] text-muted mt-0.5">
      Update task completion or milestone status to change the
      overall project progress.
    </div>
  </div>

  <Field label="Due date">
    <Input
      type="date"
      value={editForm.dueDate}
      onChange={e =>
        setEditForm(f => ({
          ...f,
          dueDate: e.target.value
        }))
      }
    />
  </Field>
</div>
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Save changes</button>
            </div>
          </form>
        </Modal>

        {/* Payment Modal */}
        <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment">
          <form onSubmit={handlePayment} className="flex flex-col gap-3.5">
            <Field label="Amount (KSh)" required><input required type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} className="w-full border border-line rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-blueprint" placeholder="e.g. 2500000" /></Field>
            <Field label="Payment date" required><input required type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} className="w-full border border-line rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-blueprint" /></Field>
            <Field label="Reference"><input value={payForm.reference} onChange={e=>setPayForm(f=>({...f,reference:e.target.value}))} className="w-full border border-line rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-blueprint" placeholder="e.g. INV-A101-003" /></Field>
            <Field label="Note"><textarea rows={2} value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} className="w-full border border-line rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-blueprint resize-none" placeholder="e.g. Second stage payment" /></Field>
            <div className="flex justify-end gap-2 pt-1 border-t border-line">
              <button type="button" onClick={() => setPayOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-moss text-white font-medium">Record payment</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
