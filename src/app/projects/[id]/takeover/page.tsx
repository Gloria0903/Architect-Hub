"use client";
import { use, useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Field, Select, Textarea } from "@/components/ui/form-field";
import {
  useStore,
  formatKsh,
  formatFileSize,
  commentTypeLabel,
  priorityLabel,
} from "@/store/app-store";
import {
  ArrowLeft,
  FileText,
  Upload,
  MessageSquare,
  Wallet,
  History,
  CheckCircle,
  AlertTriangle,
  Repeat,
  Download,
  Clock,
} from "lucide-react";

/**
 * Take Over Project — the platform's flagship "knowledge continuity" feature.
 *
 * When an architect is unavailable, whoever is picking up the project (or an
 * admin arranging the handover) needs one screen that answers "where does
 * this project actually stand right now?" without hunting through email,
 * personal folders, or the previous architect. Everything here is read from
 * the same live store the rest of the app uses — nothing is duplicated or
 * cached separately, so this can never drift from reality.
 *
 * Viewing the dossier is available to anyone with legitimate access to the
 * project (its current architect/supervisor, or an admin) — that's the
 * point of continuity. Actually confirming a handover (reassigning the
 * project) is admin-gated, same as the existing reassign flow, since it's
 * a formal ownership change with notification and audit-trail consequences.
 */
export default function TakeOverProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { projects, staff, clients, logs, comments, payments, documents, reassignProject } = useStore();

  const projectData = projects.find(p => p.id === id);
  if (!projectData) notFound();
  const project = projectData;

  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const isSeniorArchitect = role === "SENIOR_ARCHITECT";
  // Take-over is a project reassignment under the hood (reassignProject ->
  // /api/projects/[id]/reassign), and that route now permits Senior
  // Architects too (see rbac.ts canReassignProjects) -- this was left as
  // admin-only client-side, which just meant a senior architect saw no
  // confirm button even though the backend would have accepted the call.
  const hasFirmWideView = isAdmin || isSeniorArchitect;
  const canView =
    hasFirmWideView || project.architectId === session?.user?.id || project.supervisorId === session?.user?.id;
  const canConfirmHandover = hasFirmWideView;

  const client = clients.find(c => c.id === project.clientId);
  const currentArchitect = staff.find(s => s.id === project.architectId);
  const supervisor = staff.find(s => s.id === project.supervisorId);
  const otherArchitects = staff.filter(s => s.role === "ARCHITECT" && s.id !== project.architectId);

  const projectLogs = useMemo(
    () =>
      logs
        .filter(l => l.projectId === project.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [logs, project.id]
  );
  const projectDocuments = useMemo(
    () =>
      documents
        .filter(d => d.projectId === project.id)
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
    [documents, project.id]
  );
  const projectComments = useMemo(
    () =>
      comments
        .filter(c => c.projectId === project.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments, project.id]
  );
  const projectPayments = useMemo(
    () => payments.filter(p => p.projectId === project.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments, project.id]
  );

  const latestLog = projectLogs[0];
  const outstandingComments = projectComments.filter(c => !c.resolvedAt);
  const pendingApprovals = projectComments.filter(c => c.type === "APPROVAL" && !c.resolvedAt);
  const outstandingBalance = project.invoiced - project.paid;

  // Has a log been submitted today? Compares by calendar day, not raw string,
  // so this stays correct regardless of timezone/serialization format.
  const todayKey = new Date().toISOString().split("T")[0];
  const hasLogToday = projectLogs.some(l => new Date(l.date).toISOString().split("T")[0] === todayKey);
  const daysSinceLastLog = latestLog
    ? Math.floor((new Date(todayKey).getTime() - new Date(new Date(latestLog.date).toISOString().split("T")[0]).getTime()) / 86400000)
    : null;

  // Unified per-project activity feed, same construction as the global
  // activity page but scoped to this one project.
  const timeline = useMemo(() => {
    type Ev = { id: string; label: string; timestamp: string; icon: React.ReactNode };
    const events: Ev[] = [
      ...projectLogs.map(l => ({
        id: `log-${l.id}`,
        label: `${l.author?.name ?? "Someone"} submitted a daily log — ${l.progress}% progress`,
        timestamp: l.submittedAt,
        icon: <History size={13} className="text-blueprint" />,
      })),
      ...projectDocuments.map(d => ({
        id: `doc-${d.id}`,
        label: `Document uploaded — ${d.name}`,
        timestamp: d.uploadedAt,
        icon: <Upload size={13} className="text-blueprint" />,
      })),
      ...projectComments.map(c => ({
        id: `comment-${c.id}`,
        label: `${commentTypeLabel(c.type)} logged by ${c.author}`,
        timestamp: c.createdAt,
        icon: <MessageSquare size={13} className="text-ochre" />,
      })),
      ...projectPayments.map(p => ({
        id: `payment-${p.id}`,
        label: `Payment recorded — ${formatKsh(p.amount)}`,
        timestamp: `${p.date}T12:00:00`,
        icon: <Wallet size={13} className="text-moss" />,
      })),
      ...(project.assignmentHistory ?? []).map(r => ({
        id: `assign-${r.id}`,
        label: `Reassigned to ${r.toArchitect?.name ?? "someone"}${r.reason ? ` — ${r.reason}` : ""}`,
        timestamp: `${r.date}T09:00:00`,
        icon: <Repeat size={13} className="text-brick" />,
      })),
    ];
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);
  }, [projectLogs, projectDocuments, projectComments, projectPayments, project.assignmentHistory]);

  const [handoverTo, setHandoverTo] = useState("");
  const [handoverReason, setHandoverReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleConfirmHandover(e: React.FormEvent) {
    e.preventDefault();
    if (!handoverTo) return;
    setConfirming(true);
    try {
      await reassignProject(project.id, handoverTo, handoverReason || "Project take-over — knowledge continuity handover");
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  }

  if (!canView) {
    return (
      <AppShell>
        <Card className="p-8 text-center">
          <p className="text-ink font-medium mb-1">You don&apos;t have access to this project&apos;s handover dossier.</p>
          <p className="text-muted text-[12.5px]">Only the assigned architect, supervisor, or an admin can view it.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div>
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-muted hover:text-ink text-[12px] mb-3">
          <ArrowLeft size={14} />Back to project
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[11.5px] text-muted">{project.sheetNo} · {project.location}</div>
            <h1 className="font-display font-bold text-[21px] text-ink mt-0.5">Take over: {project.name}</h1>
            <p className="text-muted text-[12.5px] mt-1">
              Everything the next architect needs to pick this up with nothing lost — {client?.name}, {priorityLabel(project.priority)} priority.
            </p>
          </div>
          <StatusPill status={project.status} className="px-2.5 py-1" />
        </div>

        {/* At-a-glance risk banner */}
        {(!hasLogToday && (daysSinceLastLog === null || daysSinceLastLog > 0)) && (
          <div className="flex items-center gap-2.5 bg-ochre-bg text-ochre rounded-md px-4 py-2.5 mb-4 text-[12.5px]">
            <AlertTriangle size={15} className="shrink-0" />
            {latestLog
              ? `No daily log submitted today — the last one was ${daysSinceLastLog} day${daysSinceLastLog === 1 ? "" : "s"} ago.`
              : "No daily logs have ever been submitted for this project."}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
          {/* Left column — the dossier */}
          <div className="flex flex-col gap-3.5">
            {/* Ownership */}
            <Card className="p-4">
              <div className="font-medium text-ink text-[12.5px] mb-3">Current ownership</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted text-[11px]">Architect</div>
                  <div className="text-ink text-[13px] font-medium mt-0.5">{currentArchitect?.name ?? <span className="text-brick">Unassigned</span>}</div>
                </div>
                <div>
                  <div className="text-muted text-[11px]">Supervisor</div>
                  <div className="text-ink text-[13px] font-medium mt-0.5">{supervisor?.name ?? "—"}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line">
                <div className="text-muted text-[11px] mb-1">Progress</div>
                <div className="w-full h-2 bg-vellum rounded-full overflow-hidden">
                  <div className="h-full bg-blueprint rounded-full" style={{ width: `${project.progress}%` }} />
                </div>
                <div className="text-[11px] text-muted mt-1">{project.progress}% complete · due {new Date(project.dueDate).toLocaleDateString("en-KE", { dateStyle: "medium" })}</div>
              </div>
            </Card>

            {/* Where things stand right now */}
            <Card className="p-4">
              <div className="font-medium text-ink text-[12.5px] mb-3">Where things stand</div>
              {latestLog ? (
                <div className="flex flex-col gap-3 text-[12.5px]">
                  <div>
                    <div className="text-muted text-[11px] mb-1">Last submitted by {latestLog.author?.name} — {new Date(latestLog.date).toLocaleDateString("en-KE", { dateStyle: "medium" })}</div>
                    <div className="text-ink leading-relaxed">{latestLog.workCompleted}</div>
                  </div>
                  {latestLog.pendingWork && (
                    <div>
                      <div className="text-muted text-[11px] mb-1">Pending work</div>
                      <div className="text-ink leading-relaxed">{latestLog.pendingWork}</div>
                    </div>
                  )}
                  {latestLog.nextActions && (
                    <div>
                      <div className="text-muted text-[11px] mb-1">Next actions</div>
                      <div className="text-ink leading-relaxed">{latestLog.nextActions}</div>
                    </div>
                  )}
                  {latestLog.challenges && (
                    <div>
                      <div className="text-muted text-[11px] mb-1">Open challenges</div>
                      <div className="text-brick leading-relaxed">{latestLog.challenges}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted text-[12.5px]">No daily logs recorded yet for this project.</p>
              )}
            </Card>

            {/* Recent daily logs */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-ink text-[12.5px]">Daily log history</div>
                <span className="text-muted text-[11px]">{projectLogs.length} total</span>
              </div>
              {projectLogs.length === 0 ? (
                <p className="text-muted text-[12.5px]">No logs yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
                  {projectLogs.slice(0, 8).map(log => (
                    <div key={log.id} className="border-t border-line pt-2.5 first:border-0 first:pt-0">
                      <div className="flex items-center gap-2 text-[11px] text-muted mb-0.5">
                        <span className="font-medium text-ink">{log.author?.name}</span>
                        <span>· {new Date(log.date).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
                        <span className="ml-auto font-mono">{log.progress}%</span>
                      </div>
                      <p className="text-[12px] text-ink leading-snug line-clamp-2">{log.workCompleted}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Documents */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-ink text-[12.5px]">Latest drawings & documents</div>
                <span className="text-muted text-[11px]">{projectDocuments.length} total</span>
              </div>
              {projectDocuments.length === 0 ? (
                <p className="text-muted text-[12.5px]">No documents uploaded yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {projectDocuments.slice(0, 6).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-line first:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-muted shrink-0" />
                        <div className="min-w-0">
                          <div className="text-ink text-[12px] font-medium truncate">{doc.name}</div>
                          <div className="text-muted text-[10.5px] font-mono">v{doc.version} · {formatFileSize(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString("en-KE")}</div>
                        </div>
                      </div>
                      <a href={doc.fileUrl} download={doc.name} className="text-blueprint shrink-0" title="Download">
                        <Download size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Client communications */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-ink text-[12.5px]">Client communications</div>
                <span className="text-muted text-[11px]">{outstandingComments.length} unresolved</span>
              </div>
              {projectComments.length === 0 ? (
                <p className="text-muted text-[12.5px]">No client communications recorded.</p>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto">
                  {projectComments.slice(0, 8).map(c => (
                    <div key={c.id} className={`border-t border-line pt-2.5 first:border-0 first:pt-0 ${c.resolvedAt ? "opacity-60" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-ink text-[12px] font-medium">{c.author}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-[3px] font-medium ${c.type === "CHANGE_REQUEST" ? "bg-brick-bg text-brick" : c.type === "APPROVAL" ? "bg-moss-bg text-moss" : c.type === "QUERY" ? "bg-blueprint-bg text-blueprint" : "bg-ochre-bg text-ochre"}`}>
                          {commentTypeLabel(c.type)}
                        </span>
                        {!c.resolvedAt && <span className="text-[10px] text-brick ml-auto">Unresolved</span>}
                      </div>
                      <p className="text-[12px] text-ink leading-snug line-clamp-2">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right column — financials, approvals, timeline, action */}
          <div className="flex flex-col gap-3.5">
            {/* Financial status */}
            <Card className="p-4">
              <div className="font-medium text-ink text-[12.5px] mb-3">Financial status</div>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <div className="flex justify-between"><span className="text-muted">Contract value</span><span className="font-mono text-ink">{formatKsh(project.budget)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Invoiced</span><span className="font-mono text-ink">{formatKsh(project.invoiced)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Paid</span><span className="font-mono text-moss">{formatKsh(project.paid)}</span></div>
                <div className="flex justify-between pt-2 border-t border-line"><span className="text-ink font-medium">Outstanding</span><span className="font-mono text-brick font-medium">{formatKsh(outstandingBalance)}</span></div>
              </div>
              {projectPayments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line text-[11px] text-muted">
                  Last payment {formatKsh(projectPayments[0].amount)} on {new Date(projectPayments[0].date).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                </div>
              )}
            </Card>

            {/* Pending approvals */}
            <Card className="p-4">
              <div className="font-medium text-ink text-[12.5px] mb-3">Pending approvals</div>
              {pendingApprovals.length === 0 ? (
                <p className="text-muted text-[12px] flex items-center gap-1.5"><CheckCircle size={13} className="text-moss" />Nothing awaiting approval.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {pendingApprovals.map(c => (
                    <div key={c.id} className="text-[12px] text-ink bg-moss-bg/40 rounded-md p-2">
                      {c.content}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Activity timeline (project-scoped) */}
            <Card className="p-4">
              <div className="font-medium text-ink text-[12.5px] mb-3">Recent activity</div>
              {timeline.length === 0 ? (
                <p className="text-muted text-[12px]">No activity recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto">
                  {timeline.map(ev => (
                    <div key={ev.id} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">{ev.icon}</span>
                      <div>
                        <p className="text-[11.5px] text-ink leading-snug">{ev.label}</p>
                        <p className="text-[10px] text-muted font-mono flex items-center gap-1 mt-0.5"><Clock size={10} />{new Date(ev.timestamp).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Confirm handover */}
            {canConfirmHandover && (
              <Card className="p-4">
                <div className="font-medium text-ink text-[12.5px] mb-1">Confirm handover</div>
                <p className="text-muted text-[11.5px] mb-3">The new architect gets instant access to everything above — nothing is re-entered or lost.</p>
                {confirmed ? (
                  <div className="flex items-center gap-2 text-moss text-[12.5px] bg-moss-bg rounded-md p-3">
                    <CheckCircle size={16} />
                    Handover complete. The project is now assigned and the new architect has been notified.
                  </div>
                ) : (
                  <form onSubmit={handleConfirmHandover} className="flex flex-col gap-3">
                    <Field label="Hand over to" required>
                      <Select value={handoverTo} onChange={e => setHandoverTo(e.target.value)} required>
                        <option value="">Select architect</option>
                        {otherArchitects.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Handover notes">
                      <Textarea rows={2} value={handoverReason} onChange={e => setHandoverReason(e.target.value)} placeholder="Anything the incoming architect should know that isn't already captured above…" />
                    </Field>
                    <button
                      type="submit"
                      disabled={!handoverTo || confirming}
                      className="flex items-center justify-center gap-1.5 bg-brick text-white rounded-md px-3 py-2 text-[12.5px] font-medium hover:bg-brick/90 disabled:opacity-50"
                    >
                      <Repeat size={14} />{confirming ? "Confirming…" : "Confirm take over"}
                    </button>
                  </form>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
