"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Catches unhandled errors thrown during render (or in a Server Component
 * that streams down to this segment) anywhere under the app. Before this
 * existed, one bad render â€” a null pointer, an unexpected API response
 * shape, whatever â€” took the entire page down to Next's raw, unstyled
 * default error screen. This gives people a branded, calm fallback with
 * a real way back in, instead of a dead end.
 *
 * Deliberately does NOT show error.message to the user â€” that can leak
 * internal details (stack fragments, query info). It's logged to the
 * console for now; wire this into Sentry (or similar) once that's set up
 * so these are visible without someone having to report them manually.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Architect Hub] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brick/10">
          <AlertTriangle size={22} className="text-brick" />
        </div>

        <h1 className="font-display text-[17px] font-bold text-ink">
          Something went wrong
        </h1>

        <p className="mt-1.5 text-[12.5px] text-muted">
          That's on us, not you. Your work up to this point is safe â€” try
          again, and if it keeps happening, let your admin know.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mx-auto mt-4 flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink/90"
        >
          <RotateCw size={13} />
          Try again
        </button>
      </div>
    </div>
  );
}
