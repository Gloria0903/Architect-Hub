import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject, isAdmin } from "@/lib/rbac";
import { z } from "zod";
import { calculateProjectProgress } from "@/lib/project-progress";

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),

  description: z.string().optional(),

  status: z
    .enum([
      "ON_TRACK",
      "AT_RISK",
      "DELAYED",
      "COMPLETED",
    ])
    .optional(),

  priority: z
    .enum(["LOW", "MEDIUM", "HIGH"])
    .optional(),

  location: z.string().min(2).optional(),

  startDate: z.string().optional(),

  dueDate: z.string().optional(),

  completionDate: z
    .string()
    .nullable()
    .optional(),

  budget: z.number().min(0).optional(),

  invoiced: z.number().min(0).optional(),
});

/*
|--------------------------------------------------------------------------
| GET PROJECT
|--------------------------------------------------------------------------
*/

export async function GET(
  _: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
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
    where: {
      id,
    },

    include: {
      client: true,

      architect: {
        select: {
          id: true,
          name: true,
          initials: true,
          email: true,
          phone: true,
        },
      },

      tasks: {
  select: {
    id: true,
    title: true,
    weight: true,
    completion: true,
    status: true,
  },
},

milestones: {
  select: {
    id: true,
    title: true,
    weight: true,
    status: true,
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

      dailyLogs: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              initials: true,
              avatarUrl: true,
            },
          },
        },

        orderBy: {
          date: "desc",
        },
      },

      documents: {
        orderBy: {
          uploadedAt: "desc",
        },
      },

      comments: {
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      },

      payments: {
        include: {
          recordedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: {
          date: "desc",
        },
      },

      assignmentHistory: {
        include: {
          fromArchitect: {
            select: {
              id: true,
              name: true,
            },
          },

          toArchitect: {
            select: {
              id: true,
              name: true,
            },
          },

          performedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: {
          date: "desc",
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

  /*
   * Archived projects should not be accessible
   * through the normal project route.
   */
  if (project.archivedAt) {
    return NextResponse.json(
      { error: "Project has been archived" },
      { status: 404 }
    );
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const calculatedProgress =
  calculateProjectProgress({
    tasks: project.tasks,
    milestones: project.milestones,
  });

return NextResponse.json({
  ...project,
  progress: calculatedProgress,
});
}

/*
|--------------------------------------------------------------------------
| UPDATE PROJECT
|--------------------------------------------------------------------------
*/

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const existing = await prisma.project.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  if (existing.archivedAt) {
    return NextResponse.json(
      { error: "Archived projects cannot be modified" },
      { status: 400 }
    );
  }

  if (!canAccessProject(session, existing)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  /*
   * Only administrators may edit financial figures.
   */
  if (
    (data.budget !== undefined ||
      data.invoiced !== undefined) &&
    !isAdmin(session)
  ) {
    return NextResponse.json(
      {
        error:
          "Only administrators can modify financial figures",
      },
      { status: 403 }
    );
  }

  /*
   * Validate dates if supplied.
   */

  let startDate: Date | undefined;
  let dueDate: Date | undefined;
  let completionDate: Date | null | undefined;

  if (data.startDate !== undefined) {
    startDate = new Date(data.startDate);

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid start date" },
        { status: 400 }
      );
    }
  }

  if (data.dueDate !== undefined) {
    dueDate = new Date(data.dueDate);

    if (Number.isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid due date" },
        { status: 400 }
      );
    }
  }

  if (data.completionDate !== undefined) {
    completionDate = data.completionDate
      ? new Date(data.completionDate)
      : null;

    if (
      completionDate &&
      Number.isNaN(completionDate.getTime())
    ) {
      return NextResponse.json(
        { error: "Invalid completion date" },
        { status: 400 }
      );
    }
  }

  /*
   * Validate that the due date is not before
   * the start date.
   */

  const effectiveStartDate =
    startDate ?? existing.startDate;

  const effectiveDueDate =
    dueDate ?? existing.dueDate;

  if (
    effectiveStartDate &&
    effectiveDueDate &&
    effectiveDueDate < effectiveStartDate
  ) {
    return NextResponse.json(
      {
        error:
          "Due date cannot be before the project start date",
      },
      { status: 400 }
    );
  }

  /*
   * Update project.
   */

  const project = await prisma.project.update({
    where: {
      id,
    },

    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.description !== undefined && {
        description: data.description,
      }),

      ...(data.status !== undefined && {
        status: data.status,
      }),

      ...(data.priority !== undefined && {
        priority: data.priority,
      }),

      ...(data.location !== undefined && {
        location: data.location,
      }),

      ...(startDate !== undefined && {
        startDate,
      }),

      ...(dueDate !== undefined && {
        dueDate,
      }),

      ...(data.completionDate !== undefined && {
        completionDate,
      }),

      ...(data.budget !== undefined && {
        budget: data.budget,
      }),

      ...(data.invoiced !== undefined && {
        invoiced: data.invoiced,
      }),
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

  return NextResponse.json(project);
}

/*
|--------------------------------------------------------------------------
| DELETE / ARCHIVE PROJECT
|--------------------------------------------------------------------------
|
| IMPORTANT:
| We do NOT physically delete projects.
| Projects are archived so that project history,
| documents, logs, payments and audit information
| remain available.
|
|--------------------------------------------------------------------------
*/

export async function DELETE(
  _: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  /*
   * Only administrators can archive projects.
   */
  if (!isAdmin(session)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const existing = await prisma.project.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  /*
   * Prevent archiving the same project twice.
   */
  if (existing.archivedAt) {
    return NextResponse.json(
      {
        error: "Project is already archived",
      },
      { status: 400 }
    );
  }

  /*
   * Soft delete / archive.
   */
  const project = await prisma.project.update({
    where: {
      id,
    },

    data: {
      archivedAt: new Date(),
    },

    select: {
      id: true,
      name: true,
      sheetNo: true,
      archivedAt: true,
    },
  });

  /*
   * Create a notification for the administrator
   * who performed the archive action.
   */
  try {
    await prisma.notification.create({
      data: {
        userId: session.user.id,

        message: `Project "${project.name}" (${project.sheetNo}) has been archived`,

        type: "SUCCESS",
      },
    });
  } catch (error) {
    console.error(
      "Archive notification failed:",
      error
    );
  }

  return NextResponse.json({
    success: true,
    archived: true,
    project,
  });
}