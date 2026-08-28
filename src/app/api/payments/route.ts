import { notifyPaymentUpdate } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  canRecordPayments,
  canViewPayments,
  isAdmin,
  relatedProjectAccessWhere,
} from "@/lib/rbac";
import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const Schema = z.object({
  projectId: z.string().min(1),

  /**
   * Payment amounts must always be positive.
   */
  amount: z.number().positive(),

  /**
   * Date received from frontend.
   */
  date: z.string().min(1),

  reference: z
    .string()
    .max(200)
    .optional(),

  note: z
    .string()
    .max(2000)
    .optional(),
});

/*
|--------------------------------------------------------------------------
| GET /api/payments
|--------------------------------------------------------------------------
|
| ADMIN:
|   Can retrieve all payment records.
|
| ARCHITECT:
|   Can retrieve payments only for projects where they are:
|
|       architect OR supervisor
|
| IMPORTANT:
|
| This is READ authorization.
|
| Recording payments remains ADMIN-only and is handled by POST.
|
|--------------------------------------------------------------------------
*/

export async function GET(
  req: NextRequest
) {
  const session = await auth();

  /*
   * ---------------------------------------------------------------
   * Authentication
   * ---------------------------------------------------------------
   */

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
   * ---------------------------------------------------------------
   * Financial read permission
   * ---------------------------------------------------------------
   */

  if (!canViewPayments(session)) {
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
   * ---------------------------------------------------------------
   * Optional project filter
   * ---------------------------------------------------------------
   */

  const { searchParams } =
    new URL(req.url);

  const projectId =
    searchParams.get("projectId");

  /*
   * ---------------------------------------------------------------
   * Build secure project scope
   * ---------------------------------------------------------------
   *
   * ADMIN:
   *
   *     all projects
   *
   * ARCHITECT:
   *
   *     only projects where:
   *
   *       architectId = current user
   *       OR
   *       supervisorId = current user
   *
   * When a specific projectId is supplied, BOTH conditions must be
   * satisfied.
   */

  const relatedWhere = relatedProjectAccessWhere(session);

  const projectWhere =
    relatedWhere === undefined
      ? projectId
        ? {
            id: projectId,
          }
        : undefined
      : {
          AND: [
            relatedWhere,

            ...(projectId
              ? [
                  {
                    id: projectId,
                  },
                ]
              : []),
          ],
        };

  /*
   * ---------------------------------------------------------------
   * Retrieve payments
   * ---------------------------------------------------------------
   */

  try {
    /*
     * Converts the relational project-access filter into a flat list
     * of allowed project IDs first, instead of filtering payments via
     * `where: { project: projectWhere }` directly (a join). On
     * HostPinnacle, queries involving relation joins -- whether in a
     * select OR a where clause -- fail with "Connection terminated
     * unexpectedly"; a plain `projectId: { in: [...] }` filter avoids
     * the join entirely. When projectWhere is undefined (admin, no
     * specific project requested), there's nothing to restrict, so
     * this step is skipped.
     */
    let projectIdFilter: string[] | undefined;

    if (projectWhere !== undefined) {
      const accessibleProjects = await prisma.project.findMany({
        where: projectWhere,
        select: { id: true },
      });
      projectIdFilter = accessibleProjects.map((p) => p.id);
    }

    const payments =
      await prisma.payment.findMany({
        where: {
          ...(projectIdFilter ? { projectId: { in: projectIdFilter } } : {}),
        },

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

        orderBy: [
          {
            date: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

    /*
     * Same batched-flat-lookup pattern as /api/projects: fetch the
     * related projects and users as separate flat queries instead of
     * nested relation selects, then stitch back into the exact same
     * response shape as before.
     */
    const paymentProjectIds = [...new Set(payments.map((p) => p.projectId))];
    const recorderIds = [...new Set(payments.map((p) => p.recordedById))];

    const [relatedProjects, recorders] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: paymentProjectIds } },
        select: { id: true, name: true, sheetNo: true, budget: true, invoiced: true, paid: true },
      }),
      prisma.user.findMany({
        where: { id: { in: recorderIds } },
        select: { id: true, name: true },
      }),
    ]);

    const projectById = new Map(relatedProjects.map((p) => [p.id, p]));
    const recorderById = new Map(recorders.map((u) => [u.id, u]));

    const paymentsWithRelations = payments.map((payment) => ({
      ...payment,
      project: projectById.get(payment.projectId) ?? null,
      recordedBy: recorderById.get(payment.recordedById) ?? null,
    }));

    /*
     * ---------------------------------------------------------------
     * Return payment records
     * ---------------------------------------------------------------
     */

    return NextResponse.json(
      paymentsWithRelations
    );
  } catch (error) {
    console.error(
      "Failed to fetch payments:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load payment records",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/payments
|--------------------------------------------------------------------------
|
| Records a client payment.
|
| FINANCIAL MODEL
|
| Budget   = total contract value
| Invoiced = amount billed
| Paid     = amount actually received
|
| Outstanding = Invoiced - Paid
|
| A payment is NOT allowed to make:
|
|     Paid > Invoiced
|
|--------------------------------------------------------------------------
*/

export async function POST(
  req: NextRequest
) {
  const session = await auth();

  /*
   * ---------------------------------------------------------------
   * Authentication
   * ---------------------------------------------------------------
   */

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
   * ---------------------------------------------------------------
   * RBAC
   * ---------------------------------------------------------------
   *
   * Only administrators can record payments.
   */

  if (!canRecordPayments(session)) {
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
   * Explicit financial authorization.
   *
   * Keep this as defense in depth.
   */

  if (!isAdmin(session)) {
    return NextResponse.json(
      {
        error:
          "Only administrators can record payments",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * Read request body
   * ---------------------------------------------------------------
   */

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON request body",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * Validate request
   * ---------------------------------------------------------------
   */

  const parsed =
    Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const {
    projectId,
    amount,
    date,
    reference,
    note,
  } = parsed.data;

  /*
   * ---------------------------------------------------------------
   * Validate payment date
   * ---------------------------------------------------------------
   */

  const paymentDate =
    new Date(date);

  if (
    Number.isNaN(
      paymentDate.getTime()
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid payment date",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * Initial project lookup
   * ---------------------------------------------------------------
   */

  let project;

  try {
    project =
      await prisma.project.findUnique({
        where: {
          id: projectId,
        },

        select: {
          id: true,
          name: true,
          sheetNo: true,

          budget: true,
          invoiced: true,
          paid: true,

          architectId: true,
          supervisorId: true,

          archivedAt: true,
        },
      });
  } catch (error) {
    console.error(
      "Failed to find project for payment:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load project",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * Project existence
   * ---------------------------------------------------------------
   */

  if (!project) {
    return NextResponse.json(
      {
        error:
          "Project not found",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * Archived project protection
   * ---------------------------------------------------------------
   */

  if (project.archivedAt) {
    return NextResponse.json(
      {
        error:
          "Payments cannot be recorded for archived projects",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * Financial validation
   * ---------------------------------------------------------------
   *
   * Correct relationship:
   *
   *     Budget >= Invoiced >= Paid
   *
   * Therefore:
   *
   *     Outstanding = Budget - Paid
   *
   * (Invoiced is tracked separately via /api/invoices for reference,
   * but no longer constrains what payments are allowed.)
   */

  const contractValue =
    Number(project.budget ?? 0);

  const currentPaid =
    Number(project.paid ?? 0);

  /*
   * Payments are capped directly against the contract budget --
   * invoicing (see /api/invoices) is informational tracking only and
   * no longer gates whether a payment can be recorded. A firm can
   * record a client's payment the moment it's received, whether or
   * not a formal invoice was raised for it first.
   */

  const outstandingBalance =
    Math.max(
      contractValue -
        currentPaid,
      0
    );

  /*
   * ---------------------------------------------------------------
   * Prevent overpayment
   * ---------------------------------------------------------------
   */

  if (
    amount >
    outstandingBalance
  ) {
    return NextResponse.json(
      {
        error:
          `Payment exceeds the remaining contract balance of ${outstandingBalance}`,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * CREATE PAYMENT + UPDATE PAID ATOMICALLY
   * ---------------------------------------------------------------
   */

  try {
    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * -----------------------------------------------------
           * Re-read current project state
           * -----------------------------------------------------
           */

          const currentProject =
            await tx.project.findUnique({
              where: {
                id: projectId,
              },

              select: {
                id: true,
                name: true,
                sheetNo: true,

                budget: true,
                invoiced: true,
                paid: true,

                architectId: true,
                supervisorId: true,

                archivedAt: true,
              },
            });

          if (!currentProject) {
            throw new Error(
              "PROJECT_NOT_FOUND"
            );
          }

          /*
           * -----------------------------------------------------
           * Archived project check
           * -----------------------------------------------------
           */

          if (
            currentProject.archivedAt
          ) {
            throw new Error(
              "PROJECT_ARCHIVED"
            );
          }

          /*
           * -----------------------------------------------------
           * Recalculate from latest state
           * -----------------------------------------------------
           */

          const currentBudget =
            Number(
              currentProject.budget ??
                0
            );

          const currentPaid =
            Number(
              currentProject.paid ??
                0
            );

          /*
           * -----------------------------------------------------
           * Latest outstanding balance (capped directly by
           * contract budget -- invoicing is informational only
           * and no longer gates whether a payment is allowed)
           * -----------------------------------------------------
           */

          const currentOutstanding =
            Math.max(
              currentBudget -
                currentPaid,
              0
            );

          /*
           * -----------------------------------------------------
           * Prevent overpayment
           * -----------------------------------------------------
           */

          if (
            amount >
            currentOutstanding
          ) {
            throw new Error(
              `PAYMENT_EXCEEDS_BALANCE:${currentOutstanding}`
            );
          }

          /*
           * -----------------------------------------------------
           * Create payment record
           * -----------------------------------------------------
           */

          const payment =
            await tx.payment.create({
              data: {
                projectId,

                recordedById:
                  session.user.id,

                amount,

                date: paymentDate,

                reference:
                  reference?.trim() ||
                  null,

                note:
                  note?.trim() ||
                  null,
              },

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
            });

          /*
           * -----------------------------------------------------
           * Update project paid amount
           * -----------------------------------------------------
           *
           * Payment increases PAID.
           *
           * Payment does NOT increase INVOICED.
           */

          const updatedProject =
            await tx.project.update({
              where: {
                id: projectId,
              },

              data: {
                paid: {
                  increment: amount,
                },
              },

              select: {
                id: true,
                name: true,
                sheetNo: true,

                budget: true,
                invoiced: true,
                paid: true,

                architectId: true,
                supervisorId: true,
              },
            });

          /*
           * -----------------------------------------------------
           * Final consistency check
           * -----------------------------------------------------
           */

          const updatedBudget =
            Number(
              updatedProject.budget ??
                0
            );

          const updatedPaid =
            Number(
              updatedProject.paid ??
                0
            );

          if (
            updatedPaid >
            updatedBudget
          ) {
            throw new Error(
              "UPDATED_PAID_EXCEEDS_BUDGET"
            );
          }

          return {
            payment,
            updatedProject,
          };
        }
      );

    /*
     * ---------------------------------------------------------------
     * Calculate financial position
     * ---------------------------------------------------------------
     */

    const newBudget =
      Number(
        result.updatedProject
          .budget ?? 0
      );

    const newInvoiced =
      Number(
        result.updatedProject
          .invoiced ?? 0
      );

    const newPaid =
      Number(
        result.updatedProject
          .paid ?? 0
      );

    const newOutstandingBalance =
      Math.max(
        newBudget -
          newPaid,
        0
      );

    const newUninvoicedBalance =
      Math.max(
        newBudget -
          newInvoiced,
        0
      );

    /*
     * ---------------------------------------------------------------
     * Notifications
     * ---------------------------------------------------------------
     */

    const recipients = [
      result.updatedProject
        .architectId,

      result.updatedProject
        .supervisorId,
    ].filter(
      (
        id
      ): id is string =>
        Boolean(id) &&
        id !== session.user.id
    );

    const uniqueRecipients = [
      ...new Set(recipients),
    ];

    await Promise.all(
      uniqueRecipients.map(
        async (userId) => {
          try {
            await notifyPaymentUpdate({
              userId,

              projectId:
                result.updatedProject
                  .id,

              projectName:
                `${result.updatedProject.name} (${result.updatedProject.sheetNo})`,

              amount,

              outstandingBalance:
                newOutstandingBalance,
            });
          } catch (error) {
            console.error(
              `Failed to notify user ${userId} about payment:`,
              error
            );
          }
        }
      )
    );

    /*
     * ---------------------------------------------------------------
     * Return payment + financial summary
     * ---------------------------------------------------------------
     */

    return NextResponse.json(
      {
        ...result.payment,

        project: {
          id: result.updatedProject.id,
          name: result.updatedProject.name,
          sheetNo: result.updatedProject.sheetNo,
          budget: newBudget,
          invoiced: newInvoiced,
          paid: newPaid,
        },

        recordedBy: {
          id: session.user.id,
          name: session.user.name,
        },

        financialSummary: {
          budget:
            newBudget,

          invoiced:
            newInvoiced,

          paid:
            newPaid,

          outstanding:
            newOutstandingBalance,

          uninvoiced:
            newUninvoicedBalance,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    /*
     * ---------------------------------------------------------------
     * Known business errors
     * ---------------------------------------------------------------
     */

    if (
      error instanceof Error
    ) {
      if (
        error.message ===
        "PROJECT_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error:
              "Project not found",
          },
          {
            status: 404,
          }
        );
      }

      if (
        error.message ===
        "PROJECT_ARCHIVED"
      ) {
        return NextResponse.json(
          {
            error:
              "Payments cannot be recorded for archived projects",
          },
          {
            status: 400,
          }
        );
      }

      if (
        error.message ===
        "UPDATED_PAID_EXCEEDS_BUDGET"
      ) {
        return NextResponse.json(
          {
            error:
              "The project's paid amount exceeds its contract budget.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        error.message.startsWith(
          "PAYMENT_EXCEEDS_BALANCE:"
        )
      ) {
        const balance =
          error.message.substring(
            "PAYMENT_EXCEEDS_BALANCE:"
              .length
          );

        return NextResponse.json(
          {
            error:
              `Payment exceeds the remaining contract balance of ${balance}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * ---------------------------------------------------------------
     * Unexpected server error
     * ---------------------------------------------------------------
     */

    console.error(
      "Payment creation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to record payment",
      },
      {
        status: 500,
      }
    );
  }
}