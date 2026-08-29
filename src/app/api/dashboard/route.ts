import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { projectAccessWhere } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /*
   * Every query below is deliberately flat -- no `include`/nested
   * relation selects. On this app's hosting (HostPinnacle + Neon over
   * WebSocket), queries involving relation joins fail with
   * "Connection terminated unexpectedly". This route is hit on nearly
   * every page load, so it's very likely a major contributor to
   * general app slowness before this fix. Related data (clients,
   * architects, supervisors, log authors, comment authors) is fetched
   * separately below as batched, flat queries and stitched back into
   * the exact same response shape the frontend already expects.
   */
  const [
    projectsRaw,
    todayLogsRaw,
    unresolvedCommentsRaw,
    recentActivityRaw,
    notifications,
    staff,
  ] = await Promise.all([
    prisma.project.findMany({
      where: projectAccessWhere(session),
      select: {
        id: true,
        sheetNo: true,
        name: true,
        status: true,
        priority: true,
        progress: true,
        budget: true,
        invoiced: true,
        paid: true,
        startDate: true,
        dueDate: true,
        clientId: true,
        architectId: true,
        supervisorId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: today } },
      select: {
        id: true,
        date: true,
        progress: true,
        submittedAt: true,
        projectId: true,
        authorId: true,
      },
    }),
    prisma.clientComment.findMany({
      where: { resolvedAt: null },
      select: {
        id: true,
        content: true,
        type: true,
        author: true,
        createdAt: true,
        resolvedAt: true,
        projectId: true,
        clientId: true,
        viaPortal: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.dailyLog.findMany({
      select: {
        id: true,
        date: true,
        progress: true,
        submittedAt: true,
        projectId: true,
        authorId: true,
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: { id: true, name: true, initials: true, role: true },
    }),
  ]);

  /*
   * Batch-fetch everything referenced above, deduplicated across all
   * of it into as few queries as possible.
   */
  const allClientIds = [
    ...new Set([
      ...projectsRaw.map((p) => p.clientId),
      ...unresolvedCommentsRaw.map((c) => c.clientId),
    ]),
  ];
  const allUserIds = [
    ...new Set([
      ...projectsRaw.flatMap((p) => [p.architectId, p.supervisorId]).filter((v): v is string => Boolean(v)),
      ...todayLogsRaw.map((l) => l.authorId),
      ...recentActivityRaw.map((l) => l.authorId),
    ]),
  ];
  const allProjectIds = [
    ...new Set([
      ...todayLogsRaw.map((l) => l.projectId),
      ...unresolvedCommentsRaw.map((c) => c.projectId),
      ...recentActivityRaw.map((l) => l.projectId),
    ]),
  ];

  const [relatedClients, relatedUsers, relatedProjects] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: allClientIds } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true, initials: true, avatarUrl: true },
    }),
    prisma.project.findMany({
      where: { id: { in: allProjectIds } },
      select: { id: true, name: true, sheetNo: true },
    }),
  ]);

  const clientById = new Map(relatedClients.map((c) => [c.id, c]));
  const userById = new Map(relatedUsers.map((u) => [u.id, u]));
  const projectById = new Map(relatedProjects.map((p) => [p.id, p]));

  const projects = projectsRaw.map((p) => ({
    ...p,
    client: clientById.get(p.clientId) ?? null,
    architect: p.architectId ? (userById.get(p.architectId) ?? null) : null,
    supervisor: p.supervisorId ? (userById.get(p.supervisorId) ?? null) : null,
  }));

  const todayLogs = todayLogsRaw.map((l) => ({
    ...l,
    author: userById.get(l.authorId) ?? null,
    project: projectById.get(l.projectId) ?? null,
  }));

  const unresolvedComments = unresolvedCommentsRaw.map((c) => ({
    ...c,
    project: projectById.get(c.projectId) ?? null,
    client: clientById.get(c.clientId) ?? null,
  }));

  const recentActivity = recentActivityRaw.map((l) => ({
    ...l,
    author: userById.get(l.authorId) ?? null,
    project: projectById.get(l.projectId) ?? null,
  }));

  // Financial aggregates
  const totalRevenue = projects.reduce((s: number, p: { paid: number }) => s + p.paid, 0);
  const totalOutstanding = projects.reduce(
  (
    sum: number,
    project: { budget: number; paid: number }
  ) =>
    sum +
    Math.max(
      Number(project.budget || 0) -
        Number(project.paid || 0),
      0
    ),
  0
);

  // Project health
  const onTrack = projects.filter((p: { status: string }) => p.status === "ON_TRACK").length;
  const atRisk = projects.filter((p: { status: string }) => p.status === "AT_RISK").length;
  const delayed = projects.filter((p: { status: string }) => p.status === "DELAYED").length;

  // Who hasn't submitted today
  const submittedIds = new Set(todayLogs.map((l: { authorId: string }) => l.authorId));
  const missingStaff = staff.filter((s: { id: string }) => !submittedIds.has(s.id));

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
