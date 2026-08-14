import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { z } from "zod";
import { canAccessProject } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";

const Schema = z.object({
  projectId: z.string(),
  workCompleted: z.string().min(10),
  challenges: z.string().optional().default(""),
  pendingWork: z.string().optional().default(""),
  nextActions: z.string().optional().default(""),
  progress: z.number().min(0).max(100),
  date: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const authorId = searchParams.get("authorId");
  const dateFrom = searchParams.get("dateFrom");

  const logs = await prisma.dailyLog.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(authorId && { authorId }),
      ...(dateFrom && { date: { gte: new Date(dateFrom) } }),
      // Non-admins only see logs for projects they are the architect or supervisor on.
      ...(!isAdmin(session) && {
        project: { OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }] },
      }),
    },
    include: {
      author: { select: { id: true, name: true, initials: true, avatarUrl: true } },
      project: { select: { id: true, name: true, sheetNo: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  
  const project = await prisma.project.findUnique({
  where: { id: parsed.data.projectId },
  select: {
    id: true,
    architectId: true,
    supervisorId: true,
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
    { error: "You are not assigned to this project" },
    { status: 403 }
  );
}
  const logDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
  logDate.setHours(0, 0, 0, 0);

  // Check for duplicate log (same author, project, date)
  const existing = await prisma.dailyLog.findUnique({
    where: {
      projectId_authorId_date: {
        projectId: parsed.data.projectId,
        authorId: session.user.id,
        date: logDate,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "A log for this project has already been submitted today" }, { status: 409 });
  }

  const [log] = await prisma.$transaction([
    prisma.dailyLog.create({
      data: {
        projectId: parsed.data.projectId,
        authorId: session.user.id,
        date: logDate,
        workCompleted: parsed.data.workCompleted,
        challenges: parsed.data.challenges,
        pendingWork: parsed.data.pendingWork,
        nextActions: parsed.data.nextActions,
        progress: parsed.data.progress,
      },
      include: {
        author: { select: { id: true, name: true, initials: true, avatarUrl: true } },
        project: { select: { id: true, name: true, sheetNo: true } },
      },
    }),
    prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { progress: parsed.data.progress },
    }),
  ]);

  return NextResponse.json(log, { status: 201 });
}
