import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject, isAdmin } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { z } from "zod";
import { calculateProjectProgress } from "@/lib/project-progress";

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

const UpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),

    description: z
      .string()
      .trim()
      .max(5000)
      .optional(),

    status: z
      .enum([
        "ON_TRACK",
        "AT_RISK",
        "DELAYED",
        "COMPLETED",
      ])
      .optional(),

    priority: z
      .enum([
        "LOW",
        "MEDIUM",
        "HIGH",
      ])
      .optional(),

    location: z
      .string()
      .trim()
      .min(2)
      .max(500)
      .optional(),

    startDate: z.string().optional(),

    dueDate: z.string().optional(),

    completionDate: z
      .string()
      .nullable()
      .optional(),

    /*
     * Financial fields can only be changed by administrators.
     *
     * paid is intentionally NOT accepted here.
     *
     * Paid is calculated from Payment records and therefore cannot
     * be manually overwritten through the project endpoint.
     */
    budget: z
      .number()
      .finite()
      .min(0)
      .optional(),

    invoiced: z
      .number()
      .finite()
      .min(0)
      .optional(),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

/**
 * Calculate authoritative project financial information.
 *
 * IMPORTANT:
 *
 * Project.paid is NOT treated as the source of truth.
 * Payment records are the source of truth.
 */
async function getProjectFinance(projectId: string) {
  const paymentAggregate =
    await prisma.payment.aggregate({
      where: {
        projectId,
      },
      _sum: {
        amount: true,
      },
    });

  const paid = Number(
    paymentAggregate._sum.amount ?? 0
  );

  return paid;
}

/**
 * Return normalized finance values.
 */
function buildFinance(
  budget: number,
  invoiced: number,
  paid: number
) {
  const normalizedBudget = Math.max(
    0,
    Number(budget || 0)
  );

  const normalizedInvoiced = Math.max(
    0,
    Number(invoiced || 0)
  );

  const normalizedPaid = Math.max(
    0,
    Number(paid || 0)
  );

  return {
    budget: normalizedBudget,
    invoiced: normalizedInvoiced,
    paid: normalizedPaid,

    /*
     * Amount invoiced but not yet paid.
     */
    outstanding: Math.max(
      0,
      normalizedInvoiced -
        normalizedPaid
    ),

    /*
     * Amount of the budget that has not yet been invoiced.
     */
    uninvoiced: Math.max(
      0,
      normalizedBudget -
        normalizedInvoiced
    ),

    /*
     * Amount remaining in the budget after payments.
     */
    remainingBudget: Math.max(
      0,
      normalizedBudget -
        normalizedPaid
    ),
  };
}

/*
|--------------------------------------------------------------------------
| GET PROJECT
|--------------------------------------------------------------------------
|
| ADMIN:
| - Can access authorized projects.
| - Receives financial information.
| - Receives payment records.
|
| ARCHITECT / SUPERVISOR:
| - Can only access authorized projects.
| - Does not receive financial information.
| - Does not receive payment records.
|
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
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const { id } = await params;

  if (!id || id.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Invalid project ID",
      },
      {
        status: 400,
      }
    );
  }

  const admin = isAdmin(session);

  try {
    /*
     * ----------------------------------------------------------------------
     * FETCH PROJECT
     * ----------------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We do NOT request tasks or milestones here because the Prisma schema
     * does not define them directly on Project.
     *
     * Project -> ProjectPhase -> ProjectTask / ProjectMilestone
     *
     * Tasks and milestones are therefore fetched separately below.
     */

    const project =
      await prisma.project.findUnique({
        where: {
          id,
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

          archivedAt: true,
          archiveReason: true,
          archivedById: true,

          restoredAt: true,
          restoredById: true,

          createdAt: true,
          updatedAt: true,

          /*
           * Keep stored financial values available internally.
           *
           * The response will use the authoritative payment aggregate
           * rather than project.paid.
           */
          ...(admin
            ? {
                budget: true,
                invoiced: true,
              }
            : {}),
        },
      });

    /*
     * ----------------------------------------------------------------------
     * PROJECT EXISTENCE
     * ----------------------------------------------------------------------
     */

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
     * ----------------------------------------------------------------------
     * ARCHIVED PROJECT PROTECTION
     * ----------------------------------------------------------------------
     */

    if (project.archivedAt) {
      return NextResponse.json(
        {
          error: "Project has been archived",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ----------------------------------------------------------------------
     * PROJECT ACCESS CONTROL
     * ----------------------------------------------------------------------
     */

    if (!canAccessProject(session, project)) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ----------------------------------------------------------------------
     * FETCH RELATED DATA -- flat, batched queries instead of nested
     * relation selects
     * ----------------------------------------------------------------------
     *
     * The single combined query above used to select client, architect,
     * supervisor, dailyLogs+author, documents, comments+client,
     * payments+recordedBy, and assignmentHistory+3 user relations all
     * in one nested query. On this app's hosting (HostPinnacle + Neon
     * over WebSocket), queries involving relation joins fail with
     * "Connection terminated unexpectedly" -- this is almost certainly
     * why the project detail page was the most broken page in the app,
     * since it's also the most relation-heavy query. Every one of
     * those relations is fetched here instead as its own flat,
     * single-table query, then stitched into the exact same response
     * shape further down.
     */

    const [
      client,
      architect,
      supervisor,
      dailyLogsRaw,
      documents,
      commentsRaw,
      paymentsRaw,
      assignmentHistoryRaw,
    ] = await Promise.all([
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
            select: { id: true, name: true, initials: true, email: true, phone: true, avatarUrl: true },
          })
        : Promise.resolve(null),
      project.supervisorId
        ? prisma.user.findUnique({
            where: { id: project.supervisorId },
            select: { id: true, name: true, initials: true, avatarUrl: true },
          })
        : Promise.resolve(null),
      prisma.dailyLog.findMany({
        where: { projectId: id },
        select: {
          id: true,
          date: true,
          workCompleted: true,
          challenges: true,
          pendingWork: true,
          nextActions: true,
          progress: true,
          submittedAt: true,
          authorId: true,
        },
        orderBy: { date: "desc" },
      }),
      prisma.document.findMany({
        where: { projectId: id, deletedAt: null, isLatest: true },
        select: {
          id: true,
          name: true,
          fileUrl: true,
          fileSize: true,
          mimeType: true,
          version: true,
          uploadedAt: true,
          uploadedById: true,
          category: true,
          isLatest: true,
          clientVisible: true,
          parentId: true,
        },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.clientComment.findMany({
        where: { projectId: id },
        select: {
          id: true,
          content: true,
          type: true,
          author: true,
          createdAt: true,
          resolvedAt: true,
          projectId: true,
          clientId: true,
          viaPortal: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      admin
        ? prisma.payment.findMany({
            where: { projectId: id },
            select: {
              id: true,
              amount: true,
              date: true,
              reference: true,
              note: true,
              createdAt: true,
              projectId: true,
              recordedById: true,
            },
            orderBy: { date: "desc" },
          })
        : Promise.resolve([]),
      prisma.assignmentRecord.findMany({
        where: { projectId: id },
        select: {
          id: true,
          date: true,
          reason: true,
          fromArchitectId: true,
          toArchitectId: true,
          performedById: true,
        },
        orderBy: { date: "desc" },
      }),
    ]);

    /*
     * Second round: batch-fetch every user/client referenced by the
     * above, deduplicated across all of them into as few queries as
     * possible.
     */
    const dailyLogAuthorIds = dailyLogsRaw.map((l) => l.authorId);
    const commentClientIds = commentsRaw.map((c) => c.clientId);
    const paymentRecorderIds = paymentsRaw.map((p) => p.recordedById);
    const assignmentUserIds = assignmentHistoryRaw.flatMap((a) =>
      [a.fromArchitectId, a.performedById, a.toArchitectId].filter(
        (v): v is string => Boolean(v)
      )
    );

    const allUserIds = [
      ...new Set([...dailyLogAuthorIds, ...paymentRecorderIds, ...assignmentUserIds]),
    ];
    const allClientIds = [...new Set(commentClientIds)];

    const [relatedUsers, relatedClients] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, initials: true, avatarUrl: true },
      }),
      prisma.client.findMany({
        where: { id: { in: allClientIds } },
        select: { id: true, name: true },
      }),
    ]);

    const userById = new Map(relatedUsers.map((u) => [u.id, u]));
    const clientById = new Map(relatedClients.map((c) => [c.id, c]));

    const dailyLogs = dailyLogsRaw.map((log) => ({
      ...log,
      author: userById.get(log.authorId) ?? null,
    }));

    const comments = commentsRaw.map((comment) => ({
      ...comment,
      client: clientById.get(comment.clientId) ?? null,
    }));

    const payments = paymentsRaw.map((payment) => ({
      ...payment,
      recordedBy: userById.get(payment.recordedById) ?? null,
    }));

    const assignmentHistory = assignmentHistoryRaw.map((record) => ({
      ...record,
      fromArchitect: record.fromArchitectId ? (userById.get(record.fromArchitectId) ?? null) : null,
      toArchitect: userById.get(record.toArchitectId) ?? null,
      performedBy: userById.get(record.performedById) ?? null,
    }));

    /*
     * ----------------------------------------------------------------------
     * FETCH TASKS
     * ----------------------------------------------------------------------
     *
     * ProjectTask has projectId directly.
     */

    const tasks =
      await prisma.projectTask.findMany({
        where: {
          projectId: id,
        },

        select: {
          id: true,
          title: true,
          weight: true,
          completion: true,
          status: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    /*
     * ----------------------------------------------------------------------
     * FETCH MILESTONES
     * ----------------------------------------------------------------------
     */

    const milestones =
      await prisma.projectMilestone.findMany({
        where: {
          projectId: id,
        },

        select: {
          id: true,
          title: true,
          weight: true,
          status: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    /*
     * ----------------------------------------------------------------------
     * DYNAMIC PROJECT PROGRESS
     * ----------------------------------------------------------------------
     */

    const calculatedProgress =
      calculateProjectProgress({
        tasks,
        milestones,
      });

    /*
     * ----------------------------------------------------------------------
     * AUTHORITATIVE FINANCIAL DATA
     * ----------------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * paid is calculated from Payment records.
     *
     * We deliberately do NOT use project.paid here.
     */

    if (admin) {
      const paid =
        await getProjectFinance(id);

      const finance =
        buildFinance(
          Number(project.budget ?? 0),
          Number(project.invoiced ?? 0),
          paid
        );

      return NextResponse.json({
        ...project,

        /*
         * Keep the calculated project progress.
         */
        progress: calculatedProgress,

        /*
         * Return authoritative financial values.
         */
        budget: finance.budget,
        invoiced: finance.invoiced,
        paid: finance.paid,
        outstanding:
          finance.outstanding,
        uninvoiced:
          finance.uninvoiced,
        remainingBudget:
          finance.remainingBudget,

        client,
        architect,
        supervisor,
        dailyLogs,
        documents,
        comments,
        payments,
        assignmentHistory,

        tasks,
        milestones,
      });
    }

    /*
     * ----------------------------------------------------------------------
     * NON-ADMIN RESPONSE
     * ----------------------------------------------------------------------
     *
     * Financial fields are deliberately omitted.
     */

    return NextResponse.json({
      ...project,
      progress: calculatedProgress,
      client,
      architect,
      supervisor,
      dailyLogs,
      documents,
      comments,
      assignmentHistory,
      tasks,
      milestones,
    });
  } catch (error) {
    console.error(
      "Failed to fetch project:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load project. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| PATCH PROJECT
|--------------------------------------------------------------------------
|
| ONLY ADMINISTRATORS CAN EDIT PROJECTS.
|
| Financial rules:
|
|   paid <= invoiced <= budget
|
| paid is calculated from Payment records.
|
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
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * ADMIN ONLY
   * ----------------------------------------------------------------------
   */

  if (!isAdmin(session)) {
    return NextResponse.json(
      {
        error:
          "Only administrators can edit projects",
      },
      {
        status: 403,
      }
    );
  }

  const { id } = await params;

  if (!id || id.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Invalid project ID",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * FIND EXISTING PROJECT
   * ----------------------------------------------------------------------
   */

  const existing =
    await prisma.project.findUnique({
      where: {
        id,
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
        budget: true,
        invoiced: true,

        /*
         * We intentionally do not use stored `paid`.
         *
         * Payment records are queried below.
         */

        clientId: true,
        architectId: true,
        supervisorId: true,
        archivedAt: true,
      },
    });

  if (!existing) {
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
   * Archived projects cannot be edited.
   */

  if (existing.archivedAt) {
    return NextResponse.json(
      {
        error:
          "Archived projects cannot be modified",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * READ BODY
   * ----------------------------------------------------------------------
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
   * ----------------------------------------------------------------------
   * VALIDATE BODY
   * ----------------------------------------------------------------------
   */

  const parsed =
    UpdateSchema.safeParse(body);

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

  const data = parsed.data;

  /*
   * Prevent empty PATCH requests.
   */

  if (
    Object.keys(data).length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "No project changes were supplied",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * DATE VALIDATION
   * ----------------------------------------------------------------------
   */

  let startDate:
    | Date
    | undefined;

  let dueDate:
    | Date
    | undefined;

  let completionDate:
    | Date
    | null
    | undefined;

  if (data.startDate !== undefined) {
    startDate = new Date(
      data.startDate
    );

    if (
      Number.isNaN(
        startDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid start date",
        },
        {
          status: 400,
        }
      );
    }
  }

  if (data.dueDate !== undefined) {
    dueDate = new Date(
      data.dueDate
    );

    if (
      Number.isNaN(
        dueDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid due date",
        },
        {
          status: 400,
        }
      );
    }
  }

  if (
    data.completionDate !==
    undefined
  ) {
    completionDate =
      data.completionDate
        ? new Date(
            data.completionDate
          )
        : null;

    if (
      completionDate &&
      Number.isNaN(
        completionDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid completion date",
        },
        {
          status: 400,
        }
      );
    }
  }

  /*
   * ----------------------------------------------------------------------
   * DATE RELATIONSHIP VALIDATION
   * ----------------------------------------------------------------------
   */

  const effectiveStartDate =
    startDate ??
    existing.startDate;

  const effectiveDueDate =
    dueDate ??
    existing.dueDate;

  if (
    effectiveStartDate &&
    effectiveDueDate &&
    effectiveDueDate <
      effectiveStartDate
  ) {
    return NextResponse.json(
      {
        error:
          "Due date cannot be before the project start date",
      },
      {
        status: 400,
      }
    );
  }

  if (
    completionDate &&
    effectiveStartDate &&
    completionDate <
      effectiveStartDate
  ) {
    return NextResponse.json(
      {
        error:
          "Completion date cannot be before the project start date",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * FINANCIAL VALIDATION
   * ----------------------------------------------------------------------
   *
   * Authoritative payment amount comes from Payment records.
   */

  const currentPaid =
    await getProjectFinance(id);

  const effectiveBudget =
    data.budget ??
    Number(existing.budget ?? 0);

  const effectiveInvoiced =
    data.invoiced ??
    Number(existing.invoiced ?? 0);

  /*
   * Rule 1:
   *
   * Invoiced cannot exceed budget.
   */

  if (
    effectiveInvoiced >
    effectiveBudget
  ) {
    return NextResponse.json(
      {
        error:
          "Invoiced amount cannot exceed the project budget",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Rule 2:
   *
   * Paid cannot exceed invoiced.
   *
   * This is the key finance correction.
   */

  if (
    currentPaid >
    effectiveInvoiced
  ) {
    return NextResponse.json(
      {
        error:
          "Project invoiced amount cannot be lower than the amount already paid",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Rule 3:
   *
   * Paid cannot exceed budget.
   *
   * This is technically implied by rules 1 and 2, but we keep the
   * explicit validation for defense in depth.
   */

  if (
    currentPaid >
    effectiveBudget
  ) {
    return NextResponse.json(
      {
        error:
          "Project budget cannot be lower than the amount already paid",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * UPDATE PROJECT
   * ----------------------------------------------------------------------
   */

  try {
    const project =
      await prisma.project.update({
        where: {
          id,
        },

        data: {
          ...(data.name !==
            undefined && {
            name: data.name,
          }),

          ...(data.description !==
            undefined && {
            description:
              data.description,
          }),

          ...(data.status !==
            undefined && {
            status: data.status,
          }),

          ...(data.priority !==
            undefined && {
            priority:
              data.priority,
          }),

          ...(data.location !==
            undefined && {
            location:
              data.location,
          }),

          ...(startDate !==
            undefined && {
            startDate,
          }),

          ...(dueDate !==
            undefined && {
            dueDate,
          }),

          ...(data.completionDate !==
            undefined && {
            completionDate,
          }),

          ...(data.budget !==
            undefined && {
            budget: data.budget,
          }),

          ...(data.invoiced !==
            undefined && {
            invoiced:
              data.invoiced,
          }),
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

          budget: true,
          invoiced: true,

          clientId: true,
          architectId: true,
          supervisorId: true,

          createdAt: true,
          updatedAt: true,
        },
      });

    /*
     * ----------------------------------------------------------------------
     * GET AUTHORITATIVE PAYMENT TOTAL AFTER UPDATE
     * ----------------------------------------------------------------------
     */

    const paid =
      await getProjectFinance(
        project.id
      );

    const finance =
      buildFinance(
        Number(project.budget ?? 0),
        Number(project.invoiced ?? 0),
        paid
      );

    /*
     * Same flat-fetch pattern as GET above -- matches what the removed
     * nested client/architect/supervisor select used to provide in
     * this response, without the join that fails on this host.
     */
    const [patchClient, patchArchitect, patchSupervisor] = await Promise.all([
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

    /*
     * ----------------------------------------------------------------------
     * AUDIT PROJECT CHANGE
     * ----------------------------------------------------------------------
     */

    try {
      await logActivity({
        action: "PROJECT_UPDATED",
        entityType: "PROJECT",
        entityId: project.id,
        actorId: session.user.id,
        projectId: project.id,

        metadata: {
          projectName: project.name,
          sheetNo: project.sheetNo,

          changes: data,

          finance: {
            budget: finance.budget,
            invoiced: finance.invoiced,
            paid: finance.paid,
            outstanding:
              finance.outstanding,
          },
        },
      });
    } catch (error) {
      console.error(
        "Project update audit logging failed:",
        error
      );
    }

    /*
     * ----------------------------------------------------------------------
     * RESPONSE
     * ----------------------------------------------------------------------
     */

    return NextResponse.json({
      ...project,

      client: patchClient,
      architect: patchArchitect,
      supervisor: patchSupervisor,

      budget: finance.budget,
      invoiced: finance.invoiced,
      paid: finance.paid,
      outstanding:
        finance.outstanding,
      uninvoiced:
        finance.uninvoiced,
      remainingBudget:
        finance.remainingBudget,
    });
  } catch (error) {
    console.error(
      "Project update failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update project. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| DELETE / ARCHIVE PROJECT
|--------------------------------------------------------------------------
|
| This endpoint does NOT physically delete the project.
|
| Only ADMIN can archive a project.
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
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * Only administrators may archive projects.
   */

  if (!isAdmin(session)) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      }
    );
  }

  const { id } = await params;

  if (!id || id.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Invalid project ID",
      },
      {
        status: 400,
      }
    );
  }

  const existing =
    await prisma.project.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        name: true,
        sheetNo: true,
        archivedAt: true,
      },
    });

  if (!existing) {
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
   * Prevent duplicate archive operations.
   */

  if (existing.archivedAt) {
    return NextResponse.json(
      {
        error:
          "Project is already archived",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ----------------------------------------------------------------------
   * ARCHIVE PROJECT
   * ----------------------------------------------------------------------
   */

  try {
    const project =
      await prisma.project.update({
        where: {
          id,
        },

        data: {
          archivedAt:
            new Date(),
          archivedById:
            session.user.id,
        },

        select: {
          id: true,
          name: true,
          sheetNo: true,
          archivedAt: true,
          archivedById: true,
        },
      });

    /*
     * --------------------------------------------------------------------
     * AUDIT ARCHIVE ACTION
     * --------------------------------------------------------------------
     */

    try {
      await logActivity({
        action: "PROJECT_ARCHIVED",
        entityType: "PROJECT",
        entityId: project.id,
        actorId: session.user.id,
        projectId: project.id,

        metadata: {
          projectName:
            project.name,
          sheetNo:
            project.sheetNo,
        },
      });
    } catch (error) {
      console.error(
        "Project archive audit logging failed:",
        error
      );
    }

    /*
     * --------------------------------------------------------------------
     * ADMIN NOTIFICATION
     * --------------------------------------------------------------------
     */

    try {
      await prisma.notification.create({
        data: {
          userId:
            session.user.id,

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
  } catch (error) {
    console.error(
      "Project archive failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to archive project. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}