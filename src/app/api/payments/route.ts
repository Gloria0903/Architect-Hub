import { notifyPaymentUpdate } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canRecordPayments, isAdmin } from "@/lib/rbac";
import { z } from "zod";

const Schema = z.object({
  projectId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const payments = await prisma.payment.findMany({
    where: {
      ...(projectId ? { projectId } : {}),

      ...(!isAdmin(session)
        ? {
            project: {
              OR: [
                {
                  architectId: session.user.id,
                },
                {
                  supervisorId: session.user.id,
                },
              ],
            },
          }
        : {}),
    },

    include: {
      project: {
        select: {
          id: true,
          name: true,
          sheetNo: true,
        },
      },

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
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!canRecordPayments(session)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.flatten(),
        },
        { status: 400 }
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
     * ------------------------------------------------------------------------
     * FIND PROJECT
     * ------------------------------------------------------------------------
     */

    const project = await prisma.project.findUnique({
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
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    /*
     * ------------------------------------------------------------------------
     * CALCULATE CONTRACT OUTSTANDING
     *
     * Outstanding = Contract Value - Amount Paid
     *
     * We use budget here because the current system does not yet have a
     * separate invoice management workflow.
     * ------------------------------------------------------------------------
     */

    const contractValue = Number(project.budget || 0);
    const currentPaid = Number(project.paid || 0);

    const outstandingBalance = Math.max(
      contractValue - currentPaid,
      0
    );

    /*
     * Do not allow payment above the remaining contract value.
     */

    if (amount > outstandingBalance) {
      return NextResponse.json(
        {
          error: `Payment exceeds the outstanding contract balance of ${outstandingBalance}`,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------------------
     * CREATE PAYMENT + UPDATE PROJECT ATOMICALLY
     * ------------------------------------------------------------------------
     */

    const [payment, updatedProject] =
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            projectId,
            recordedById: session.user.id,
            amount,
            date: new Date(date),
            reference: reference || null,
            note: note || null,
          },

          include: {
            project: {
              select: {
                id: true,
                name: true,
                sheetNo: true,
              },
            },

            recordedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),

        prisma.project.update({
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
            budget: true,
            paid: true,
            architectId: true,
            supervisorId: true,
          },
        }),
      ]);

    /*
     * ------------------------------------------------------------------------
     * CALCULATE NEW OUTSTANDING BALANCE
     * ------------------------------------------------------------------------
     */

    const newOutstandingBalance = Math.max(
      Number(updatedProject.budget || 0) -
        Number(updatedProject.paid || 0),
      0
    );

    /*
     * ------------------------------------------------------------------------
     * NOTIFY PROJECT TEAM
     * ------------------------------------------------------------------------
     */

    const recipients = [
      updatedProject.architectId,
      updatedProject.supervisorId,
    ].filter(
      (id): id is string =>
        Boolean(id) &&
        id !== session.user.id
    );

    await Promise.all(
      [...new Set(recipients)].map((userId) =>
        notifyPaymentUpdate({
          userId,
          projectId: updatedProject.id,
          projectName: `${payment.project.name} (${payment.project.sheetNo})`,
          amount,
          outstandingBalance: newOutstandingBalance,
        })
      )
    );

    return NextResponse.json(
      payment,
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Payment creation error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to record payment",
      },
      {
        status: 500,
      }
    );
  }
}