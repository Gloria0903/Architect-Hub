import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      architect: { select: { id: true, name: true, initials: true, email: true, phone: true } },
      supervisor: { select: { id: true, name: true, initials: true } },
      dailyLogs: {
        include: { author: { select: { id: true, name: true, initials: true } } },
        orderBy: { date: "desc" },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      comments: {
        include: { client: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      payments: {
        include: { recordedBy: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
      assignmentHistory: {
        include: {
          fromArchitect: { select: { id: true, name: true } },
          toArchitect: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status && { status: body.status }),
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.priority && { priority: body.priority }),
      ...(body.dueDate && { dueDate: new Date(body.dueDate) }),
      ...(body.budget !== undefined && { budget: body.budget }),
      ...(body.invoiced !== undefined && { invoiced: body.invoiced }),
    },
    include: {
      client: true,
      architect: { select: { id: true, name: true, initials: true } },
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
