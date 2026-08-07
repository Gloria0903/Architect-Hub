import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject, isAdmin } from "@/lib/rbac";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  location: z.string().min(2).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  budget: z.number().min(0).optional(),
  invoiced: z.number().min(0).optional(),
});

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
  if (!canAccessProject(session, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessProject(session, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  // Only admins / senior architects may edit budget & invoiced figures.
  if ((data.budget !== undefined || data.invoiced !== undefined) && session.user.role === "ARCHITECT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status && { status: data.status }),
      ...(data.progress !== undefined && { progress: data.progress }),
      ...(data.priority && { priority: data.priority }),
      ...(data.location && { location: data.location }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      ...(data.budget !== undefined && { budget: data.budget }),
      ...(data.invoiced !== undefined && { invoiced: data.invoiced }),
    },
    include: {
      client: true,
      architect: { select: { id: true, name: true, initials: true } },
      supervisor: { select: { id: true, name: true, initials: true } },
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
