"use client";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { useStore, formatKsh } from "@/store/app-store";
import { Upload, Wallet, Repeat, ClipboardList, AlertTriangle, CheckCircle, Bell } from "lucide-react";

export default function DashboardPage() {
  const { projects, staff, logs, comments, notifications, payments, markNotificationRead } = useStore();
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter(l => l.date === today);
  const unread = notifications.filter(n => !n.read);
  const delayed = projects.filter(p => p.status === "delayed");
  const atRisk = projects.filter(p => p.status === "at_risk");
  const onTrack = projects.filter(p => p.status === "on_track");
  const totalOutstanding = projects.reduce((s, p) => s + (p.invoiced - p.paid), 0);
  const totalRevenue = projects.reduce((s, p) => s + p.paid, 0);
  const unresolved = comments.filter(c => !c.resolvedAt);
  const weeklyLogs = [5, 7, 6, 8, todayLogs.length, 0, 0];

  const onTrackPct = Math.round((onTrack.length / projects.length) * 97.4);
  const atRiskPct = Math.round((atRisk.length / projects.length) * 97.4);
  const delayedPct = Math.round((delayed.length / projects.length) * 97.4);

  return (
    <AppShell>
      <div>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Admin Dashboard</h1>
            <p className="text-muted text-[12px] mt-0.5">
              {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — {projects.length} active projects across {staff.filter(s => s.role !== "admin").length} staff
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={18} className="text-muted" />
              {unread.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-brick rounded-full text-white text-[9px] flex items-center justify-center font-bold">{unread.length}</span>}
            </div>
            <div className="w-8 h-8 rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center font-semibold text-[12px]">LM</div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Active projects</div>
            <div className="font-display font-bold text-[28px] text-ink mt-0.5">{projects.length}</div>
            <div className="text-moss text-[11px] mt-1">↑ {onTrack.length} on track</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Total revenue</div>
            <div className="font-mono font-medium text-[17px] text-ink mt-1">{formatKsh(totalRevenue)}</div>
            <div className="text-muted text-[11px] mt-1.5">Outstanding: {formatKsh(totalOutstanding)}</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Logs today</div>
            <div className="font-display font-bold text-[28px] text-ink mt-0.5">{todayLogs.length}</div>
            <div className="text-brick text-[11px] mt-1">{staff.filter(s=>s.role!=="admin").length - todayLogs.length} missing submissions</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Unresolved client comments</div>
            <div className="font-display font-bold text-[28px] text-ochre mt-0.5">{unresolved.length}</div>
            <div className="text-muted text-[11px] mt-1">{delayed.length} delayed projects</div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3.5">
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
            <div className="font-medium text-ink text-[12.5px] mb-2">Daily logs this week</div>
            <svg width="100%" height="70" viewBox="0 0 160 70" aria-hidden="true">
              {weeklyLogs.map((v, i) => (
                <rect key={i} x={6 + i * 22} y={64 - v * 8} width="14" height={v * 8} fill={i === 4 ? "#2451C4" : v === 0 ? "#E6E9EA" : "#B5D4F4"} rx="2" />
              ))}
            </svg>
            <div className="flex justify-between text-[9.5px] text-muted font-mono px-1">
              {["M","T","W","T","F","S","S"].map((d,i)=><span key={i}>{d}</span>)}
            </div>
          </Card>
          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium text-ink text-[12.5px]">Revenue trend</div>
              <div className="text-moss text-[11px]">+12.4%</div>
            </div>
            <svg width="100%" height="68" viewBox="0 0 220 68" aria-hidden="true">
              <polyline points="4,52 44,44 84,48 124,28 164,32 204,12" fill="none" stroke="#2451C4" strokeWidth="2" />
              <polyline points="4,52 44,44 84,48 124,28 164,32 204,12 204,68 4,68" fill="#E7EDFA" stroke="none" />
              {[4,44,84,124,164,204].map((x,i) => <circle key={i} cx={x} cy={[52,44,48,28,32,12][i]} r="2.5" fill="#2451C4" />)}
            </svg>
          </Card>
        </div>

        {/* Projects Table + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3 mb-3.5">
          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">All projects</div>
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
                  {n.type === "error" && <AlertTriangle size={14} className="text-brick mt-0.5 shrink-0" />}
                  {n.type === "warning" && <AlertTriangle size={14} className="text-ochre mt-0.5 shrink-0" />}
                  {n.type === "success" && <CheckCircle size={14} className="text-moss mt-0.5 shrink-0" />}
                  {n.type === "info" && <Bell size={14} className="text-blueprint mt-0.5 shrink-0" />}
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
              <Link href="/daily-logs" className="text-blueprint text-[11px] font-mono">View all →</Link>
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
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.type === "change_request" ? "bg-brick-bg text-brick" : c.type === "approval" ? "bg-moss-bg text-moss" : "bg-blueprint-bg text-blueprint"}`}>
                      {c.type.replace("_", " ")}
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
