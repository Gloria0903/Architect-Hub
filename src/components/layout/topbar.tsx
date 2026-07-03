"use client";

import { useState, useEffect } from "react";
import { Bell, Search, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth, notifications as notifApi, Notification } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const { user } = useRequireAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    notifApi.list(true).then(setNotifs).catch(() => {});
  }, []);

  async function handleLogout() {
    await auth.logout().catch(() => {});
    router.push("/login");
  }

  async function handleMarkRead(id: string) {
    await notifApi.markRead(id).catch(() => {});
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : "…";

  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="font-display font-bold text-[19px] text-ink">{title}</h1>
        {subtitle && <p className="text-muted text-[12px] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 bg-surface border border-line rounded-md px-3 py-1.5 text-[12px] text-muted w-56">
          <Search size={14} />
          <span>Search projects, clients…</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs((s) => !s)}
            className="relative focus:outline-none"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-muted" strokeWidth={1.8} />
            {notifs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-brick rounded-full" />
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-7 w-80 bg-surface border border-line rounded-card shadow-xl z-40">
              <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-ink">Notifications</span>
                {notifs.length > 0 && (
                  <span className="text-[10.5px] text-muted">{notifs.length} unread</span>
                )}
              </div>
              {notifs.length === 0 && (
                <div className="px-4 py-6 text-center text-muted text-[12px]">All caught up.</div>
              )}
              <div className="divide-y divide-line max-h-72 overflow-y-auto">
                {notifs.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-vellum"
                  >
                    <div>
                      <div className="text-[12px] font-medium text-ink">{n.title}</div>
                      <div className="text-[11.5px] text-muted mt-0.5 leading-relaxed">{n.message}</div>
                    </div>
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="text-[10.5px] text-blueprint shrink-0 mt-0.5"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2">
          <div className="w-[30px] h-[30px] rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center font-semibold text-[12px]">
            {initials}
          </div>
          {user && (
            <div className="hidden lg:block">
              <div className="text-[12px] font-medium text-ink leading-tight">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-[10.5px] text-muted">{user.role}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-muted hover:text-ink ml-1"
            title="Sign out"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}
