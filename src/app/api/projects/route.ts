import { notifyProjectAssignment } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Priority } from "@prisma/client";
import { z } from "zod";
import { projectAccessWhere, canCreateProjects, isAdmin } from "@/lib/rbac";
import { generateProjectSheetNo } from "@/lib/project-number";
import { logActivity } from "@/lib/activity-log";

const CreateProjectSchema = z.object({
  name: z.string().min(2),
  clientId: z.string().min(1),
  location: z.string().min(2),
  description: z.string().optional(),

  // Project assignment is required
  architectId: z.string().min(1),
  supervisorId: z.string().min(1),

  startDate: z.string(),
  dueDate: z.string(),

  budget: z.number().min(0),

  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Admin-only "view archived" mode. Regular architects never get this
  // branch, same access rule as archiving/unarchiving itself.
  const wantsArchived = req.nextUrl.searchParams.get("archived") === "true";
  if (wantsArchived && !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: {
      AND: [
        projectAccessWhere(session),
        {
          archivedAt: wantsArchived ? { not: null } : null,
        },
      ],
    },

    include: {
      client: true,

      architect: {
        select: {
          id: true,
          name: true,
          initials: true,
          email: true,
        },
      },

      supervisor: {
        select: {
          id: true,
          name: true,
          initials: true,
          avatarUrl: true,
        },
      },

      _count: {
        select: {
          dailyLogs: true,
          documents: true,
          comments: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Check whether the current user is allowed
  // to create projects.
  if (!canCreateProjects(session)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  // ---------------------------------------------------------
  // Read request body
  // ---------------------------------------------------------

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate request body
  // ---------------------------------------------------------

  const parsed = CreateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate assigned architect and supervisor
  // BEFORE creating the project
  // ---------------------------------------------------------

  const [architect, supervisor] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: parsed.data.architectId,
      },

      select: {
        id: true,
        role: true,
        isActive: true,
      },
    }),

    prisma.user.findUnique({
      where: {
        id: parsed.data.supervisorId,
      },

      select: {
        id: true,
        role: true,
        isActive: true,
      },
    }),
  ]);

  // ---------------------------------------------------------
  // Validate architect
  // ---------------------------------------------------------

  if (
    !architect ||
    architect.role !== "ARCHITECT" ||
    !architect.isActive
  ) {
    return NextResponse.json(
      {
        error:
          "Selected architect is invalid or inactive",
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate supervisor
  // ---------------------------------------------------------

  if (!supervisor || !supervisor.isActive) {
    return NextResponse.json(
      {
        error:
          "Selected supervisor is invalid or inactive",
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Verify client exists
  // ---------------------------------------------------------

  const client = await prisma.client.findUnique({
    where: {
      id: parsed.data.clientId,
    },

    select: {
      id: true,
    },
  });

  if (!client) {
    return NextResponse.json(
      {
        error: "Selected client does not exist",
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate dates
  // ---------------------------------------------------------

  const startDate = new Date(parsed.data.startDate);
  const dueDate = new Date(parsed.data.dueDate);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(dueDate.getTime())
  ) {
    return NextResponse.json(
      {
        error: "Invalid project date",
      },
      { status: 400 }
    );
  }

  if (dueDate < startDate) {
    return NextResponse.json(
      {
        error:
          "Project due date cannot be before the start date",
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Generate project sheet number
  // ---------------------------------------------------------

  const sheetNo = await generateProjectSheetNo();

  // ---------------------------------------------------------
  // Create project
  // ---------------------------------------------------------

  let project;

  try {
    project = await prisma.project.create({
      data: {
        name: parsed.data.name,

        clientId: parsed.data.clientId,

        location: parsed.data.location,

        description: parsed.data.description,

        architectId: parsed.data.architectId,

        supervisorId: parsed.data.supervisorId,

        startDate,

        dueDate,

        budget: parsed.data.budget,

        priority: parsed.data.priority as Priority,

        sheetNo,
      },

      include: {
        client: true,

        architect: {
          select: {
            id: true,
            name: true,
            initials: true,
            avatarUrl: true,
          },
        },

        supervisor: {
          select: {
            id: true,
            name: true,
            initials: true,
            avatarUrl: true,
          },
        },
      },
    });
  } catch (error) {
    console.error(
      "Project creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create project. Please try again.",
      },
      { status: 500 }
    );
  }

  // ---------------------------------------------------------
// Record project creation activity
// ---------------------------------------------------------

try {
  await logActivity({
    action: "PROJECT_CREATED",
    entityType: "PROJECT",
    entityId: project.id,
    actorId: session.user.id,
    projectId: project.id,
    metadata: {
      projectName: project.name,
      sheetNo: project.sheetNo,
      architectId: project.architectId,
      supervisorId: project.supervisorId,
      clientId: project.clientId,
    },
  });
} catch (error) {
  // Activity logging failure should not make
  // an already-created project fail.
  console.error(
    "Project activity logging failed:",
    error
  );
}

  // ---------------------------------------------------------
  // Notify project creator
  // ---------------------------------------------------------

  try {
    await prisma.notification.create({
      data: {
        userId: session.user.id,

        message: `Project "${project.name}" (${sheetNo}) created successfully`,

        type: "SUCCESS",
      },
    });
  } catch (error) {
    // Notification failure should not make
    // an already-created project fail.
    console.error(
      "Project creation notification failed:",
      error
    );
  }

  // ---------------------------------------------------------
  // Prepare assignment notifications
  // ---------------------------------------------------------

  const assignees: {
    userId: string;
    role: "ARCHITECT" | "SUPERVISOR";
  }[] = [];

  if (project.architectId) {
    assignees.push({
      userId: project.architectId,
      role: "ARCHITECT",
    });
  }

  if (project.supervisorId) {
    assignees.push({
      userId: project.supervisorId,
      role: "SUPERVISOR",
    });
  }

  // ---------------------------------------------------------
  // Notify assigned architect and supervisor
  // ---------------------------------------------------------

  await Promise.all(
    assignees
      .filter(
        (assignee) =>
          assignee.userId !== session.user.id
      )
      .map(async (assignee) => {
        try {
          await notifyProjectAssignment({
            userId: assignee.userId,

            projectId: project.id,

            projectName: `${project.name} (${sheetNo})`,

            assignedRole: assignee.role,

            assignedByName:
              session.user.name ??
              "A team member",
          });
        } catch (error) {
          console.error(
            `Failed to notify ${assignee.role}:`,
            error
          );
        }
      })
  );

  // ---------------------------------------------------------
  // Return created project
  // ---------------------------------------------------------

  return NextResponse.json(
    project,
    { status: 201 }
  );
}