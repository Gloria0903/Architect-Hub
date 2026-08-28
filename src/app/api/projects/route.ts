import { notifyProjectAssignment } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Priority } from "@prisma/client";
import { z } from "zod";
import {
  projectAccessWhere,
  canCreateProjects,
  isAdmin,
} from "@/lib/rbac";
import { generateProjectSheetNo } from "@/lib/project-number";
import { logActivity } from "@/lib/activity-log";
import { calculateProjectProgress } from "@/lib/project-progress";

const CreateProjectSchema = z.object({
  name: z.string().min(2),
  clientId: z.string().min(1),
  location: z.string().min(2),
  description: z.string().optional(),

  // Assignment is optional at creation -- lets an admin/senior architect
  // stand up a project and assign staff to it later, rather than being
  // forced to pick someone before the project can even exist.
  architectId: z.string().min(1).optional(),
  supervisorId: z.string().min(1).optional(),

  startDate: z.string(),
  dueDate: z.string(),

  budget: z.number().min(0),

  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

/**
 * GET /api/projects
 *
 * Returns projects accessible to the authenticated user.
 *
 * IMPORTANT SECURITY RULES:
 *
 * ADMIN:
 * - Can access financial project information.
 * - Can view archived projects.
 *
 * ARCHITECT:
 * - Can only access projects allowed by projectAccessWhere().
 * - NEVER receives budget, invoiced, or paid.
 * - NEVER receives client passwordHash.
 *
 * FINANCIAL SOURCE OF TRUTH:
 *
 * - budget    = Project.budget
 * - invoiced  = Project.invoiced
 * - paid      = SUM(Payment.amount)
 *
 * We deliberately calculate `paid` from Payment records instead
 * of trusting Project.paid because individual payment records are
 * the authoritative transaction history.
 */
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const admin = isAdmin(session);

  // Admin-only archived project mode.
  const wantsArchived =
    req.nextUrl.searchParams.get("archived") === "true";

  if (wantsArchived && !admin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        AND: [
          projectAccessWhere(session),
          {
            archivedAt: wantsArchived
              ? { not: null }
              : null,
          },
        ],
      },

      /*
       * SECURITY:
       *
       * We deliberately use `select` instead of unrestricted
       * `include` so sensitive fields cannot accidentally leak.
       *
       * Deliberately FLAT here -- no nested relation selects
       * (client, architect, supervisor, payments, tasks, milestones,
       * _count) like this used to have. On HostPinnacle specifically,
       * queries with nested relation selects were failing with
       * "Connection terminated unexpectedly" even with
       * neonConfig.poolQueryViaFetch enabled -- that setting only
       * reliably covers genuinely simple, flat, single-table queries.
       * Every one of those is fetched separately below instead, as
       * batched flat queries (one findMany with an `in` filter per
       * relation, not one query per project), then stitched back
       * together into the exact same response shape as before.
       */
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

        archivedAt: true,
        archiveReason: true,
        archivedById: true,
        restoredAt: true,
        restoredById: true,

        createdAt: true,
        updatedAt: true,

        /*
         * FINANCIAL DATA
         *
         * Only ADMIN receives financial information.
         *
         * `paid` is intentionally NOT selected from Project.
         * Instead, actual paid amount is calculated below from
         * the separately-fetched Payment records.
         */
        ...(admin
          ? {
              budget: true,
              invoiced: true,
            }
          : {}),
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const projectIds = projects.map((p) => p.id);

    const clientIds = [...new Set(projects.map((p) => p.clientId))];
    const userIds = [
      ...new Set(
        projects
          .flatMap((p) => [p.architectId, p.supervisorId])
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const [clients, users, payments, tasks, milestones, dailyLogCounts, documentCounts, commentCounts] =
      await Promise.all([
        prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: {
            id: true,
            name: true,
            contactPerson: true,
            email: true,
            phone: true,
            address: true,
            portalEnabled: true,
            createdAt: true,
            updatedAt: true,
            lastPortalLoginAt: true,
          },
        }),
        prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, initials: true, email: true, avatarUrl: true },
        }),
        admin
          ? prisma.payment.findMany({
              where: { projectId: { in: projectIds } },
              select: { projectId: true, amount: true },
            })
          : Promise.resolve([]),
        prisma.projectTask.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true, weight: true, completion: true, status: true },
        }),
        prisma.projectMilestone.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true, weight: true, status: true },
        }),
        prisma.dailyLog.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true },
        }),
        prisma.document.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true },
        }),
        prisma.clientComment.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true },
        }),
      ]);

    const clientById = new Map(clients.map((c) => [c.id, c]));
    const userById = new Map(users.map((u) => [u.id, u]));

    function groupByProjectId<T extends { projectId: string }>(rows: T[]) {
      const map = new Map<string, T[]>();
      for (const row of rows) {
        const list = map.get(row.projectId) ?? [];
        list.push(row);
        map.set(row.projectId, list);
      }
      return map;
    }

    const paymentsByProject = groupByProjectId(payments);
    const tasksByProject = groupByProjectId(tasks);
    const milestonesByProject = groupByProjectId(milestones);
    const dailyLogCountByProject = groupByProjectId(dailyLogCounts);
    const documentCountByProject = groupByProjectId(documentCounts);
    const commentCountByProject = groupByProjectId(commentCounts);

    /*
     * Calculate project progress and financial totals.
     *
     * IMPORTANT:
     *
     * We do NOT use Project.paid here.
     *
     * Actual paid amount is calculated from:
     *
     *     SUM(Payment.amount)
     *
     * for the project.
     */
    const projectsWithCalculatedData = projects.map(
      (project) => {
        const projectTasks = tasksByProject.get(project.id) ?? [];
        const projectMilestones = milestonesByProject.get(project.id) ?? [];

        const calculatedProgress =
          calculateProjectProgress({
            tasks: projectTasks,
            milestones: projectMilestones,
          });

        /*
         * Calculate actual payments received.
         *
         * Number(...) protects against Prisma Decimal values
         * being returned as Decimal/string-like values.
         */
        const actualPaid = admin
          ? (paymentsByProject.get(project.id) ?? []).reduce(
              (total, payment) =>
                total + Number(payment.amount || 0),
              0
            )
          : undefined;

        /*
         * Financial calculations.
         *
         * Outstanding is based on INVOICED amount,
         * not the total project budget.
         *
         * Example:
         *
         * Budget   = 5,000,000
         * Invoiced = 2,000,000
         * Paid     = 1,200,000
         *
         * Outstanding = 800,000
         * Unbilled    = 3,000,000
         */
        const financialData = admin
          ? {
              paid: actualPaid ?? 0,

              outstanding: Math.max(
                Number(project.invoiced || 0) -
                  (actualPaid ?? 0),
                0
              ),

              unbilled: Math.max(
                Number(project.budget || 0) -
                  Number(project.invoiced || 0),
                0
              ),

              remaining: Math.max(
                Number(project.budget || 0) -
                  (actualPaid ?? 0),
                0
              ),
            }
          : {};

        return {
          ...project,

          client: clientById.get(project.clientId) ?? null,
          architect: project.architectId ? (userById.get(project.architectId) ?? null) : null,
          supervisor: project.supervisorId ? (userById.get(project.supervisorId) ?? null) : null,

          _count: {
            dailyLogs: (dailyLogCountByProject.get(project.id) ?? []).length,
            documents: (documentCountByProject.get(project.id) ?? []).length,
            comments: (commentCountByProject.get(project.id) ?? []).length,
          },

          progress: calculatedProgress,

          ...financialData,
        };
      }
    );

    return NextResponse.json(
      projectsWithCalculatedData
    );
  } catch (error) {
    console.error(
      "Failed to fetch projects:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load projects. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 *
 * Project creation remains restricted to users allowed by
 * canCreateProjects().
 */
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
      {
        error:
          "Invalid JSON request body",
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate request body
  // ---------------------------------------------------------

  const parsed =
    CreateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate assigned architect and supervisor (if provided)
  // BEFORE creating the project
  // ---------------------------------------------------------

  const [architect, supervisor] =
    await Promise.all([
      parsed.data.architectId
        ? prisma.user.findUnique({
            where: {
              id: parsed.data.architectId,
            },

            select: {
              id: true,
              role: true,
              isActive: true,
            },
          })
        : Promise.resolve(null),

      parsed.data.supervisorId
        ? prisma.user.findUnique({
            where: {
              id: parsed.data.supervisorId,
            },

            select: {
              id: true,
              role: true,
              isActive: true,
            },
          })
        : Promise.resolve(null),
    ]);

  // ---------------------------------------------------------
  // Validate architect (only if one was actually selected --
  // unassigned is allowed, invalid/inactive is not)
  // ---------------------------------------------------------

  if (
    parsed.data.architectId &&
    (!architect ||
      architect.role !== "ARCHITECT" ||
      !architect.isActive)
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
  // Validate supervisor (only if one was actually selected)
  // ---------------------------------------------------------

  if (
    parsed.data.supervisorId &&
    (!supervisor || !supervisor.isActive)
  ) {
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

  const client =
    await prisma.client.findUnique({
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
        error:
          "Selected client does not exist",
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------
  // Validate dates
  // ---------------------------------------------------------

  const startDate =
    new Date(parsed.data.startDate);

  const dueDate =
    new Date(parsed.data.dueDate);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(dueDate.getTime())
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid project date",
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

  const sheetNo =
    await generateProjectSheetNo();

  // ---------------------------------------------------------
  // Create project
  // ---------------------------------------------------------
  //
  // Deliberately a FLAT create + select here -- no nested relation
  // selects (client:{select:{...}}, architect:{...}, supervisor:{...})
  // like this used to have. On HostPinnacle specifically, queries with
  // nested relation selects were failing with "Connection terminated
  // unexpectedly" even with neonConfig.poolQueryViaFetch enabled --
  // that setting only reliably covers genuinely simple, flat,
  // single-table queries. The nested client/architect/supervisor data
  // is fetched separately below instead, as three more flat queries,
  // then assembled into the exact same response shape the frontend
  // already expects. Slightly more round trips, but every one of them
  // is simple enough to actually succeed on this host.

  let project;

  try {
    project =
      await prisma.project.create({
        data: {
          name:
            parsed.data.name,

          clientId:
            parsed.data.clientId,

          location:
            parsed.data.location,

          description:
            parsed.data.description,

          architectId:
            parsed.data.architectId,

          supervisorId:
            parsed.data.supervisorId,

          startDate,

          dueDate,

          budget:
            parsed.data.budget,

          priority:
            parsed.data.priority as Priority,

          sheetNo,
        },

        /*
         * Explicitly select safe fields from the created
         * project instead of using client: true.
         */
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
        projectName:
          project.name,

        sheetNo:
          project.sheetNo,

        architectId:
          project.architectId,

        supervisorId:
          project.supervisorId,

        clientId:
          project.clientId,
      },
    });
  } catch (error) {
    /*
     * Activity logging failure should not make an already
     * created project fail.
     */
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
        userId:
          session.user.id,

        message:
          `Project "${project.name}" (${sheetNo}) created successfully`,

        type:
          "SUCCESS",
      },
    });
  } catch (error) {
    /*
     * Notification failure should not make an already
     * created project fail.
     */
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
    role:
      | "ARCHITECT"
      | "SUPERVISOR";
  }[] = [];

  if (project.architectId) {
    assignees.push({
      userId:
        project.architectId,

      role:
        "ARCHITECT",
    });
  }

  if (project.supervisorId) {
    assignees.push({
      userId:
        project.supervisorId,

      role:
        "SUPERVISOR",
    });
  }

  // ---------------------------------------------------------
  // Notify assigned architect and supervisor
  // ---------------------------------------------------------

  await Promise.all(
    assignees
      .filter(
        (assignee) =>
          assignee.userId !==
          session.user.id
      )
      .map(async (assignee) => {
        try {
          await notifyProjectAssignment({
            userId:
              assignee.userId,

            projectId:
              project.id,

            projectName:
              `${project.name} (${sheetNo})`,

            assignedRole:
              assignee.role,

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
  //
  // Same three flat, single-table lookups pattern as the create call
  // above avoided doing as one nested-select query. Run in parallel
  // since they're independent of each other.

  const [responseClient, responseArchitect, responseSupervisor] = await Promise.all([
    prisma.client.findUnique({
      where: { id: project.clientId },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
        portalEnabled: true,
        createdAt: true,
        updatedAt: true,
        lastPortalLoginAt: true,
      },
    }),
    project.architectId
      ? prisma.user.findUnique({
          where: { id: project.architectId },
          select: { id: true, name: true, initials: true, avatarUrl: true },
        })
      : Promise.resolve(null),
    project.supervisorId
      ? prisma.user.findUnique({
          where: { id: project.supervisorId },
          select: { id: true, name: true, initials: true, avatarUrl: true },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json(
    { ...project, client: responseClient, architect: responseArchitect, supervisor: responseSupervisor },
    {
      status: 201,
    }
  );
}