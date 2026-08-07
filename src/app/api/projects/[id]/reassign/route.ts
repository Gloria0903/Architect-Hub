import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canReassignProjects } from "@/lib/rbac";
import { z } from "zod";

const Schema = z.object({
  toArchitectId: z.string(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canReassignProjects(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toArchitect = await prisma.user.findUnique({ where: { id: parsed.data.toArchitectId } });
  if (!toArchitect || toArchitect.role !== "ARCHITECT") {
    return NextResponse.json({ error: "Can only assign to an architect" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { architectId: parsed.data.toArchitectId },
      include: {
        architect: { select: { id: true, name: true, initials: true } },
        client: true,
      },
    }),
    prisma.assignmentRecord.create({
      data: {
        projectId: id,
        fromArchitectId: project.architectId,
        toArchitectId: parsed.data.toArchitectId,
        reason: parsed.data.reason,
        performedById: session.user.id,
      },
    }),
    prisma.notification.create({
      data: {
        userId: parsed.data.toArchitectId,
        message: `You have been assigned to project: ${project.name} (${project.sheetNo})`,
        type: "INFO",
      },
    }),
  ]);

  return NextResponse.json(updated);
}
