import { cn } from "@/lib/utils";
import { ProjectStatus, statusLabel } from "@/store/app-store";

const styles: Record<ProjectStatus, string> = {
  on_track: "bg-moss-bg text-moss",
  at_risk: "bg-ochre-bg text-ochre",
  delayed: "bg-brick-bg text-brick",
  completed: "bg-blueprint-bg text-blueprint",
};

export function StatusPill({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-[3px] px-2 py-0.5 text-[10px] font-medium tracking-wide", styles[status], className)}>
      {statusLabel(status).toUpperCase()}
    </span>
  );
}
