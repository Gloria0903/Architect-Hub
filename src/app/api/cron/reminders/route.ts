import { NextRequest, NextResponse } from "next/server";
import { checkApproachingDeadlines, checkMissingDailyReports } from "@/jobs/reminder-checks";

/**
 * Runs the two scheduled reminder checks (approaching deadlines, missing
 * daily reports) on demand, triggered by an external cron caller instead
 * of a persistent BullMQ worker.
 *
 * WHY THIS EXISTS: reminders/reminder-checks.ts already contained the
 * real logic independent of BullMQ -- this route just calls it directly.
 * On a platform that can run a persistent worker (Railway), keep using
 * src/jobs/reminders-worker.ts as the primary path -- it's more precise
 * (runs at exact times: 08:00 daily, 17:00 weekdays) and doesn't depend
 * on an external cron service's reliability. This endpoint is for
 * platforms that CAN'T run a second always-on process at all (shared
 * hosting like HostAfrica's DirectAdmin Node.js Selector), where "a cron
 * job hits a URL periodically" is the only scheduling primitive
 * available. Safe to call more than once in the same day/hour -- both
 * underlying checks only act on genuinely new conditions each run, they
 * don't re-notify for something already flagged.
 *
 * SECURITY: gated by a shared secret (CRON_SECRET) rather than session
 * auth, since the caller here is an external cron service, not a logged-
 * in user. Compares via a constant-time check to avoid a timing attack
 * revealing the secret one character at a time. Without CRON_SECRET set,
 * this route refuses every request rather than running unauthenticated
 * -- these checks send emails, so an unauthenticated caller being able
 * to trigger them repeatedly is a real abuse vector, not just a
 * theoretical one.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron] CRON_SECRET is not configured -- refusing to run reminder checks.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const provided =
    // Vercel's own convention: setting a CRON_SECRET env var makes
    // Vercel automatically send it as this exact header on every cron
    // invocation, no vercel.json config needed for the secret itself.
    bearerToken ??
    // For external cron services or manual testing, where either of
    // these is easier to configure than a custom Authorization header.
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("x-cron-secret") ??
    "";

  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([
    checkApproachingDeadlines(),
    checkMissingDailyReports(),
  ]);

  const [deadlines, missingReports] = results;

  const summary = {
    deadlines: deadlines.status === "fulfilled" ? deadlines.value : { error: String(deadlines.reason) },
    missingReports: missingReports.status === "fulfilled" ? missingReports.value : { error: String(missingReports.reason) },
  };

  const hadFailure = results.some((r) => r.status === "rejected");

  if (hadFailure) {
    console.error("[cron] One or more reminder checks failed:", summary);
  }

  return NextResponse.json(summary, { status: hadFailure ? 207 : 200 });
}

/** Constant-time string comparison -- avoids leaking the secret via response-time differences. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
