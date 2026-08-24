"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

interface NotificationItem {
  id: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

const TYPE_DOT: Record<NotificationType, string> = {
  INFO: "bg-blueprint",
  WARNING: "bg-ochre",
  SUCCESS: "bg-moss",
  ERROR: "bg-brick",
};

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Polls rather than using WebSockets/SSE — matches the "in-app + email"
 * notification requirement without a persistent-connection infra
 * dependency. Swap for push-based delivery later if 30s feels too slow.
 */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=true&limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent — a failed poll just tries again next interval.
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask — see document-list.tsx for why calling load()
    // directly at the top of the effect trips react-hooks/set-state-in-effect.
    Promise.resolve().then(load);
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
  }

  async function markAllRead() {
    setNotifications([]);
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => {});
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-muted hover:text-ink hover:bg-vellum transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brick text-white text-[9px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-line rounded-card shadow-lg z-50 max-h-[420px] flex flex-col">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
            <span className="font-display font-semibold text-[13px] text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-blueprint hover:underline"
              >
                <CheckCheck size={12} />Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-muted text-[12px]">You&apos;re all caught up.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  title="Click to mark as read and clear"
                  className="w-full text-left px-3.5 py-2.5 border-b border-line last:border-b-0 hover:bg-vellum/60 transition-colors flex gap-2 bg-blueprint-bg/30"
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TYPE_DOT[n.type]}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] leading-snug text-ink">{n.message}</span>
                    <span className="block text-[10.5px] text-muted mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
