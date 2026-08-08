import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="font-display font-bold text-[19px] text-ink">{title}</h1>
        {subtitle && <p className="text-muted text-[12px] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 bg-surface border border-line rounded-md px-3 py-1.5 text-[12px] text-muted w-56">
          <Search size={14} /><span>Search projects, clients…</span>
        </div>
        <NotificationBell />
        <div className="w-[30px] h-[30px] rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center font-semibold text-[12px]">LM</div>
      </div>
    </div>
  );
}
