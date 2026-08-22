import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const Schema = z.object({
  notifyLogReminder: z.boolean(),
  notifyProjectDelay: z.boolean(),
  notifyClientComment: z.boolean(),
  notifyWeeklySummary: z.boolean(),
});

const SELECT = {
  notifyLogReminder: true,
  notifyProjectDelay: true,
  notifyClientComment: true,
  notifyWeeklySummary: true,
} as const;

/**
 * Per-user notification preferences (replaces the old settings page
 * toggles, which weren't wired to anything). The email/notification queue
 * (src/lib/queues/email-queue.ts) should check these before enqueuing the
 * corresponding notification type.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: SELECT,
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: SELECT,
  });

  return NextResponse.json(user);
}
