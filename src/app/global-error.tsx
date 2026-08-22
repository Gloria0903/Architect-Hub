"use client";

import { useEffect } from "react";

/**
 * The last line of defense. Only fires when an error breaks the ROOT
 * layout itself (not just a page under it â€” src/app/error.tsx handles
 * that, more common case). Because this replaces the root layout, it
 * has to render its own <html>/<body> â€” the normal layout isn't
 * available anymore at this point.
 *
 * Kept deliberately minimal and dependency-free: if things are broken
 * enough to reach this boundary, the fewer things this component itself
 * relies on, the better the odds it still renders.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Architect Hub] Root-level error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: "360px", textAlign: "center" }}>
            <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#1A1D1F" }}>
              Architect Hub couldn&apos;t load
            </h1>
            <p style={{ marginTop: "8px", fontSize: "13px", color: "#6B7280" }}>
              Something went wrong at startup. Your data is safe â€” try
              reloading, and contact your admin if this continues.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "16px",
                padding: "10px 18px",
                borderRadius: "6px",
                background: "#1A1D1F",
                color: "white",
                fontSize: "13px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
