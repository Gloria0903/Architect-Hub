import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{
    id: string;
    phaseId: string;
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

  const { id, phaseId } = await params;

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

  const phase =
    await prisma.projectPhase.findFirst({
      where: {
        id: phaseId,
        projectId: id,
      },
    });

  if (!phase) {
    return NextResponse.json(
      { error: "Phase not found" },
      { status: 404 }
    );
  }

  const [tasks, milestones] = await Promise.all([
    prisma.projectTask.findMany({ where: { phaseId: phase.id } }),
    prisma.projectMilestone.findMany({ where: { phaseId: phase.id } }),
  ]);

  return NextResponse.json({ ...phase, tasks, milestones });
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

  const { id, phaseId } = await params;

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
    await prisma.projectPhase.findFirst({
      where: {
        id: phaseId,
        projectId: id,
      },
    });

  if (!existing) {
    return NextResponse.json(
      { error: "Phase not found" },
      { status: 404 }
    );
  }

  const body = await req.json();

  const phase =
    await prisma.projectPhase.update({
      where: {
        id: phaseId,
      },
      data: {
        ...(typeof body.name === "string" && {
          name: body.name.trim(),
        }),

        ...(typeof body.description === "string" && {
          description: body.description,
        }),

        ...(typeof body.weight === "number" && {
          weight: Math.max(body.weight, 0),
        }),

        ...(typeof body.sortOrder === "number" && {
          sortOrder: body.sortOrder,
        }),
      },
    });

  return NextResponse.json(phase);
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

  const { id, phaseId } = await params;

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
    await prisma.projectPhase.findFirst({
      where: {
        id: phaseId,
        projectId: id,
      },
    });

  if (!existing) {
    return NextResponse.json(
      { error: "Phase not found" },
      { status: 404 }
    );
  }

  await prisma.projectPhase.delete({
    where: {
      id: phaseId,
    },
  });

  return NextResponse.json({
    success: true,
  });
}