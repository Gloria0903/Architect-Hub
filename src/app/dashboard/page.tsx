"use client";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { useStore, formatKsh, commentTypeLabel } from "@/store/app-store";
import { useSession } from "next-auth/react";
import { Upload, Wallet, Repeat, ClipboardList, AlertTriangle, CheckCircle, Bell } from "lucide-react";

export default function DashboardPage() {
  const { projects, staff, logs, comments, payments, notifications, markNotificationRead } = useStore();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const dayKey = (iso: string) => new Date(iso).toISOString().split("T")[0];

  const today = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter(l => dayKey(l.date) === today);
  const unread = notifications.filter(n => !n.read);
  const delayed = projects.filter(p => p.status === "DELAYED");
  const atRisk = projects.filter(p => p.status === "AT_RISK");
  const onTrack = projects.filter(p => p.status === "ON_TRACK");
  const unresolved = comments.filter(c => !c.resolvedAt);

  // Finance figures are computed either way (harmless — `payments` and
  // `projects` are already API-scoped to an architect's own projects if
  // they're not admin), but are only ever RENDERED behind `isAdmin` below.
  // Company-wide revenue/finance isn't something an architect should see,
  // full stop — not even a correctly-scoped slice of it.
  const totalOutstanding = projects.reduce((s, p) => s + (p.invoiced - p.paid), 0);
  const totalRevenue = projects.reduce((s, p) => s + p.paid, 0);

  // Same reasoning as the finance figures: only meaningful/shown to admins.
  // Computing "who hasn't submitted" requires comparing against total
  // non-admin headcount, which is exactly the kind of company-wide,
  // cross-colleague inference an architect shouldn't be able to derive.
  const missingSubmissions = isAdmin
    ? staff.filter(s => s.role !== "ADMIN").length - todayLogs.length
    : 0;

  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - mondayOffset);
  const weekDayKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d.toISOString().split("T")[0];
  });
  const weeklyLogs = weekDayKeys.map(key => logs.filter(l => dayKey(l.date) === key).length);
  const maxWeeklyLogs = Math.max(...weeklyLogs, 1);
  const todayIndex = mondayOffset;

  const monthLabel = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: monthLabel(d), total: 0 };
  });
  payments.forEach(p => {
    const key = monthLabel(new Date(p.date));
    const bucket = monthBuckets.find(b => b.key === key);
    if (bucket) bucket.total += p.amount;
  });
  const maxMonthTotal = Math.max(...monthBuckets.map(b => b.total), 1);
  const trendPoints = monthBuckets.map((b, i) => ({
    x: 4 + i * (200 / (monthBuckets.length - 1)),
    y: 64 - (b.total / maxMonthTotal) * 52,
  }));
  const trendPolyline = trendPoints.map(p => `${p.x},${p.y}`).join(" ");
  const trendArea = `${trendPolyline} ${trendPoints[trendPoints.length - 1].x},68 ${trendPoints[0].x},68`;
  const lastMonthTotal = monthBuckets[monthBuckets.length - 1].total;
  const prevMonthTotal = monthBuckets[monthBuckets.length - 2]?.total ?? 0;
  const revenueChangePct = prevMonthTotal > 0
    ? Math.round(((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 1000) / 10
    : (lastMonthTotal > 0 ? 100 : 0);

  const onTrackPct = Math.round((onTrack.length / projects.length) * 97.4);
  const atRiskPct = Math.round((atRisk.length / projects.length) * 97.4);
  const delayedPct = Math.round((delayed.length / projects.length) * 97.4);

  return (
    <AppShell>
      <div>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">{isAdmin ? "Admin Dashboard" : "My Dashboard"}</h1>
            <p className="text-muted text-[12px] mt-0.5">
              {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — {projects.length} {isAdmin ? "active projects across " + staff.filter(s => s.role !== "ADMIN").length + " staff" : "projects assigned to you"}
            </p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Active projects</div>
            <div className="font-display font-bold text-[28px] text-ink mt-0.5">{projects.length}</div>
            <div className="text-moss text-[11px] mt-1">↑ {onTrack.length} on track</div>
          </Card>

          {isAdmin ? (
            <Card className="p-3.5">
              <div className="text-muted text-[11px]">Total revenue</div>
              <div className="font-mono font-medium text-[17px] text-ink mt-1">{formatKsh(totalRevenue)}</div>
              <div className="text-muted text-[11px] mt-1.5">Outstanding: {formatKsh(totalOutstanding)}</div>
            </Card>
          ) : (
            <Card className="p-3.5">
              <div className="text-muted text-[11px]">Unresolved client comments</div>
              <div className="font-display font-bold text-[28px] text-ochre mt-0.5">{unresolved.length}</div>
              <div className="text-muted text-[11px] mt-1">{delayed.length} delayed</div>
            </Card>
          )}

          <Card className="p-3.5">
            <div className="text-muted text-[11px]">{isAdmin ? "Logs today" : "Your logs today"}</div>
            <div className="font-display font-bold text-[28px] text-ink mt-0.5">{todayLogs.length}</div>
            {isAdmin ? (
              <div className="text-brick text-[11px] mt-1">{missingSubmissions} missing submissions</div>
            ) : (
              <div className="text-muted text-[11px] mt-1">Across your projects</div>
            )}
          </Card>

          {isAdmin && (
            <Card className="p-3.5">
              <div className="text-muted text-[11px]">Unresolved client comments</div>
              <div className="font-display font-bold text-[28px] text-ochre mt-0.5">{unresolved.length}</div>
              <div className="text-muted text-[11px] mt-1">{delayed.length} delayed projects</div>
            </Card>
          )}
        </div>

        {/* Charts Row */}
        <div className={`grid grid-cols-1 gap-3 mb-3.5 ${isAdmin ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          <Card className="p-3.5">
            <div className="font-medium text-ink text-[12.5px] mb-3">Project health</div>
            <div className="flex items-center gap-4">
              <svg width="90" height="90" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E6E9EA" strokeWidth="5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#2F7A5E" strokeWidth="5" strokeDasharray={`${onTrackPct} 100`} transform="rotate(-90 18 18)" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#B07F1F" strokeWidth="5" strokeDasharray={`${atRiskPct} 100`} strokeDashoffset={-onTrackPct} transform="rotate(-90 18 18)" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#B5502E" strokeWidth="5" strokeDasharray={`${delayedPct} 100`} strokeDashoffset={-(onTrackPct + atRiskPct)} transform="rotate(-90 18 18)" />
              </svg>
              <div className="flex flex-col gap-2 text-[11.5px]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-moss inline-block" /><span className="text-ink font-medium">{onTrack.length}</span> <span className="text-muted">On track</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-ochre inline-block" /><span className="text-ink font-medium">{atRisk.length}</span> <span className="text-muted">At risk</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-brick inline-block" /><span className="text-ink font-medium">{delayed.length}</span> <span className="text-muted">Delayed</span></div>
              </div>
            </div>
          </Card>
          <Card className="p-3.5">
            <div className="font-medium text-ink text-[12.5px] mb-2">{isAdmin ? "Daily logs this week" : "Your daily logs this week"}</div>
            <svg width="100%" height="70" viewBox="0 0 160 70" aria-hidden="true">
              {weeklyLogs.map((v, i) => {
                const h = v === 0 ? 2 : (v / maxWeeklyLogs) * 56;
                return (
                  <rect key={i} x={6 + i * 22} y={64 - h} width="14" height={h} fill={i === todayIndex ? "#2451C4" : v === 0 ? "#E6E9EA" : "#B5D4F4"} rx="2" />
                );
              })}
            </svg>
            <div className="flex justify-between text-[9.5px] text-muted font-mono px-1">
              {["M","T","W","T","F","S","S"].map((d,i)=><span key={i}>{d}</span>)}
            </div>
          </Card>
          {isAdmin && (
            <Card className="p-3.5">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-ink text-[12.5px]">Revenue trend</div>
                <div className={`text-[11px] ${revenueChangePct >= 0 ? "text-moss" : "text-brick"}`}>
                  {revenueChangePct >= 0 ? "+" : ""}{revenueChangePct}%
                </div>
              </div>
              <svg width="100%" height="68" viewBox="0 0 220 68" aria-hidden="true">
                <polyline points={trendPolyline} fill="none" stroke="#2451C4" strokeWidth="2" />
                <polyline points={trendArea} fill="#E7EDFA" stroke="none" />
                {trendPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#2451C4" />)}
              </svg>
            </Card>
          )}
        </div>

        {/* Projects Table + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3 mb-3.5">
          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">{isAdmin ? "All projects" : "My projects"}</div>
              <Link href="/projects" className="text-blueprint text-[11px] font-mono">Manage →</Link>
            </div>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="text-muted text-left">
                  <th className="font-medium pb-2">Sheet</th>
                  <th className="font-medium pb-2">Project</th>
                  <th className="font-medium pb-2">Architect</th>
                  <th className="font-medium pb-2 text-right">Progress</th>
                  <th className="font-medium pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const arch = staff.find(s => s.id === p.architectId);
                  return (
                    <tr key={p.id} className="border-t border-line hover:bg-vellum/50">
                      <td className="py-2 font-mono text-muted text-[11px]">{p.sheetNo}</td>
                      <td className="py-2 text-ink font-medium"><Link href={`/projects/${p.id}`} className="hover:text-blueprint">{p.name}</Link></td>
                      <td className="py-2 text-muted">{arch ? arch.name : <span className="text-brick">Unassigned</span>}</td>
                      <td className="py-2 font-mono text-right">{p.progress}%</td>
                      <td className="py-2"><StatusPill status={p.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">Notifications</div>
              {unread.length > 0 && <span className="text-[11px] text-muted">{unread.length} unread</span>}
            </div>
            <div className="flex flex-col gap-2">
              {notifications.slice(0, 6).map(n => (
                <div key={n.id} className={`flex gap-2.5 p-2.5 rounded-md cursor-pointer transition-colors ${n.read ? "bg-transparent" : "bg-vellum"}`} onClick={() => markNotificationRead(n.id)}>
                  {n.type === "ERROR" && <AlertTriangle size={14} className="text-brick mt-0.5 shrink-0" />}
                  {n.type === "WARNING" && <AlertTriangle size={14} className="text-ochre mt-0.5 shrink-0" />}
                  {n.type === "SUCCESS" && <CheckCircle size={14} className="text-moss mt-0.5 shrink-0" />}
                  {n.type === "INFO" && <Bell size={14} className="text-blueprint mt-0.5 shrink-0" />}
                  <div>
                    <p className={`text-[11.5px] leading-snug ${n.read ? "text-muted" : "text-ink"}`}>{n.message}</p>
                    {!n.read && <span className="text-[10px] text-blueprint">Click to mark read</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Today's Logs + Client Comments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">Today&apos;s submitted logs</div>
              <Link href="/daily-logs" className="text-blueprint text-[11px] font-mono">View all→</Link>
            </div>
            {todayLogs.length === 0
              ? <p className="text-muted text-[12px]">No logs submitted yet today.</p>
              : todayLogs.map(log => {
                const author = staff.find(s => s.id === log.authorId);
                const project = projects.find(p => p.id === log.projectId);
                return (
                  <div key={log.id} className="border-t border-line pt-2.5 mt-2.5 first:border-0 first:mt-0 first:pt-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-blueprint-bg text-blueprint text-[9px] font-semibold flex items-center justify-center">{author?.initials}</div>
                      <span className="text-ink text-[12px] font-medium">{author?.name}</span>
                      <span className="text-muted text-[11px]">— {project?.name}</span>
                    </div>
                    <p className="text-[11.5px] text-muted leading-snug line-clamp-2">{log.workCompleted}</p>
                  </div>
                );
              })
            }
          </Card>

          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">Recent client comments</div>
              <Link href="/client-comms" className="text-blueprint text-[11px] font-mono">View all →</Link>
            </div>
            {comments.slice(0, 3).map(c => {
              const project = projects.find(p => p.id === c.projectId);
              return (
                <div key={c.id} className="border-t border-line pt-2.5 mt-2.5 first:border-0 first:mt-0 first:pt-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-ink text-[12px] font-medium">{c.author}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.type === "CHANGE_REQUEST" ? "bg-brick-bg text-brick" : c.type === "APPROVAL" ? "bg-moss-bg text-moss" : "bg-blueprint-bg text-blueprint"}`}>
                      {commentTypeLabel(c.type)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">{project?.name}</p>
                  <p className="text-[11.5px] text-ink mt-0.5 leading-snug line-clamp-2">{c.content}</p>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
