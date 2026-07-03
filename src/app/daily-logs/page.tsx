"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Spinner, EmptyState, Avatar } from "@/components/ui/form";
import { projects as projectsApi, dailyLogs as logsApi, Project, DailyLog } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface ProjectLog {
  project: Project;
  logs: DailyLog[];
  expanded: boolean;
}

export default function DailyLogsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [data, setData] = useState<ProjectLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterProject, setFilterProject] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: projs } = await projectsApi.list({ status: "ACTIVE", pageSize: 50 });
      const results = await Promise.all(
        projs.map(async (p) => {
          const logResult = await logsApi.list(p.id, {
            fromDate: filterDate || undefined,
            toDate: filterDate || undefined,
          }).catch(() => ({ data: [] }));
          return { project: p, logs: logResult.data, expanded: true };
        }),
      );
      setData(results.filter((r) => r.logs.length > 0 || filterDate === ""));
    } finally {
      setLoading(false);
    }
  }, [user, filterDate]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setData((prev) =>
      prev.map((d) => (d.project.id === id ? { ...d, expanded: !d.expanded } : d)),
    );
  }

  if (authLoading) return <AppShell><Spinner /></AppShell>;

  const allProjects = data.map((d) => d.project);
  const totalLogs = data.reduce((s, d) => s + d.logs.length, 0);
  const visible = filterProject === "all"
    ? data
    : data.filter((d) => d.project.id === filterProject);

  return (
    <AppShell>
      <Topbar
        title="Daily logs"
        subtitle={`${totalLogs} log entries across ${data.length} active projects`}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-muted">Date:</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-line rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blueprint/40"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-[11.5px] text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-muted">Project:</label>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="border border-line rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blueprint/40"
          >
            <option value="all">All projects</option>
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <Card>
          <EmptyState
            title={filterDate ? "No logs for this date" : "No daily logs yet"}
            body={filterDate ? "No architect has submitted a log for the selected date." : "Architects submit daily logs from their assigned project pages."}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ project, logs, expanded }) => (
            <Card key={project.id}>
              {/* Project header */}
              <button
                onClick={() => toggleExpand(project.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-vellum transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium text-ink text-[13px]">{project.name}</div>
                    <div className="text-[11px] text-muted font-mono">
                      {project.projectNumber} · {logs.length} log{logs.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-blueprint hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Open project
                  </Link>
                  {expanded ? (
                    <ChevronUp size={15} className="text-muted" />
                  ) : (
                    <ChevronDown size={15} className="text-muted" />
                  )}
                </div>
              </button>

              {/* Logs */}
              {expanded && (
                <div className="border-t border-line divide-y divide-line">
                  {logs.map((log) => (
                    <div key={log.id} className="px-4 py-4">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={`${log.author.firstName} ${log.author.lastName}`}
                            size="sm"
                          />
                          <span className="text-ink font-medium text-[12.5px]">
                            {log.author.firstName} {log.author.lastName}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-muted">
                          {new Date(log.logDate).toLocaleDateString("en-KE", {
                            weekday: "long",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {" · "}
                          <span className="text-blueprint">{log.progressPercentage}% complete</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                        <LogField label="Work completed" value={log.workCompleted} />
                        {log.challenges && (
                          <LogField label="Challenges" value={log.challenges} />
                        )}
                        {log.pendingWork && (
                          <LogField label="Pending work" value={log.pendingWork} />
                        )}
                        {log.nextActions && (
                          <LogField label="Next actions" value={log.nextActions} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function LogField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted text-[11px] mb-0.5">{label}</div>
      <p className="text-ink leading-relaxed">{value}</p>
    </div>
  );
}
