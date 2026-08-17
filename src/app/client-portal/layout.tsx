"use client";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useFirmName } from "@/lib/use-firm-name";
import { LogOut } from "lucide-react";

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const firmName = useFirmName();

  return (
    <div className="min-h-screen bg-vellum">
      <header className="bg-surface border-b border-line px-5 py-3 flex items-center justify-between">
        <Link href="/client-portal" className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 16 L9 2 L16 16 Z" fill="none" stroke="#2451C4" strokeWidth="1.4" />
            <line x1="2" y1="16" x2="16" y2="16" stroke="#2451C4" strokeWidth="1.4" />
          </svg>
          <span className="font-display font-bold text-[16px] text-ink">{firmName}</span>
          <span className="text-[11px] text-muted border border-line rounded-full px-2 py-0.5 ml-1">Client Portal</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-ink">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 text-[12px] text-muted hover:text-brick"
          >
            <LogOut size={14} />Sign out
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-5">{children}</main>
    </div>
  );
}
