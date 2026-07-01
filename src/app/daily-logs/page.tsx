import Link from "next/link";
import { Card } from "@/components/ui/card";
import { dailyLogs, projects } from "@/data/mock";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export default function DailyLogsPage() {
  return (
    <AppShell>
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-[19px] text-ink">Daily logs</h1>
          <p className="text-muted text-[12px] mt-0.5">Every architect submits a report before close of business.</p>
        </div>
        <Link
          href="/daily-logs/new"
          className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium"
        >
          <Plus size={15} />
          Submit log
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {dailyLogs.map((log) => {
          const project = projects.find((p) => p.id === log.projectId);
          return (
            <Card key={log.id} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="text-ink font-medium text-[12.5px]">{log.author}</span>
                  <span className="text-muted text-[12px]"> · {project?.name}</span>
                </div>
                <div className="font-mono text-[11px] text-muted">{log.date}</div>
              </div>
              <p className="text-[12px] text-ink leading-relaxed">{log.workCompleted}</p>
            </Card>
          );
        })}
      </div>
    </div>
  </AppShell>
  );
}
