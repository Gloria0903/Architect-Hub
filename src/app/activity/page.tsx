"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Spinner, EmptyState } from "@/components/ui/form";
import { projects as projectsApi, timeline as timelineApi, Project, TimelineEntry } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import {
  Upload, Wallet, Repeat, FileText, MessageSquare,
  UserCheck, History,
} from "lucide-react";

const ACTION_META: Record<string, { label: string; icon: typeof Upload; color: string }> = {
  PROJECT_CREATED:              { label: "Project created",           icon: FileText,     color: "text-blueprint" },
  PROJECT_UPDATED:              { label: "Project updated",           icon: FileText,     color: "text-muted" },
  PROJECT_ARCHIVED:             { label: "Project archived",          icon: FileText,     color: "text-muted" },
  PROJECT_ARCHITECT_ASSIGNED:   { label: "Architect assigned",        icon: UserCheck,    color: "text-moss" },
  PROJECT_ARCHITECT_UNASSIGNED: { label: "Architect removed",         icon: UserCheck,    color: "text-ochre" },
  PROJECT_SUPERVISOR_REASSIGNED:{ label: "Supervisor reassigned",     icon: UserCheck,    color: "text-ochre" },
  PROJECT_TAKEOVER:             { label: "Project taken over",        icon: Repeat,       color: "text-brick" },
  DAILY_LOG_SUBMITTED:          { label: "Daily log submitted",       icon: History,      color: "text-blueprint" },
  DAILY_LOG_REVISED:            { label: "Daily log revised",         icon: History,      color: "text-muted" },
  DOCUMENT_UPLOADED:            { label: "Document uploaded",         icon: Upload,       color: "text-blueprint" },
  COMMUNICATION_RECORD_CREATED: { label: "Client comms logged",       icon: MessageSquare,color: "text-moss" },
  FINANCIAL_RECORD_UPDATED:     { label: "Financial record updated",  icon: Wallet,       color: "text-moss" },
};

function getActionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: action.replace(/_/g, " ").toLowerCase(),
      icon: FileText,
      color: "text-muted",
    }
  );
}

interface ProjectActivity {
  project: Project;
  entries: TimelineEntry[];
}

export default function ActivityPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [data, setData] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: projs } = await projectsApi.list({ pageSize: 50 });
      const results = await Promise.all(
        projs.map(async (p) => {
          const result = await timelineApi.forProject(p.id).catch(() => ({ data: [] }));
          return { project: p, entries: result.data };
        }),
      );
      setData(results.filter((r) => r.entries.length > 0));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (authLoading) return <AppShell><Spinner /></AppShell>;

  const projects = data.map((d) => d.project);
  const visible = projectFilter === "all"
    ? data
    : data.filter((d) => d.project.id === projectFilter);

  const totalEntries = data.reduce((s, d) => s + d.entries.length, 0);

  return (
    <AppShell>
      <Topbar
        title="Activity timeline"
        subtitle={`${totalEntries} events recorded across ${data.length} projects`}
      />

      <div className="flex items-center gap-3 mb-5">
        <label className="text-[12px] text-muted">Filter by project:</label>
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
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History size={28} />}
            title="No activity yet"
            body="Every action — project updates, daily logs, uploads, payments, and takeovers — appears here automatically."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map(({ project, entries }) => (
            <Card key={project.id}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <div>
                  <div className="font-medium text-ink text-[13px]">{project.name}</div>
                  <div className="font-mono text-[10.5px] text-muted">{project.projectNumber}</div>
                </div>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-[11.5px] text-blueprint hover:underline"
                >
                  Open project →
                </Link>
              </div>
              <div className="divide-y divide-line">
                {entries.slice(0, 15).map((entry) => {
                  const meta = getActionMeta(entry.action);
                  const Icon = meta.icon;
                  return (
                    <div key={entry.id} className="flex gap-3 px-4 py-3 hover:bg-vellum">
                      <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                        <Icon size={14} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px]">
                          {entry.actor && (
                            <span className="font-medium text-ink">
                              {entry.actor.firstName} {entry.actor.lastName}{" "}
                            </span>
                          )}
                          <span className="text-muted">{meta.label.toLowerCase()}</span>
                        </div>
                        <div className="font-mono text-[10.5px] text-muted mt-0.5">
                          {new Date(entry.createdAt).toLocaleString("en-KE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
