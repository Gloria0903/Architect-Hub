import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateProjectFinance,
} from "@/lib/finance/calculations";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/projects/[id]/finance
 *
 * Returns the single source of truth for a project's
 * financial information.
 */
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

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

    const project =
      await prisma.project.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          sheetNo: true,
          name: true,
          budget: true,
          invoiced: true,
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
     * Fetched as its own flat query instead of a nested `payments:
     * {select: {...}}` on the project query above -- on this app's
     * hosting, queries involving relation joins (even a simple
     * one-to-many with no further nesting inside it) fail with
     * "Connection terminated unexpectedly".
     */
    const payments = await prisma.payment.findMany({
      where: { projectId: id },
      select: {
        id: true,
        amount: true,
        date: true,
        reference: true,
        note: true,
        createdAt: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    /**
     * IMPORTANT:
     *
     * Do NOT trust Project.paid as the source of truth.
     *
     * The Payment records are the authoritative record
     * of money actually received.
     */
    const paid = payments.reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );

    const finance =
      calculateProjectFinance({
        budget: project.budget,
        invoiced: project.invoiced,
        paid,
      });

    return NextResponse.json({
      project: {
        id: project.id,
        sheetNo: project.sheetNo,
        name: project.name,
      },

      finance,

      payments: payments.map(
        (payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          date: payment.date,
          reference: payment.reference,
          note: payment.note,
          createdAt: payment.createdAt,
        })
      ),
    });
  } catch (error) {
    console.error(
      "GET /api/projects/[id]/finance error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load project finance",
      },
      {
        status: 500,
      }
    );
  }
}