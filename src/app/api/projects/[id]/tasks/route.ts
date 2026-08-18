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
    include: {
      tasks: {
        include: {
          phase: true,
          assignee: true,
          updates: true,
        },
        orderBy: {
          createdAt: "asc",
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

  return NextResponse.json(project.tasks);
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