"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  /** Photo URL, e.g. `/api/avatar/{userId}?v=...`. Falls back to initials when absent, loading, or broken. */
  avatarUrl?: string | null;
  initials?: string;
  name?: string;
  /** Pixel size (square). Defaults to 32. */
  size?: number;
  /** Font size for the initials fallback, in px. Defaults to size * 0.4. */
  fontSize?: number;
  className?: string;
}

/**
 * Single source of truth for how a person's avatar renders anywhere in the
 * app — top nav, profile dropdown, settings, staff list, log/comment author
 * bubbles. Shows the uploaded photo when one exists; otherwise falls back to
 * initials on a tinted circle, matching the look every bubble already had
 * before photos existed. If the photo URL 404s (e.g. stale cache after
 * removal), it falls back to initials rather than showing a broken image.
 */
export function Avatar({ avatarUrl, initials, name, size = 32, fontSize, className }: AvatarProps) {
  // Track which URL last failed to load, rather than a plain boolean flag.
  // This derives "errored" straight from render instead of needing an effect
  // to reset it when avatarUrl changes (e.g. after a fresh upload swaps in a
  // new ?v= cache-buster) — avoids the extra render pass a setState-in-effect
  // pattern would cause.
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);

  const errored = erroredUrl !== null && erroredUrl === avatarUrl;
  const fallback = initials || name?.slice(0, 2).toUpperCase() || "?";
  const showPhoto = Boolean(avatarUrl) && !errored;

  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl!}
        alt={name || fallback}
        onError={() => setErroredUrl(avatarUrl ?? null)}
        className={cn("rounded-full object-cover shrink-0 bg-blueprint-bg", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center font-semibold shrink-0",
        className
      )}
      style={{ width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.4) }}
    >
      {fallback}
    </div>
  );
}