import { cn } from "@/lib/utils";
import { ProjectStatus, statusLabel } from "@/store/app-store";

const styles: Record<ProjectStatus, string> = {
  ON_TRACK: "bg-moss-bg text-moss",
  AT_RISK: "bg-ochre-bg text-ochre",
  DELAYED: "bg-brick-bg text-brick",
  COMPLETED: "bg-blueprint-bg text-blueprint",
};

export function StatusPill({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-[3px] px-2 py-0.5 text-[10px] font-medium tracking-wide", styles[status], className)}>
      {statusLabel(status).toUpperCase()}
    </span>
  );
}
