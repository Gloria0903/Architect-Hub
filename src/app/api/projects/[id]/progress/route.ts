import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/[id]/progress
 *
 * Returns the current calculated project progress together with
 * task/phase statistics.
 */
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

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tasks: true,
      phases: {
        include: {
          tasks: true,
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
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const tasks = project.tasks ?? [];
  const phases = project.phases ?? [];

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  const verifiedTasks = tasks.filter(
    (task) => task.status === "VERIFIED"
  ).length;

  const taskProgress =
    totalTasks > 0
      ? Math.round(
          ((completedTasks + verifiedTasks) / totalTasks) * 100
        )
      : 0;

  const totalPhases = phases.length;

  const completedPhases = phases.filter(
    (phase) => phase.status === "COMPLETED"
  ).length;

  const phaseProgress =
    totalPhases > 0
      ? Math.round((completedPhases / totalPhases) * 100)
      : 0;

  /**
   * If there are both phases and tasks, use a weighted average.
   *
   * This prevents a project with many tasks but incomplete phases
   * from appearing artificially complete.
   */
  let calculatedProgress = 0;

  if (totalTasks > 0 && totalPhases > 0) {
    calculatedProgress = Math.round(
      taskProgress * 0.7 + phaseProgress * 0.3
    );
  } else if (totalTasks > 0) {
    calculatedProgress = taskProgress;
  } else if (totalPhases > 0) {
    calculatedProgress = phaseProgress;
  } else {
    calculatedProgress = project.progress ?? 0;
  }

  return NextResponse.json({
    projectId: project.id,
    progress: calculatedProgress,

    tasks: {
      total: totalTasks,
      completed: completedTasks,
      verified: verifiedTasks,
      progress: taskProgress,
    },

    phases: {
      total: totalPhases,
      completed: completedPhases,
      progress: phaseProgress,
    },

    source:
      totalTasks > 0 || totalPhases > 0
        ? "calculated"
        : "project_record",
  });
}

/**
 * PATCH /api/projects/[id]/progress
 *
 * Recalculates and stores the project's progress.
 *
 * The client does NOT send an arbitrary percentage.
 * Progress is calculated from project tasks and phases.
 */
export async function PATCH(
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

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tasks: true,
      phases: {
        include: {
          tasks: true,
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
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const tasks = project.tasks ?? [];
  const phases = project.phases ?? [];

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) =>
      task.status === "COMPLETED" ||
      task.status === "VERIFIED"
  ).length;

  const taskProgress =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  const totalPhases = phases.length;

  const completedPhases = phases.filter(
    (phase) => phase.status === "COMPLETED"
  ).length;

  const phaseProgress =
    totalPhases > 0
      ? Math.round((completedPhases / totalPhases) * 100)
      : 0;

  let calculatedProgress = 0;

  if (totalTasks > 0 && totalPhases > 0) {
    calculatedProgress = Math.round(
      taskProgress * 0.7 + phaseProgress * 0.3
    );
  } else if (totalTasks > 0) {
    calculatedProgress = taskProgress;
  } else if (totalPhases > 0) {
    calculatedProgress = phaseProgress;
  } else {
    calculatedProgress = project.progress ?? 0;
  }

  const updatedProject = await prisma.project.update({
    where: { id },
    data: {
      progress: calculatedProgress,
    },
  });

  return NextResponse.json({
    success: true,
    projectId: updatedProject.id,
    progress: updatedProject.progress,

    tasks: {
      total: totalTasks,
      completed: completedTasks,
      progress: taskProgress,
    },

    phases: {
      total: totalPhases,
      completed: completedPhases,
      progress: phaseProgress,
    },
  });
}
