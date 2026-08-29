import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";
import {
  calculateProjectProgress,
  calculateTaskProgress,
  calculateMilestoneProgress,
} from "@/lib/project-progress";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/[id]/progress
 *
 * Returns calculated physical project progress.
 *
 * Progress is based on:
 * - Task completion: 80%
 * - Milestone completion: 20%
 *
 * If only tasks or milestones exist, that source is used directly.
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

  const [tasks, milestones, phases] = await Promise.all([
    prisma.projectTask.findMany({
      where: { projectId: id },
      select: {
        id: true,
        title: true,
        status: true,
        completion: true,
        weight: true,
        phaseId: true,
      },
    }),
    prisma.projectMilestone.findMany({
      where: { projectId: id },
      select: {
        id: true,
        title: true,
        status: true,
        weight: true,
        phaseId: true,
      },
    }),
    prisma.projectPhase.findMany({
      where: { projectId: id },
      select: {
        id: true,
        name: true,
        weight: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    }),
  ]);

  const taskProgress = calculateTaskProgress(tasks);
  const milestoneProgress =
    calculateMilestoneProgress(milestones);

  const calculatedProgress =
    calculateProjectProgress({
      tasks,
      milestones,
    });

  /**
   * Calculate progress for each phase.
   *
   * A phase does not have its own status in the database.
   * Its progress is therefore calculated from the tasks
   * and milestones belonging to that phase.
   */
  const phaseProgress = phases.map((phase) => {
    const phaseTasks = tasks.filter(
      (task) => task.phaseId === phase.id
    );

    const phaseMilestones = milestones.filter(
      (milestone) =>
        milestone.phaseId === phase.id
    );

    const progress =
      calculateProjectProgress({
        tasks: phaseTasks,
        milestones: phaseMilestones,
      });

    return {
      id: phase.id,
      name: phase.name,
      weight: phase.weight,
      progress,
      tasks: {
        total: phaseTasks.length,
        progress: calculateTaskProgress(phaseTasks),
      },
      milestones: {
        total: phaseMilestones.length,
        progress:
          calculateMilestoneProgress(
            phaseMilestones
          ),
      },
    };
  });

  return NextResponse.json({
    projectId: project.id,

    progress: calculatedProgress,

    tasks: {
      total: tasks.length,
      completed: tasks.filter(
        (task) =>
          task.status === "COMPLETED" ||
          task.status === "VERIFIED"
      ).length,
      progress: taskProgress,
    },

    milestones: {
      total: milestones.length,
      completed: milestones.filter(
        (milestone) =>
          milestone.status === "COMPLETED" ||
          milestone.status === "APPROVED"
      ).length,
      progress: milestoneProgress,
    },

    phases: phaseProgress,

    source:
      tasks.length > 0 ||
      milestones.length > 0
        ? "calculated"
        : "project_record",
  });
}

/**
 * PATCH /api/projects/[id]/progress
 *
 * Recalculates and stores the project's physical progress.
 *
 * The client does NOT provide a percentage.
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

  const [tasks, milestones] = await Promise.all([
    prisma.projectTask.findMany({
      where: { projectId: id },
      select: {
        id: true,
        status: true,
        completion: true,
        weight: true,
      },
    }),
    prisma.projectMilestone.findMany({
      where: { projectId: id },
      select: {
        id: true,
        status: true,
        weight: true,
      },
    }),
  ]);

  const calculatedProgress =
    calculateProjectProgress({
      tasks,
      milestones,
    });

  const updatedProject =
    await prisma.project.update({
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
      total: tasks.length,

      completed:
        tasks.filter(
          (task) =>
            task.status === "COMPLETED" ||
            task.status === "VERIFIED"
        ).length,

      progress:
        calculateTaskProgress(
          tasks
        ),
    },

    milestones: {
      total: milestones.length,

      completed:
        milestones.filter(
          (milestone) =>
            milestone.status === "COMPLETED" ||
            milestone.status === "APPROVED"
        ).length,

      progress:
        calculateMilestoneProgress(
          milestones
        ),
    },
  });
}