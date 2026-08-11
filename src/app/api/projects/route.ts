import { notifyProjectAssignment } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Priority } from "@prisma/client";
import { z } from "zod";
import { projectAccessWhere, canCreateProjects } from "@/lib/rbac";

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
    where: projectAccessWhere(session),
    include: {
      client: true,
      architect: { select: { id: true, name: true, initials: true, email: true } },
      supervisor: { select: { id: true, name: true, initials: true, avatarUrl: true } },
      _count: { select: { dailyLogs: true, documents: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canCreateProjects(session)) {
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
      architect: { select: { id: true, name: true, initials: true, avatarUrl: true } },
      supervisor: { select: { id: true, name: true, initials: true, avatarUrl: true } },
    },
  });

 // Notify admin
  await prisma.notification.create({
    data: {
      userId: session.user.id,
      message: `Project "${project.name}" (${sheetNo}) created successfully`,
      type: "SUCCESS",
    },
  });

  // Notify anyone assigned at creation time
  const assignees: { userId: string; role: "ARCHITECT" | "SUPERVISOR" }[] = [];
  if (project.architectId) assignees.push({ userId: project.architectId, role: "ARCHITECT" });
  if (project.supervisorId) assignees.push({ userId: project.supervisorId, role: "SUPERVISOR" });

  await Promise.all(
    assignees
      .filter((a) => a.userId !== session.user.id) // don't notify yourself
      .map((a) =>
        notifyProjectAssignment({
          userId: a.userId,
          projectId: project.id,
          projectName: `${project.name} (${sheetNo})`,
          assignedRole: a.role,
          assignedByName: session.user.name ?? "A team member",
        })
      )
  );

  return NextResponse.json(project, { status: 201 });
}