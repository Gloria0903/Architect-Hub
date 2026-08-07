"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, User, Bell } from "lucide-react";
import { useStore, roleLabel, Role } from "@/store/app-store";

export function ProfileMenu() {
  const { data: session } = useSession();
  const { notifications, markNotificationRead } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!session?.user) return null;
  const initials = session.user.initials || session.user.name?.slice(0, 2).toUpperCase() || "?";

  return (
    <div className="flex items-center gap-3">
      {/* Notifications bell */}
      <div className="relative" ref={notifRef}>
        <button onClick={() => setNotifOpen(o => !o)} className="relative">
          <Bell size={18} className="text-muted" strokeWidth={1.8} />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brick rounded-full text-white text-[9px] flex items-center justify-center font-bold">
              {unread.length}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-surface border border-line rounded-card shadow-xl z-50 max-h-80 overflow-y-auto">
            <div className="px-3.5 py-2.5 border-b border-line text-[12px] font-medium text-ink">Notifications</div>
            {notifications.length === 0 && <div className="px-3.5 py-4 text-[12px] text-muted text-center">No notifications yet.</div>}
            {notifications.slice(0, 10).map(n => (
              <div
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`px-3.5 py-2.5 text-[11.5px] border-b border-line last:border-0 cursor-pointer hover:bg-vellum/50 ${n.read ? "text-muted" : "text-ink"}`}
              >
                {n.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile avatar + dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-[30px] h-[30px] rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center font-semibold text-[12px] hover:ring-2 hover:ring-blueprint/30 transition-all"
        >
          {initials}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-surface border border-line rounded-card shadow-xl z-50 overflow-hidden">
            <div className="px-3.5 py-3 border-b border-line">
              <div className="text-ink font-medium text-[13px]">{session.user.name}</div>
              <div className="text-muted text-[11.5px] truncate">{session.user.email}</div>
              <span className="inline-block mt-1.5 text-[10px] bg-blueprint-bg text-blueprint px-1.5 py-0.5 rounded-[3px] font-medium">
                {roleLabel(session.user.role as Role)}
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); router.push("/settings"); }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] text-ink hover:bg-vellum/60 transition-colors text-left"
            >
              <User size={14} className="text-muted" />View profile
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] text-brick hover:bg-brick-bg transition-colors text-left border-t border-line"
            >
              <LogOut size={14} />Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
