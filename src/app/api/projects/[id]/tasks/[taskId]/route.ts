import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";

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
      include: {
        phase: true,
        assignee: true,
        updates: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

  if (!task) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(task);
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
  const projectData =
    await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            weight: true,
            completion: true,
            status: true,
          },
        },

        milestones: {
          select: {
            weight: true,
            status: true,
          },
        },
      },
    });

  if (projectData) {
    const totalWeight =
      projectData.tasks.reduce(
        (sum, item) =>
          sum + Math.max(item.weight, 0),
        0
      );

    const taskProgress =
      totalWeight > 0
        ? Math.round(
            projectData.tasks.reduce(
              (sum, item) =>
                sum +
                Math.min(
                  Math.max(
                    item.completion,
                    0
                  ),
                  100
                ) *
                  Math.max(
                    item.weight,
                    0
                  ),
              0
            ) / totalWeight
          )
        : 0;

    const milestoneWeight =
      projectData.milestones.reduce(
        (sum, item) =>
          sum + Math.max(item.weight, 0),
        0
      );

    const milestoneProgress =
      milestoneWeight > 0
        ? Math.round(
            (projectData.milestones.reduce(
              (sum, item) =>
                sum +
                (
                  item.status === "COMPLETED" ||
                  item.status === "APPROVED"
                    ? Math.max(
                        item.weight,
                        0
                      )
                    : 0
                ),
              0
            ) /
              milestoneWeight) *
              100
          )
        : 0;

    const calculatedProgress =
      projectData.tasks.length > 0 &&
      projectData.milestones.length > 0
        ? Math.round(
            taskProgress * 0.8 +
              milestoneProgress * 0.2
          )
        : projectData.tasks.length > 0
          ? taskProgress
          : milestoneProgress;

    await prisma.project.update({
      where: { id },
      data: {
        progress: calculatedProgress,
      },
    });
  }

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