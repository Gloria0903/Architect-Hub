"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { useStore } from "@/store/app-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, error } = useStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-vellum">
      <div className="print:hidden">
        <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      </div>
      <main className="flex-1 p-4 sm:p-6 lg:p-7 print:p-0 overflow-x-hidden min-w-0">
        <div className="flex items-center justify-between mb-3 print:hidden">
          {/* Hamburger trigger, mobile only -- the sidebar is always
              visible at lg and up, so this has nothing to do there. */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden text-muted hover:text-ink p-1.5 -ml-1.5 rounded-md hover:bg-vellum"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <ProfileMenu />
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blueprint border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-[12.5px]">Loading data…</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-brick-bg border border-brick/20 rounded-card p-5 max-w-md">
            <div className="text-brick font-medium text-[13px] mb-1">Failed to load data</div>
            <p className="text-[12.5px] text-brick/80">{error}</p>
            <p className="text-[11.5px] text-muted mt-2">Make sure your DATABASE_URL is set in .env and the database is running.</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
