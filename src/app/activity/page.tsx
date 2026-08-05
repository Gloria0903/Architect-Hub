"use client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useStore } from "@/store/app-store";
import { Upload, Wallet, Repeat, ClipboardList, MessageCircle, Users, Folder } from "lucide-react";

type EventType = "upload" | "payment" | "takeover" | "log" | "comment" | "assignment" | "project";

const iconMap: Record<EventType, React.ReactNode> = {
  upload: <Upload size={13} className="text-blueprint" />,
  payment: <Wallet size={13} className="text-moss" />,
  takeover: <Repeat size={13} className="text-brick" />,
  log: <ClipboardList size={13} className="text-blueprint" />,
  comment: <MessageCircle size={13} className="text-ochre" />,
  assignment: <Users size={13} className="text-blueprint" />,
  project: <Folder size={13} className="text-moss" />,
};

const bgMap: Record<EventType, string> = {
  upload: "bg-blueprint-bg",
  payment: "bg-moss-bg",
  takeover: "bg-brick-bg",
  log: "bg-blueprint-bg",
  comment: "bg-ochre-bg",
  assignment: "bg-blueprint-bg",
  project: "bg-moss-bg",
};

export default function ActivityPage() {
  const { logs, payments, projects, staff, comments } = useStore();

  // Build a unified timeline from all data
  const events: { id: string; type: EventType; actor: string; description: string; timestamp: string; projectName?: string }[] = [
    ...logs.map(l => {
      const author = staff.find(s => s.id === l.authorId);
      const project = projects.find(p => p.id === l.projectId);
      return { id: l.id, type: "log" as EventType, actor: author?.name ?? "Unknown", description: `Submitted daily log — ${l.progress}% progress`, timestamp: l.submittedAt, projectName: project?.name };
    }),
    ...payments.map(p => {
      const project = projects.find(pr => pr.id === p.projectId);
      return { id: p.id, type: "payment" as EventType, actor: p.recordedBy, description: `Payment recorded — KSh ${p.amount.toLocaleString()}`, timestamp: p.date + "T12:00:00", projectName: project?.name };
    }),
    ...comments.map(c => {
      const project = projects.find(p => p.id === c.projectId);
      return { id: c.id, type: "comment" as EventType, actor: c.author, description: `${c.type.replace("_"," ")} logged`, timestamp: c.createdAt, projectName: project?.name };
    }),
    ...projects.filter(p => p.assignmentHistory.length > 0).flatMap(p =>
      p.assignmentHistory.map(r => {
        const to = staff.find(s => s.id === r.toArchitectId);
        return { id: r.id, type: "takeover" as EventType, actor: r.performedBy, description: `Project reassigned to ${to?.name ?? "unknown"}`, timestamp: r.date + "T09:00:00", projectName: p.name };
      })
    ),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Group by date
  const grouped: Record<string, typeof events> = {};
  events.forEach(e => {
    const date = e.timestamp.split("T")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  return (
    <AppShell>
      <div>
        <h1 className="font-display font-bold text-[20px] text-ink mb-0.5">Activity timeline</h1>
        <p className="text-muted text-[12px] mb-5">{events.length} events across all projects</p>

        <div className="flex flex-col gap-5">
          {Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-[11px] font-mono text-muted whitespace-nowrap">
                  {new Date(date).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
                <div className="flex-1 h-px bg-line" />
                <div className="text-[10px] text-muted">{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</div>
              </div>
              <Card className="divide-y divide-line overflow-hidden">
                {dayEvents.map(event => (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-vellum/40 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${bgMap[event.type]}`}>
                      {iconMap[event.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-ink font-medium text-[12.5px]">{event.actor}</span>
                        <span className="text-muted text-[12px]">{event.description}</span>
                      </div>
                      {event.projectName && (
                        <div className="text-muted text-[11px] mt-0.5">{event.projectName}</div>
                      )}
                    </div>
                    <div className="text-[11px] text-muted font-mono shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
