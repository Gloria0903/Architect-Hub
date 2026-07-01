"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { DimensionBar } from "@/components/ui/dimension-bar";
import { projects, dailyLogs, activity, formatKsh } from "@/data/mock";
import { Repeat, Upload, FileText, MessageSquare, Wallet, History } from "lucide-react";
import { use } from "react";
import { AppShell } from "@/components/layout/app-shell";

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
  const project = projects.find((p) => p.id === id);
  const [tab, setTab] = useState<TabKey>("overview");
  const [takeoverOpen, setTakeoverOpen] = useState(false);

  if (!project) notFound();

  const logs = dailyLogs.filter((l) => l.projectId === project.id);
  const projectActivity = activity.filter((a) => a.projectId === project.id);

  return (
    <AppShell>
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-mono text-[11.5px] text-muted">{project.sheetNo} — {project.location}</div>
          <h1 className="font-display font-bold text-[20px] text-ink mt-0.5">{project.name}</h1>
          <p className="text-muted text-[12.5px] mt-1">{project.client}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={project.status} className="px-2.5 py-1" />
          <button
            onClick={() => setTakeoverOpen(true)}
            className="flex items-center gap-1.5 bg-brick text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium"
          >
            <Repeat size={14} />
            Take over project
          </button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[12px]">
          <div>
            <div className="text-muted mb-1">Architect</div>
            <div className="text-ink font-medium">{project.architect}</div>
          </div>
          <div>
            <div className="text-muted mb-1">Supervisor</div>
            <div className="text-ink font-medium">{project.supervisor}</div>
          </div>
          <div>
            <div className="text-muted mb-1">Due date</div>
            <div className="text-ink font-medium font-mono">{project.dueDate}</div>
          </div>
          <div>
            <div className="text-muted mb-1">Budget</div>
            <div className="text-ink font-medium font-mono">{formatKsh(project.budget)}</div>
          </div>
          <div>
            <div className="text-muted mb-1">Priority</div>
            <div className="text-ink font-medium capitalize">{project.priority}</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-line">
          <div className="text-muted text-[12px] mb-2">Progress</div>
          <DimensionBar progress={project.progress} status={project.status} />
        </div>
      </Card>

      <div className="flex items-center gap-1 mb-4 border-b border-line">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] border-b-2 -mb-px ${
                tab === t.key ? "border-blueprint text-ink font-medium" : "border-transparent text-muted"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
          <Card className="p-4">
            <div className="font-medium text-ink text-[13px] mb-2">Description</div>
            <p className="text-[12.5px] text-muted leading-relaxed">{project.description}</p>
          </Card>
          <Card className="p-4">
            <div className="font-medium text-ink text-[13px] mb-2.5">Activity timeline</div>
            <div className="flex flex-col gap-2.5 text-[11.5px]">
              {projectActivity.length === 0 && <div className="text-muted">No activity recorded yet.</div>}
              {projectActivity.map((a) => (
                <div key={a.id} className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blueprint mt-1.5 shrink-0" />
                  <div>
                    <span className="text-ink">{a.actor}</span>{" "}
                    <span className="text-muted">{a.description.charAt(0).toLowerCase() + a.description.slice(1)}</span>
                    <div className="text-muted font-mono text-[10.5px] mt-0.5">
                      {new Date(a.timestamp).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "logs" && (
        <div className="flex flex-col gap-3">
          {logs.length === 0 && (
            <Card className="p-6 text-center text-muted text-[12.5px]">No daily logs submitted for this project yet.</Card>
          )}
          {logs.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-ink font-medium text-[12.5px]">{log.author}</div>
                <div className="font-mono text-[11px] text-muted">{log.date} · {log.progress}% complete</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-muted mb-1">Work completed</div>
                  <p className="text-ink leading-relaxed">{log.workCompleted}</p>
                </div>
                <div>
                  <div className="text-muted mb-1">Challenges</div>
                  <p className="text-ink leading-relaxed">{log.challenges}</p>
                </div>
                <div>
                  <div className="text-muted mb-1">Pending work</div>
                  <p className="text-ink leading-relaxed">{log.pendingWork}</p>
                </div>
                <div>
                  <div className="text-muted mb-1">Next actions</div>
                  <p className="text-ink leading-relaxed">{log.nextActions}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <Card className="p-8 text-center">
          <Upload size={22} className="mx-auto text-muted mb-2" />
          <div className="text-ink font-medium text-[13px]">Drag and drop drawings or documents</div>
          <p className="text-muted text-[12px] mt-1">Supports DWG, DXF, Revit, PDF, images, BOQs, contracts and reports.</p>
          <button className="mt-3 bg-ink text-white rounded-md px-4 py-2 text-[12px] font-medium">Browse files</button>
        </Card>
      )}

      {tab === "comms" && (
        <Card className="p-6 text-center text-muted text-[12.5px]">
          No client communications logged yet. Meeting minutes, instructions, and approvals recorded here will be fully searchable.
        </Card>
      )}

      {tab === "finance" && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
            <div>
              <div className="text-muted mb-1">Contract value</div>
              <div className="font-mono font-medium text-ink">{formatKsh(project.budget)}</div>
            </div>
            <div>
              <div className="text-muted mb-1">Invoiced</div>
              <div className="font-mono font-medium text-ink">{formatKsh(project.invoiced)}</div>
            </div>
            <div>
              <div className="text-muted mb-1">Paid</div>
              <div className="font-mono font-medium text-moss">{formatKsh(project.paid)}</div>
            </div>
            <div>
              <div className="text-muted mb-1">Outstanding</div>
              <div className="font-mono font-medium text-brick">{formatKsh(project.invoiced - project.paid)}</div>
            </div>
          </div>
        </Card>
      )}

      {takeoverOpen && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-6 z-50">
          <div className="bg-surface rounded-card max-w-md w-full p-6">
            <div className="flex items-center gap-2 text-brick font-medium text-[14px] mb-2">
              <Repeat size={16} />
              Take over {project.name}
            </div>
            <p className="text-muted text-[12.5px] leading-relaxed mb-4">
              The new architect will get instant access to every drawing, daily log, client communication,
              outstanding task, decision, and financial record for this project. Nothing is lost.
            </p>
            <label className="text-[12px] text-muted block mb-1.5">Reassign to</label>
            <select className="w-full border border-line rounded-md px-3 py-2 text-[13px] mb-4 bg-white">
              <option>Naomi Otieno</option>
              <option>Samuel Kamau</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setTakeoverOpen(false)}
                className="px-3.5 py-2 rounded-md text-[12.5px] border border-line text-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => setTakeoverOpen(false)}
                className="px-3.5 py-2 rounded-md text-[12.5px] bg-brick text-white font-medium"
              >
                Confirm takeover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </AppShell>
  );
}
