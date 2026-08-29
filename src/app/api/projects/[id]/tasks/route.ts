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

  /*
   * Same flat-query fix as elsewhere in this app: nested includes fail
   * with "Connection terminated unexpectedly" on this host. Tasks and
   * every relation they reference (phase, assignee, updates) are
   * fetched as separate flat queries and stitched together below.
   */
  const tasks = await prisma.projectTask.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
  });

  const taskIds = tasks.map((t) => t.id);
  const phaseIds = [...new Set(tasks.map((t) => t.phaseId).filter((v): v is string => Boolean(v)))];
  const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId).filter((v): v is string => Boolean(v)))];

  const [phases, assignees, updates] = await Promise.all([
    prisma.projectPhase.findMany({ where: { id: { in: phaseIds } } }),
    prisma.user.findMany({ where: { id: { in: assigneeIds } } }),
    prisma.taskUpdate.findMany({ where: { taskId: { in: taskIds } }, orderBy: { createdAt: "desc" } }),
  ]);

  const phaseById = new Map(phases.map((p) => [p.id, p]));
  const assigneeById = new Map(assignees.map((a) => [a.id, a]));
  const updatesByTaskId = new Map<string, typeof updates>();
  for (const update of updates) {
    const list = updatesByTaskId.get(update.taskId) ?? [];
    list.push(update);
    updatesByTaskId.set(update.taskId, list);
  }

  const tasksWithRelations = tasks.map((task) => ({
    ...task,
    phase: task.phaseId ? (phaseById.get(task.phaseId) ?? null) : null,
    assignee: task.assigneeId ? (assigneeById.get(task.assigneeId) ?? null) : null,
    updates: updatesByTaskId.get(task.id) ?? [],
  }));

  return NextResponse.json(tasksWithRelations);
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

  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  if (!title) {
    return NextResponse.json(
      { error: "Task title is required" },
      { status: 400 }
    );
  }

  const task =
    await prisma.projectTask.create({
      data: {
        projectId: id,
        title,

        description:
          typeof body.description === "string"
            ? body.description
            : null,

        phaseId:
          typeof body.phaseId === "string"
            ? body.phaseId
            : null,

        weight:
          typeof body.weight === "number"
            ? Math.max(body.weight, 0)
            : 1,

        completion:
          typeof body.completion === "number"
            ? Math.min(
                Math.max(body.completion, 0),
                100
              )
            : 0,

        status:
          typeof body.status === "string"
            ? body.status
            : "NOT_STARTED",

        createdById: session.user.id,
      },
    });

  return NextResponse.json(
    task,
    { status: 201 }
  );
}