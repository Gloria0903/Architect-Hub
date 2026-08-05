import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    projects,
    todayLogs,
    unresolvedComments,
    recentActivity,
    notifications,
    staff,
  ] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: { select: { id: true, name: true } },
        architect: { select: { id: true, name: true, initials: true } },
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: today } },
      include: {
        author: { select: { id: true, name: true, initials: true } },
        project: { select: { id: true, name: true, sheetNo: true } },
      },
    }),
    prisma.clientComment.findMany({
      where: { resolvedAt: null },
      include: {
        project: { select: { id: true, name: true, sheetNo: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.dailyLog.findMany({
      include: {
        author: { select: { id: true, name: true, initials: true } },
        project: { select: { id: true, name: true, sheetNo: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id! },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: { id: true, name: true, initials: true, role: true },
    }),
  ]);

  // Financial aggregates
  const totalRevenue = projects.reduce((s, p) => s + p.paid, 0);
  const totalOutstanding = projects.reduce((s, p) => s + (p.invoiced - p.paid), 0);

  // Project health
  const onTrack = projects.filter((p) => p.status === "ON_TRACK").length;
  const atRisk = projects.filter((p) => p.status === "AT_RISK").length;
  const delayed = projects.filter((p) => p.status === "DELAYED").length;

  // Who hasn't submitted today
  const submittedIds = new Set(todayLogs.map((l) => l.authorId));
  const missingStaff = staff.filter((s) => !submittedIds.has(s.id));

  return NextResponse.json({
    projects,
    todayLogs,
    unresolvedComments,
    recentActivity,
    notifications,
    stats: {
      totalProjects: projects.length,
      totalRevenue,
      totalOutstanding,
      onTrack,
      atRisk,
      delayed,
      logsToday: todayLogs.length,
      missingLogs: missingStaff.length,
      missingStaff,
      unresolvedComments: unresolvedComments.length,
    },
  });
}
