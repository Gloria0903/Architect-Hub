"use client";
import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useStore } from "@/store/app-store";
import { Plus, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export default function DailyLogsPage() {
  const { logs, projects, staff } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState("all");
  const [filterAuthor, setFilterAuthor] = useState("all");

  const today = new Date().toISOString().split("T")[0];
  const architects = staff.filter(s => s.role !== "ADMIN");
  const submittedToday = logs.filter(l => l.date === today).map(l => l.authorId);
  const missingToday = architects.filter(a => !submittedToday.includes(a.id));

  const visible = logs
    .filter(l => filterProject === "all" || l.projectId === filterProject)
    .filter(l => filterAuthor === "all" || l.authorId === filterAuthor)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Daily logs</h1>
            <p className="text-muted text-[12px] mt-0.5">{logs.length} total submissions</p>
          </div>
          <Link href="/daily-logs/new" className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
            <Plus size={15} />Submit log
          </Link>
        </div>

        {/* Missing logs alert */}
        {missingToday.length > 0 && (
          <div className="bg-brick-bg border border-brick/20 rounded-card p-3.5 mb-4 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-brick mt-0.5 shrink-0" />
            <div>
              <div className="text-brick font-medium text-[12.5px]">{missingToday.length} staff {missingToday.length === 1 ? "has" : "have"} not submitted a log today</div>
              <div className="text-[11.5px] text-brick/80 mt-0.5">{missingToday.map(m => m.name).join(", ")}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
          </select>
          <select value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
            <option value="all">All staff</option>
            {architects.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="ml-auto text-[11px] text-muted font-mono">{visible.length} logs</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {visible.length === 0 && <Card className="p-8 text-center text-muted text-[12.5px]">No logs match the selected filters.</Card>}
          {visible.map(log => {
            const author = staff.find(s => s.id === log.authorId);
            const project = projects.find(p => p.id === log.projectId);
            const expanded = expandedId === log.id;
            const isToday = log.date === today;
            return (
              <Card key={log.id} className={`overflow-hidden ${isToday ? "border-l-2 border-l-blueprint" : ""}`}>
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-vellum/40" onClick={() => setExpandedId(expanded ? null : log.id)}>
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={author?.avatarUrl} initials={author?.initials} name={author?.name} size={32} fontSize={11} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-ink font-medium text-[13px]">{author?.name}</span>
                        {isToday && <span className="text-[10px] bg-blueprint-bg text-blueprint px-1.5 py-0.5 rounded-[3px] font-medium">Today</span>}
                      </div>
                      <div className="text-muted text-[11.5px] mt-0.5">
                        <span className="font-mono">{project?.sheetNo}</span> — {project?.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <div className="font-mono text-[12px] text-blueprint">{log.progress}%</div>
                      <div className="text-[11px] text-muted">{log.date}</div>
                    </div>
                    {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-line bg-vellum/30 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-[12.5px]">
                    <div>
                      <div className="text-muted text-[11px] mb-1 uppercase tracking-wide">Work completed</div>
                      <p className="text-ink leading-relaxed">{log.workCompleted}</p>
                    </div>
                    <div>
                      <div className="text-muted text-[11px] mb-1 uppercase tracking-wide">Challenges</div>
                      <p className="text-ink leading-relaxed">{log.challenges}</p>
                    </div>
                    <div>
                      <div className="text-muted text-[11px] mb-1 uppercase tracking-wide">Pending work</div>
                      <p className="text-ink leading-relaxed">{log.pendingWork}</p>
                    </div>
                    <div>
                      <div className="text-muted text-[11px] mb-1 uppercase tracking-wide">Next actions</div>
                      <p className="text-ink leading-relaxed">{log.nextActions}</p>
                    </div>
                    <div className="md:col-span-2 border-t border-line pt-3 flex items-center justify-between text-[11px] text-muted font-mono">
                      <span>Submitted at {new Date(log.submittedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>Progress updated to {log.progress}%</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
