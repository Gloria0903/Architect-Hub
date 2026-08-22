import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, redisConfigured } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Health check for load balancers / uptime monitors / container
 * orchestration. Checks the two hard external dependencies:
 *  - Postgres (via Prisma) â€” if this fails, nothing works, so we 503.
 *  - Redis â€” email queue + reminders. If it's down, the app still serves
 *    traffic, so we report it as "degraded" rather than failing the whole
 *    check (don't want a Redis blip taking the app out of rotation).
 */
export async function GET() {
  const startedAt = Date.now();

  const dbCheck = await prisma.$queryRaw`SELECT 1`
    .then(() => ({ ok: true as const }))
    .catch((err: Error) => ({ ok: false as const, error: err.message }));

  let redisStatus: "connected" | "unreachable" | "not_configured" = "not_configured";
  if (redisConfigured) {
    try {
      await redis.ping();
      redisStatus = "connected";
    } catch {
      redisStatus = "unreachable";
    }
  }

  const body = {
    status: dbCheck.ok ? ("ok" as const) : ("error" as const),
    checks: {
      database: dbCheck.ok ? "connected" : `error: ${dbCheck.error}`,
      redis: redisStatus,
    },
    uptimeCheckMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: dbCheck.ok ? 200 : 503 });
}
