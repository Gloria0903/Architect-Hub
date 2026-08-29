import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { auth } from "@/lib/auth";

import { isAdmin, canAccessProject } from "@/lib/rbac";

import { z } from "zod";

import { calculateProjectProgress } from "@/lib/project-progress";

const Schema = z.object({
  projectId: z.string(),

  workCompleted: z
    .string()
    .trim()
    .min(10, "Work completed must contain at least 10 characters"),

  challenges: z.string().optional().default(""),

  pendingWork: z.string().optional().default(""),

  nextActions: z.string().optional().default(""),

  date: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);

  const projectId = searchParams.get("projectId");
  const authorId = searchParams.get("authorId");
  const dateFrom = searchParams.get("dateFrom");

  /*
   * Same flat-query fix as /api/projects, /api/payments,
   * /api/invoices: relational where filters and nested includes both
   * fail with "Connection terminated unexpectedly" on this app's
   * hosting (HostPinnacle + Neon over WebSocket). Non-admin project
   * access is resolved to a flat list of project IDs first, instead
   * of `where: { project: { OR: [...] } }` (a join).
   */
  let accessibleProjectIds: string[] | undefined;

  if (!isAdmin(session)) {
    const accessibleProjects = await prisma.project.findMany({
      where: {
        OR: [
          { architectId: session.user.id },
          { supervisorId: session.user.id },
        ],
      },
      select: { id: true },
    });
    accessibleProjectIds = accessibleProjects.map((p) => p.id);
  }

  const logs = await prisma.dailyLog.findMany({
    where: {
      ...(projectId && { projectId }),

      ...(authorId && { authorId }),

      ...(dateFrom && {
        date: {
          gte: new Date(dateFrom),
        },
      }),

      ...(accessibleProjectIds
        ? { projectId: { in: accessibleProjectIds } }
        : {}),
    },

    select: {
      id: true,
      date: true,
      workCompleted: true,
      challenges: true,
      pendingWork: true,
      nextActions: true,
      progress: true,
      submittedAt: true,
      projectId: true,
      authorId: true,
    },

    orderBy: {
      date: "desc",
    },

    take: 100,
  });

  const logAuthorIds = [...new Set(logs.map((l) => l.authorId))];
  const logProjectIds = [...new Set(logs.map((l) => l.projectId))];
  const logIds = logs.map((l) => l.id);

  const [authors, projects, attachments] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: logAuthorIds } },
      select: { id: true, name: true, initials: true, avatarUrl: true },
    }),
    prisma.project.findMany({
      where: { id: { in: logProjectIds } },
      select: { id: true, name: true, sheetNo: true },
    }),
    prisma.document.findMany({
      where: { dailyLogId: { in: logIds }, deletedAt: null, isLatest: true },
      select: {
        id: true,
        name: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        dailyLogId: true,
      },
    }),
  ]);

  const authorById = new Map(authors.map((a) => [a.id, a]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const attachmentsByLogId = new Map<string, typeof attachments>();
  for (const doc of attachments) {
    if (!doc.dailyLogId) continue;
    const list = attachmentsByLogId.get(doc.dailyLogId) ?? [];
    list.push(doc);
    attachmentsByLogId.set(doc.dailyLogId, list);
  }

  const logsWithRelations = logs.map((log) => ({
    ...log,
    author: authorById.get(log.authorId) ?? null,
    project: projectById.get(log.projectId) ?? null,
    attachments: attachmentsByLogId.get(log.id) ?? [],
  }));

  return NextResponse.json(logsWithRelations);
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();

  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    const firstError =
      parsed.error.issues[0]?.message ??
      "Please check the daily log form.";

    return NextResponse.json(
      { error: firstError },
      { status: 400 }
    );
  }

  /*
   * Get the project together with its tasks and milestones.
   *
   * Project progress is calculated from these records.
   * The user does NOT provide a progress percentage.
   */
  const project = await prisma.project.findUnique({
    where: {
      id: parsed.data.projectId,
    },

    select: {
      id: true,
      architectId: true,
      supervisorId: true,

      progress: true,

      tasks: {
        select: {
          id: true,
          weight: true,
          completion: true,
          status: true,
        },
      },

      milestones: {
        select: {
          id: true,
          weight: true,
          status: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json(
      { error: "You are not assigned to this project" },
      { status: 403 }
    );
  }

  /*
   * Calculate project progress automatically.
   *
   * Tasks = 80%
   * Milestones = 20%
   *
   * If the project does not yet have tasks or milestones,
   * preserve the existing project progress rather than
   * forcing it to 0.
   */
  const hasProgressSources =
    project.tasks.length > 0 ||
    project.milestones.length > 0;

  const calculatedProgress = hasProgressSources
    ? calculateProjectProgress({
        tasks: project.tasks,
        milestones: project.milestones,
      })
    : project.progress;

  const logDate = parsed.data.date
    ? new Date(parsed.data.date)
    : new Date();

  logDate.setHours(0, 0, 0, 0);

  /*
   * Check for duplicate log
   * (same author, project and date).
   */
  const existing = await prisma.dailyLog.findUnique({
    where: {
      projectId_authorId_date: {
        projectId: parsed.data.projectId,
        authorId: session.user.id,
        date: logDate,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      {
        error:
          "A log for this project has already been submitted today",
      },
      { status: 409 }
    );
  }

  /*
   * Save the daily log and update the project progress
   * using the calculated value.
   *
   * The user never supplies this percentage.
   *
   * Deliberately NOT wrapped in prisma.$transaction() -- the
   * transaction wrapper itself requires this app's WebSocket
   * connection to the database, which is unreliable on this host
   * regardless of how simple the queries inside it are (confirmed:
   * flattening these two queries' shape alone did not fix this route,
   * only removing the transaction wrapper did). Two sequential writes
   * instead. If the log write succeeds but the progress update fails,
   * the log still exists and progress is very slightly stale until
   * the next log submission recalculates it -- a minor, self-healing
   * inconsistency, not a correctness problem the way an unprotected
   * financial write would be.
   */
  const log = await prisma.dailyLog.create({
    data: {
      projectId: parsed.data.projectId,

      authorId: session.user.id,

      date: logDate,

      workCompleted: parsed.data.workCompleted,

      challenges: parsed.data.challenges,

      pendingWork: parsed.data.pendingWork,

      nextActions: parsed.data.nextActions,

      progress: calculatedProgress,
    },

    select: {
      id: true,
      date: true,
      workCompleted: true,
      challenges: true,
      pendingWork: true,
      nextActions: true,
      progress: true,
      submittedAt: true,
      projectId: true,
      authorId: true,
    },
  });

  await prisma.project.update({
    where: {
      id: parsed.data.projectId,
    },

    data: {
      progress: calculatedProgress,
    },
  });

  /*
   * Same flat-lookup pattern as GET above -- author/project fetched
   * separately instead of a nested include on the create call itself,
   * which fails on this host. A brand-new log has no attachments yet
   * (those get added afterward via a separate upload step), so an
   * empty array here matches what a nested include would have
   * returned anyway.
   */
  const [author, project2] = await Promise.all([
    prisma.user.findUnique({
      where: { id: log.authorId },
      select: { id: true, name: true, initials: true, avatarUrl: true },
    }),
    prisma.project.findUnique({
      where: { id: log.projectId },
      select: { id: true, name: true, sheetNo: true },
    }),
  ]);

  return NextResponse.json(
    { ...log, author, project: project2, attachments: [] },
    {
      status: 201,
    }
  );
}