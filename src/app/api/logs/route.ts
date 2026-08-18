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

  const logs = await prisma.dailyLog.findMany({
    where: {
      ...(projectId && { projectId }),

      ...(authorId && { authorId }),

      ...(dateFrom && {
        date: {
          gte: new Date(dateFrom),
        },
      }),

      // Non-admins only see logs for projects
      // they are the architect or supervisor on.
      ...(!isAdmin(session) && {
        project: {
          OR: [
            { architectId: session.user.id },
            { supervisorId: session.user.id },
          ],
        },
      }),
    },

    include: {
      author: {
        select: {
          id: true,
          name: true,
          initials: true,
          avatarUrl: true,
        },
      },

      project: {
        select: {
          id: true,
          name: true,
          sheetNo: true,
        },
      },
    },

    orderBy: {
      date: "desc",
    },

    take: 100,
  });

  return NextResponse.json(logs);
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
   */
  const [log] = await prisma.$transaction([
    prisma.dailyLog.create({
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

      include: {
        author: {
          select: {
            id: true,
            name: true,
            initials: true,
            avatarUrl: true,
          },
        },

        project: {
          select: {
            id: true,
            name: true,
            sheetNo: true,
          },
        },
      },
    }),

    prisma.project.update({
      where: {
        id: parsed.data.projectId,
      },

      data: {
        progress: calculatedProgress,
      },
    }),
  ]);

  return NextResponse.json(log, {
    status: 201,
  });
}