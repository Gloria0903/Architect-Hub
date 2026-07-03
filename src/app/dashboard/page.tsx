"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Spinner } from "@/components/ui/form";
import {
  dashboard,
  projects as projectsApi,
  Project,
  DashboardSummary,
  formatKsh,
  healthToStatus,
} from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { Upload, Wallet, Repeat, ClipboardList, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      dashboard.summary(),
      projectsApi.list({ pageSize: 6 }),
    ])
      .then(([s, p]) => {
        setSummary(s);
        setRecentProjects(p.data);
      })
      .catch((e) => setError(e.message));
  }, [user]);

  if (authLoading || !user) return <AppShell><Spinner /></AppShell>;

  const health = summary
    ? {
        onTrack: recentProjects.filter((p) => p.health === "ON_TRACK").length,
        atRisk: recentProjects.filter((p) => p.health === "AT_RISK").length,
        delayed: recentProjects.filter((p) => p.health === "DELAYED").length,
      }
    : { onTrack: 0, atRisk: 0, delayed: 0 };

  const total = Math.max(1, health.onTrack + health.atRisk + health.delayed);
  const onTrackPct = Math.round((health.onTrack / total) * 100);
  const atRiskPct = Math.round((health.atRisk / total) * 100);
  const delayedPct = Math.round((health.delayed / total) * 100);

  const svgCirc = 97.4;
  const onTrackDash = (onTrackPct / 100) * svgCirc;
  const atRiskDash = (atRiskPct / 100) * svgCirc;
  const delayedDash = (delayedPct / 100) * svgCirc;

  return (
    <AppShell>
      <Topbar
        title={`Good morning, ${user.firstName}`}
        subtitle={`${user.role} · ${summary?.activeProjects ?? "…"} active projects`}
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 text-brick text-[12px] bg-brick-bg border border-brick/20 rounded-md px-3 py-2.5">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Active projects</div>
          <div className="font-display font-bold text-[26px] text-ink mt-0.5">
            {summary?.activeProjects ?? "—"}
          </div>
          <div className="text-muted text-[11px] mt-1">
            {summary?.completedProjects ?? "—"} completed
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Outstanding</div>
          <div className="font-mono font-medium text-[17px] text-ink mt-1">
            {summary?.finance ? formatKsh(summary.finance.totalOutstanding) : "—"}
          </div>
          {summary?.finance?.overdueCount ? (
            <div className="text-brick text-[11px] mt-1.5">
              {summary.finance.overdueCount} overdue
            </div>
          ) : (
            <div className="text-muted text-[11px] mt-1.5">All current</div>
          )}
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Missing logs today</div>
          <div
            className={`font-display font-bold text-[26px] mt-0.5 ${
              (summary?.missingDailyLogs ?? 0) > 0 ? "text-brick" : "text-ink"
            }`}
          >
            {summary?.missingDailyLogs ?? "—"}
          </div>
          <div className="text-muted text-[11px] mt-1">Reminder at 5:00 pm</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Monthly revenue</div>
          <div className="font-mono font-medium text-[17px] text-moss mt-1">
            {summary?.finance ? formatKsh(summary.finance.monthlyRevenue) : "—"}
          </div>
          <div className="text-muted text-[11px] mt-1.5">
            {summary?.finance ? formatKsh(summary.finance.totalPaid) : "—"} total paid
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3.5">
        <Card className="p-3.5">
          <div className="font-medium text-ink text-[12.5px] mb-2">Project health</div>
          {summary ? (
            <div className="flex items-center gap-3.5">
              <svg width="86" height="86" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E6E9EA" strokeWidth="5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#2F7A5E" strokeWidth="5"
                  strokeDasharray={`${onTrackDash} 100`} transform="rotate(-90 18 18)" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#B07F1F" strokeWidth="5"
                  strokeDasharray={`${atRiskDash} 100`} strokeDashoffset={-onTrackDash} transform="rotate(-90 18 18)" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#B5502E" strokeWidth="5"
                  strokeDasharray={`${delayedDash} 100`} strokeDashoffset={-(onTrackDash + atRiskDash)} transform="rotate(-90 18 18)" />
              </svg>
              <div className="flex flex-col gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-sm bg-moss inline-block" />On track {onTrackPct}%</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-sm bg-ochre inline-block" />At risk {atRiskPct}%</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-sm bg-brick inline-block" />Delayed {delayedPct}%</div>
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-muted text-[11px]">Loading…</div>
          )}
        </Card>

        <Card className="p-3.5">
          <div className="font-medium text-ink text-[12.5px] mb-2">Upcoming deadlines</div>
          {summary?.upcomingDeadlines.length === 0 && (
            <p className="text-muted text-[12px]">Nothing due in 14 days.</p>
          )}
          <div className="flex flex-col gap-2">
            {summary?.upcomingDeadlines.slice(0, 4).map((d) => (
              <Link
                key={d.id}
                href={`/projects/${d.id}`}
                className="flex items-center justify-between text-[11.5px] hover:text-blueprint"
              >
                <span className="text-ink truncate">{d.name}</span>
                <span className="font-mono text-muted shrink-0 ml-2">
                  {new Date(d.expectedCompletionDate).toLocaleDateString("en-KE", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            ))}
            {!summary && <div className="text-muted text-[11px]">Loading…</div>}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="font-medium text-ink text-[12.5px] mb-2">Quick actions</div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/projects?new=1" className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-vellum hover:bg-blueprint-bg text-center transition-colors">
              <Upload size={16} className="text-blueprint" />
              <span className="text-[11px] text-ink">New project</span>
            </Link>
            <Link href="/staff?new=1" className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-vellum hover:bg-blueprint-bg text-center transition-colors">
              <ClipboardList size={16} className="text-blueprint" />
              <span className="text-[11px] text-ink">Add staff</span>
            </Link>
            <Link href="/finance" className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-vellum hover:bg-moss-bg text-center transition-colors">
              <Wallet size={16} className="text-moss" />
              <span className="text-[11px] text-ink">Finances</span>
            </Link>
            <Link href="/projects" className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-vellum hover:bg-brick-bg text-center transition-colors">
              <Repeat size={16} className="text-brick" />
              <span className="text-[11px] text-ink">Take over</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* Projects table */}
      <Card className="p-3.5">
        <div className="flex justify-between items-center mb-2.5">
          <div className="font-medium text-ink text-[12.5px]">Active projects</div>
          <Link href="/projects" className="text-blueprint text-[11px] font-mono">View all →</Link>
        </div>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-medium pb-2">Sheet</th>
              <th className="font-medium pb-2">Project</th>
              <th className="font-medium pb-2">Client</th>
              <th className="font-medium pb-2 hidden md:table-cell">Architect</th>
              <th className="font-medium pb-2">Progress</th>
              <th className="font-medium pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentProjects.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-2 font-mono text-muted">
                  <Link href={`/projects/${p.id}`}>{p.projectNumber}</Link>
                </td>
                <td className="py-2 text-ink font-medium">
                  <Link href={`/projects/${p.id}`}>{p.name}</Link>
                </td>
                <td className="py-2 text-muted">{p.clientName}</td>
                <td className="py-2 text-muted hidden md:table-cell">
                  {p.assignments[0]?.user
                    ? `${p.assignments[0].user.firstName} ${p.assignments[0].user.lastName}`
                    : "Unassigned"}
                </td>
                <td className="py-2 font-mono">{p.progressPercentage}%</td>
                <td className="py-2">
                  <StatusPill status={healthToStatus(p.health)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentProjects.length === 0 && !error && (
          <p className="text-center text-muted text-[12px] py-6">No projects yet.</p>
        )}
      </Card>
    </AppShell>
  );
}
