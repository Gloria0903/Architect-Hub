"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { LayoutGrid, Folder, ClipboardList, Files, Wallet, MessageCircle, History, Users, Settings, Repeat, Building2, X, FileBarChart } from "lucide-react";
import { cn, dayKey } from "@/lib/utils";
import { useStore } from "@/store/app-store";
import { useFirmName } from "@/lib/use-firm-name";

const overview = [{ href: "/dashboard", label: "Dashboard", icon: LayoutGrid }];
const operations = [
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/daily-logs", label: "Daily logs", icon: ClipboardList },
  { href: "/documents", label: "Documents", icon: Files },
];
const business = [
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/client-comms", label: "Client comms", icon: MessageCircle },
  { href: "/activity", label: "Activity timeline", icon: History },
];
const team = [
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: typeof LayoutGrid; badge?: number }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={cn("flex items-center justify-between rounded-md px-2.5 py-2 text-[13px] transition-colors", active ? "bg-blueprint/35 text-white font-medium" : "text-[#9AA7B2] hover:text-white hover:bg-white/5")}>
      <span className="flex items-center gap-2.5"><Icon size={16} strokeWidth={1.8} />{label}</span>
      {badge ? <span className="bg-brick text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{badge}</span> : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-3.5 pb-1 text-[10px] tracking-wider text-[#5B6670]">{children}</div>;
}

export function Sidebar({
  open = false,
  onClose,
}: {
  /** Whether the mobile off-canvas drawer is open. Ignored at the lg breakpoint and up -- the sidebar is always visible there. */
  open?: boolean;
  onClose?: () => void;
}) {
  const { notifications, comments, logs } = useStore();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const firmName = useFirmName();
  const pathname = usePathname();
  const unreadNotifs = notifications.filter(n => !n.read).length;
  const unresolvedComments = comments.filter(c => !c.resolvedAt).length;
  const today = dayKey(new Date());
  const todayLogs = logs.filter(l => dayKey(l.date) === today).length;

  // Close the mobile drawer automatically whenever the route changes --
  // otherwise tapping a nav link on a phone leaves the drawer open over
  // the page it just navigated to.
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile-only backdrop: tapping it closes the drawer. Never renders
          at lg and up, even if `open` is somehow true, since the sidebar
          is static there and has nothing to close. */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "bg-ink-sidebar w-[200px] shrink-0 p-3.5 flex flex-col gap-0.5 min-h-screen h-screen overflow-y-auto",
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out",
          "lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-4 px-1.5">
          <div className="flex items-center gap-2 text-white font-display font-bold text-[15px]">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 16 L9 2 L16 16 Z" fill="none" stroke="#2451C4" strokeWidth="1.4" />
              <line x1="2" y1="16" x2="16" y2="16" stroke="#2451C4" strokeWidth="1.4" />
            </svg>
            {firmName}
          </div>

          {/* Close button, mobile only -- desktop has no drawer to close. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden text-[#9AA7B2] hover:text-white p-1 -mr-1"
          >
            <X size={18} />
          </button>
        </div>
      <SectionLabel>OVERVIEW</SectionLabel>
      {overview.map(i => <NavItem key={i.href} {...i} badge={i.href === "/dashboard" ? unreadNotifs : undefined} />)}
      <SectionLabel>OPERATIONS</SectionLabel>
      {operations.map(i => <NavItem key={i.href} {...i} badge={i.href === "/daily-logs" ? todayLogs : undefined} />)}
      <SectionLabel>BUSINESS</SectionLabel>

{isAdmin && (
  <NavItem
    href="/finance"
    label="Finance"
    icon={Wallet}
  />
)}

<NavItem
  href="/client-comms"
  label="Client comms"
  icon={MessageCircle}
  badge={unresolvedComments}
/>

<NavItem
  href="/activity"
  label="Activity timeline"
  icon={History}
/>

<NavItem
  href="/reports"
  label="Reports"
  icon={FileBarChart}
/>
      <SectionLabel>TEAM</SectionLabel>
      {team.filter(i => isAdmin || i.href !== "/staff").map(i => <NavItem key={i.href} {...i} />)}
      <Link href="/projects" className="mt-auto bg-brick/[0.18] rounded-md p-2.5 hover:bg-brick/[0.28] transition-colors">
        <div className="flex items-center gap-1.5 text-[#E8B7A2] text-[11px] font-semibold">
          <Repeat size={14} strokeWidth={1.8} />Take over project
        </div>
        <div className="text-[#8B96A0] text-[10.5px] mt-0.5 leading-tight">Instantly access any project&apos;s full history.</div>
      </Link>
    </aside>
    </>
  );
}
