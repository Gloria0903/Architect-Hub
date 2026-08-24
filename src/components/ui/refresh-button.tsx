"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useStore } from "@/store/app-store";

/**
 * Manual refresh trigger for pages where people want to confirm they're
 * looking at current data right now, rather than waiting on the
 * passive 30s background poll (see app-store.tsx). Calls the exact
 * same refresh() the background poll uses -- same throttling, same
 * silent-update behavior -- so this never causes the full-page-spinner
 * flash that patch 12 fixed elsewhere.
 */
export function RefreshButton({ className = "" }: { className?: string }) {
  const { refresh } = useStore();
  const [spinning, setSpinning] = useState(false);

  async function handleClick() {
    if (spinning) return;
    setSpinning(true);
    try {
      await refresh();
    } finally {
      // Keep the spin visible briefly even on a very fast refresh --
      // an instant flicker reads as "did that even do anything?"
      setTimeout(() => setSpinning(false), 400);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      title="Refresh data"
      aria-label="Refresh data"
      className={`flex items-center gap-1.5 text-muted hover:text-ink text-[11.5px] px-2 py-1.5 rounded-md hover:bg-vellum disabled:opacity-60 transition-colors ${className}`}
    >
      <RefreshCw size={13} className={spinning ? "animate-spin" : ""} />
      Refresh
    </button>
  );
}
