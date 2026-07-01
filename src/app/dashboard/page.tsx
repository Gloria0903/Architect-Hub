import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { projects, activity, currentUser } from "@/data/mock";
import { Upload, Wallet, Repeat } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const weeklyLogs = [60, 78, 95, 70, 100, 0, 0];
const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

function healthCounts() {
  const onTrack = projects.filter((p) => p.status === "on_track").length;
  const atRisk = projects.filter((p) => p.status === "at_risk").length;
  const delayed = projects.filter((p) => p.status === "delayed").length;
  const total = projects.length;
  return {
    onTrack: Math.round((onTrack / total) * 100),
    atRisk: Math.round((atRisk / total) * 100),
    delayed: Math.round((delayed / total) * 100),
  };
}

export default function DashboardPage() {
  const health = healthCounts();
  const onTrackDash = (health.onTrack / 100) * 97.4;
  const atRiskDash = (health.atRisk / 100) * 97.4;
  const delayedDash = (health.delayed / 100) * 97.4;

  return (
    <AppShell>
    <div>
      <Topbar
        title={`Good morning, ${currentUser.name.split(" ")[0]}`}
        subtitle={`Tuesday, 30 June 2026 — ${projects.length} active projects across 2 architects`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Active projects</div>
          <div className="font-display font-bold text-[26px] text-ink mt-0.5">{projects.length}</div>
          <div className="text-moss text-[11px] mt-1">↑ 2 this month</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Outstanding balance</div>
          <div className="font-mono font-medium text-[19px] text-ink mt-1">KSh 4.2M</div>
          <div className="text-brick text-[11px] mt-1.5">3 overdue invoices</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Missing logs today</div>
          <div className="font-display font-bold text-[26px] text-brick mt-0.5">1</div>
          <div className="text-muted text-[11px] mt-1">Reminder sends at 5:00pm</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Avg. completion</div>
          <div className="font-display font-bold text-[26px] text-ink mt-0.5">
            {Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)}%
          </div>
          <div className="text-ochre text-[11px] mt-1">1 project at risk</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.3fr] gap-3 mb-3.5">
        <Card className="p-3.5">
          <div className="font-medium text-ink text-[12.5px] mb-2">Project health</div>
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
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-sm bg-moss inline-block" />On track {health.onTrack}%</div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-sm bg-ochre inline-block" />At risk {health.atRisk}%</div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-sm bg-brick inline-block" />Delayed {health.delayed}%</div>
            </div>
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="font-medium text-ink text-[12.5px] mb-2">Daily logs submitted</div>
          <svg width="100%" height="70" viewBox="0 0 160 70" aria-hidden="true">
            {weeklyLogs.map((v, i) => (
              <rect
                key={i}
                x={6 + i * 22}
                y={64 - v * 0.5}
                width="14"
                height={v * 0.5}
                fill={v >= 90 ? "#2451C4" : v === 0 ? "#E6E9EA" : "#B5D4F4"}
                rx="2"
              />
            ))}
          </svg>
          <div className="flex justify-between text-[9.5px] text-muted font-mono px-1">
            {dayLabels.map((d, i) => <span key={i}>{d}</span>)}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-ink text-[12.5px]">Revenue, last 6 months</div>
            <div className="text-moss text-[11px]">+12.4%</div>
          </div>
          <svg width="100%" height="64" viewBox="0 0 220 64" aria-hidden="true">
            <polyline points="4,46 38,38 72,42 106,24 140,28 174,10 216,16" fill="none" stroke="#2451C4" strokeWidth="2" />
            <polyline points="4,46 38,38 72,42 106,24 140,28 174,10 216,16 216,64 4,64" fill="#E7EDFA" stroke="none" />
          </svg>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
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
                <th className="font-medium pb-2">Architect</th>
                <th className="font-medium pb-2">Progress</th>
                <th className="font-medium pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2 font-mono text-muted">
                    <Link href={`/projects/${p.id}`}>{p.sheetNo}</Link>
                  </td>
                  <td className="py-2 text-ink font-medium">
                    <Link href={`/projects/${p.id}`}>{p.name}</Link>
                  </td>
                  <td className="py-2 text-muted">{p.architect}</td>
                  <td className="py-2 font-mono">{p.progress}%</td>
                  <td className="py-2"><StatusPill status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-3.5">
          <div className="font-medium text-ink text-[12.5px] mb-2.5">Recent activity</div>
          <div className="flex flex-col gap-2.5 text-[11.5px]">
            {activity.slice(0, 5).map((a) => (
              <div key={a.id} className="flex gap-2">
                {a.type === "upload" && <Upload size={14} className="text-blueprint mt-0.5 shrink-0" />}
                {a.type === "payment" && <Wallet size={14} className="text-moss mt-0.5 shrink-0" />}
                {a.type === "takeover" && <Repeat size={14} className="text-brick mt-0.5 shrink-0" />}
                {(a.type === "log" || a.type === "comment" || a.type === "assignment") && (
                  <Upload size={14} className="text-muted mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="text-ink">{a.actor}</span>{" "}
                  <span className="text-muted">{a.description.charAt(0).toLowerCase() + a.description.slice(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </AppShell>
  );
}
