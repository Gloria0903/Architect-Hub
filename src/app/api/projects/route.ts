import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Priority, ProjectStatus } from "@prisma/client";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(2),
  clientId: z.string(),
  location: z.string().min(2),
  description: z.string().optional(),
  architectId: z.string().optional(),
  supervisorId: z.string().optional(),
  startDate: z.string(),
  dueDate: z.string(),
  budget: z.number().min(0),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    include: {
      client: true,
      architect: { select: { id: true, name: true, initials: true, email: true } },
      supervisor: { select: { id: true, name: true, initials: true } },
      _count: { select: { dailyLogs: true, documents: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "SENIOR_ARCHITECT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await prisma.project.count();
  const sheetNo = `A-${String(count + 113).padStart(3, "0")}`;

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      sheetNo,
      priority: parsed.data.priority as Priority,
      startDate: new Date(parsed.data.startDate),
      dueDate: new Date(parsed.data.dueDate),
      architectId: parsed.data.architectId || null,
      supervisorId: parsed.data.supervisorId || null,
    },
    include: {
      client: true,
      architect: { select: { id: true, name: true, initials: true } },
      supervisor: { select: { id: true, name: true, initials: true } },
    },
  });

  // Notify admin
  await prisma.notification.create({
    data: {
      userId: session.user.id!,
      message: `Project "${project.name}" (${sheetNo}) created successfully`,
      type: "SUCCESS",
    },
  });

  return NextResponse.json(project, { status: 201 });
}
