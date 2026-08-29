import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
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

  const phases = await prisma.projectPhase.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });

  const phaseIds = phases.map((p) => p.id);

  const [tasks, milestones] = await Promise.all([
    prisma.projectTask.findMany({ where: { phaseId: { in: phaseIds } } }),
    prisma.projectMilestone.findMany({ where: { phaseId: { in: phaseIds } } }),
  ]);

  const tasksByPhaseId = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.phaseId) continue;
    const list = tasksByPhaseId.get(task.phaseId) ?? [];
    list.push(task);
    tasksByPhaseId.set(task.phaseId, list);
  }

  const milestonesByPhaseId = new Map<string, typeof milestones>();
  for (const milestone of milestones) {
    if (!milestone.phaseId) continue;
    const list = milestonesByPhaseId.get(milestone.phaseId) ?? [];
    list.push(milestone);
    milestonesByPhaseId.set(milestone.phaseId, list);
  }

  const phasesWithRelations = phases.map((phase) => ({
    ...phase,
    tasks: tasksByPhaseId.get(phase.id) ?? [],
    milestones: milestonesByPhaseId.get(phase.id) ?? [],
  }));

  return NextResponse.json(phasesWithRelations);
}

export async function POST(
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

  const body = await req.json();

  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  if (!name) {
    return NextResponse.json(
      { error: "Phase name is required" },
      { status: 400 }
    );
  }

  const phase = await prisma.projectPhase.create({
    data: {
      projectId: id,
      name,
      description:
        typeof body.description === "string"
          ? body.description
          : null,
      weight:
        typeof body.weight === "number"
          ? Math.max(body.weight, 0)
          : 1,
      sortOrder:
        typeof body.sortOrder === "number"
          ? body.sortOrder
          : 0,
    },
  });

  return NextResponse.json(
    phase,
    { status: 201 }
  );
}