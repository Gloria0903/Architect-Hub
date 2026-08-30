import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a YYYY-MM-DD key for a date, in the firm's own timezone
 * (Africa/Nairobi) rather than the browser's or server's local
 * timezone or UTC. Use this for ANY "is this today" or "which day is
 * this" comparison in the app -- never compare raw date strings or
 * ISO timestamps directly, and never use .toISOString() for this,
 * since that's always UTC and silently disagrees with Nairobi time
 * for the few hours around each local midnight.
 *
 * Accepts a Date, an ISO timestamp string (e.g. what Prisma's
 * DateTime fields serialize to over JSON), or a bare date string --
 * whatever shape the value happens to be in, the result is always a
 * plain YYYY-MM-DD string safe to compare with === against another
 * call to this same function.
 */
export function dayKey(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // en-CA locale formats as YYYY-MM-DD directly -- no manual
  // reassembly of parts needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
