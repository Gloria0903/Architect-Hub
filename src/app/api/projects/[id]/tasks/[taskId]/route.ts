import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";
import { calculateProjectProgress } from "@/lib/project-progress";

type RouteContext = {
  params: Promise<{
    id: string;
    taskId: string;
  }>;
};

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, taskId } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const task =
    await prisma.projectTask.findFirst({
      where: {
        id: taskId,
        projectId: id,
      },
    });

  if (!task) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    );
  }

  const [phase, assignee, updates] = await Promise.all([
    task.phaseId
      ? prisma.projectPhase.findUnique({ where: { id: task.phaseId } })
      : Promise.resolve(null),
    task.assigneeId
      ? prisma.user.findUnique({ where: { id: task.assigneeId } })
      : Promise.resolve(null),
    prisma.taskUpdate.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ ...task, phase, assignee, updates });
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, taskId } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const existing =
    await prisma.projectTask.findFirst({
      where: {
        id: taskId,
        projectId: id,
      },
    });

  if (!existing) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    );
  }

  const body = await req.json();

  let completion =
    typeof body.completion === "number"
      ? Math.min(
          Math.max(body.completion, 0),
          100
        )
      : existing.completion;

  let status =
    typeof body.status === "string"
      ? body.status
      : existing.status;

  if (completion === 100) {
    status = "COMPLETED";
  }

  if (
    status === "COMPLETED" ||
    status === "VERIFIED"
  ) {
    completion = 100;
  }

  const task =
    await prisma.projectTask.update({
      where: {
        id: taskId,
      },

      data: {
        ...(typeof body.title === "string" && {
          title: body.title.trim(),
        }),

        ...(typeof body.description === "string" && {
          description: body.description,
        }),

        ...(typeof body.phaseId === "string" && {
          phaseId: body.phaseId,
        }),

        ...(typeof body.weight === "number" && {
          weight: Math.max(body.weight, 0),
        }),

        completion,

        status,
      },
    });

  /**
   * Recalculate overall project progress
   * whenever a task changes.
   */
  const [projectTasks, projectMilestones] = await Promise.all([
    prisma.projectTask.findMany({
      where: { projectId: id },
      select: { weight: true, completion: true, status: true },
    }),
    prisma.projectMilestone.findMany({
      where: { projectId: id },
      select: { weight: true, status: true },
    }),
  ]);

  // Single source of truth for the formula -- see
  // src/lib/project-progress.ts. This used to be a hand-copied version
  // of the same math living here too, which risked silently drifting
  // out of sync with the real implementation if the formula ever
  // changed in one place and not the other.
  const calculatedProgress = calculateProjectProgress({
    tasks: projectTasks,
    milestones: projectMilestones,
  });

  await prisma.project.update({
    where: { id },
    data: {
      progress: calculatedProgress,
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, taskId } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const existing =
    await prisma.projectTask.findFirst({
      where: {
        id: taskId,
        projectId: id,
      },
    });

  if (!existing) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    );
  }

  await prisma.projectTask.delete({
    where: {
      id: taskId,
    },
  });

  return NextResponse.json({
    success: true,
  });
}