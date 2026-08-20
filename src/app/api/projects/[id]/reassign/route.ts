import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { notifyProjectAssignment } from "@/lib/notifications";
import { z } from "zod";

const ReassignSchema = z.object({
  toArchitectId: z
    .string()
    .min(1, "Architect is required"),

  reason: z
    .string()
    .trim()
    .max(1000, "Reason cannot exceed 1000 characters")
    .optional(),
});

/*
|--------------------------------------------------------------------------
| POST /api/projects/[id]/reassign
|--------------------------------------------------------------------------
|
| SECURITY RULE:
|
| ONLY ADMINISTRATORS MAY REASSIGN / TAKE OVER PROJECTS.
|
| Architects must NEVER be able to:
|
| - Reassign a project
| - Take over a project
| - Change the assigned architect
|
| This authorization is enforced server-side and therefore cannot
| be bypassed by manipulating the frontend.
|
|--------------------------------------------------------------------------
*/

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  /*
   * ---------------------------------------------------------
   * Authentication
   * ---------------------------------------------------------
   */

  const session = await auth();

  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * ADMIN-ONLY AUTHORIZATION
   * ---------------------------------------------------------
   *
   * Do not rely on the frontend to hide the Take Over button.
   *
   * Even if an architect manually sends:
   *
   * POST /api/projects/:id/reassign
   *
   * the server must reject the request.
   */

  if (!isAdmin(session)) {
    return NextResponse.json(
      {
        error:
          "Only administrators can reassign projects",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Project ID
   * ---------------------------------------------------------
   */

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        error: "Project ID is required",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Parse request body safely
   * ---------------------------------------------------------
   */

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON request body",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Validate request body
   * ---------------------------------------------------------
   */

  const parsed = ReassignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const {
    toArchitectId,
    reason,
  } = parsed.data;

  /*
   * ---------------------------------------------------------
   * Load project
   * ---------------------------------------------------------
   */

  const project = await prisma.project.findUnique({
    where: {
      id,
    },

    select: {
      id: true,
      name: true,
      sheetNo: true,
      architectId: true,
      archivedAt: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      {
        error: "Project not found",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Archived projects cannot be reassigned
   * ---------------------------------------------------------
   */

  if (project.archivedAt) {
    return NextResponse.json(
      {
        error:
          "Archived projects cannot be reassigned",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Prevent assigning to the current architect
   * ---------------------------------------------------------
   */

  if (project.architectId === toArchitectId) {
    return NextResponse.json(
      {
        error:
          "Project is already assigned to this architect",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Validate target architect
   * ---------------------------------------------------------
   *
   * The target must:
   *
   * - Exist
   * - Have ARCHITECT role
   * - Be active
   */

  const toArchitect =
    await prisma.user.findUnique({
      where: {
        id: toArchitectId,
      },

      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        initials: true,
        avatarUrl: true,
      },
    });

  if (!toArchitect) {
    return NextResponse.json(
      {
        error: "Selected architect does not exist",
      },
      {
        status: 400,
      }
    );
  }

  if (toArchitect.role !== "ARCHITECT") {
    return NextResponse.json(
      {
        error:
          "Projects can only be assigned to architects",
      },
      {
        status: 400,
      }
    );
  }

  if (!toArchitect.isActive) {
    return NextResponse.json(
      {
        error:
          "Cannot assign a project to an inactive architect",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Perform reassignment atomically
   * ---------------------------------------------------------
   *
   * Both operations must succeed:
   *
   * 1. Change project architect
   * 2. Create assignment history
   *
   * If either fails, the transaction rolls back.
   */

  let updatedProject;

  try {
    updatedProject =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Update project.
           */
          const updated =
            await tx.project.update({
              where: {
                id,
              },

              data: {
                architectId:
                  toArchitectId,
              },

              select: {
                id: true,
                name: true,
                sheetNo: true,
                location: true,
                description: true,
                status: true,
                priority: true,
                startDate: true,
                dueDate: true,
                completionDate: true,
                clientId: true,
                architectId: true,
                supervisorId: true,
                createdAt: true,
                updatedAt: true,

                /*
                 * Safe client fields only.
                 *
                 * NEVER use client: true.
                 */
                client: {
                  select: {
                    id: true,
                    name: true,
                    contactPerson: true,
                    email: true,
                    phone: true,
                    address: true,
                    portalEnabled: true,
                  },
                },

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

          /*
           * Record assignment history.
           */
          await tx.assignmentRecord.create({
            data: {
              projectId: id,

              fromArchitectId:
                project.architectId,

              toArchitectId:
                toArchitectId,

              reason:
                reason || null,

              performedById:
                session.user.id,
            },
          });

          return updated;
        }
      );
  } catch (error) {
    console.error(
      "Project reassignment failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to reassign project. Please try again.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * Notify new architect
   * ---------------------------------------------------------
   *
   * Notification failure must not undo the successful
   * reassignment.
   */

  try {
    await notifyProjectAssignment({
      userId: toArchitectId,

      projectId: id,

      projectName:
        `${project.name} (${project.sheetNo})`,

      assignedRole: "ARCHITECT",

      assignedByName:
        session.user.name ??
        "An administrator",
    });
  } catch (error) {
    console.error(
      "Project reassignment notification failed:",
      error
    );
  }

  /*
   * ---------------------------------------------------------
   * Return safe response
   * ---------------------------------------------------------
   */

  return NextResponse.json({
    success: true,

    message:
      "Project reassigned successfully",

    project: updatedProject,
  });
}