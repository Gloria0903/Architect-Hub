import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  canRecordInvoices,
  canViewPayments,
  isAdmin,
  relatedProjectAccessWhere,
} from "@/lib/rbac";
import { z } from "zod";

const Schema = z.object({
  projectId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1),
  reference: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
});

/*
|--------------------------------------------------------------------------
| GET /api/invoices
|--------------------------------------------------------------------------
| Same read-authorization shape as /api/payments: ADMIN and SENIOR_ARCHITECT
| see everything, ARCHITECT only their own assigned/supervised projects.
| Recording remains ADMIN-only, handled by POST below.
|--------------------------------------------------------------------------
*/
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canViewPayments(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const relatedWhere = relatedProjectAccessWhere(session);

  const projectWhere =
    relatedWhere === undefined
      ? projectId
        ? { id: projectId }
        : undefined
      : {
          AND: [
            relatedWhere,
            ...(projectId ? [{ id: projectId }] : []),
          ],
        };

  try {
    /*
     * Same fix as /api/payments GET: converts the relational
     * project-access filter into a flat list of allowed project IDs
     * first, instead of `where: { project: projectWhere }` (a join).
     * On HostPinnacle, queries involving relation joins -- whether in
     * a select OR a where clause -- fail with "Connection terminated
     * unexpectedly"; a plain `projectId: { in: [...] }` filter avoids
     * the join entirely.
     */
    let projectIdFilter: string[] | undefined;

    if (projectWhere !== undefined) {
      const accessibleProjects = await prisma.project.findMany({
        where: projectWhere,
        select: { id: true },
      });
      projectIdFilter = accessibleProjects.map((p) => p.id);
    }

    const invoices = await prisma.invoice.findMany({
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
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const invoiceProjectIds = [...new Set(invoices.map((i) => i.projectId))];
    const recorderIds = [...new Set(invoices.map((i) => i.recordedById))];

    const [relatedProjects, recorders] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: invoiceProjectIds } },
        select: { id: true, name: true, sheetNo: true, budget: true, invoiced: true, paid: true },
      }),
      prisma.user.findMany({
        where: { id: { in: recorderIds } },
        select: { id: true, name: true },
      }),
    ]);

    const projectById = new Map(relatedProjects.map((p) => [p.id, p]));
    const recorderById = new Map(recorders.map((u) => [u.id, u]));

    const invoicesWithRelations = invoices.map((invoice) => ({
      ...invoice,
      project: projectById.get(invoice.projectId) ?? null,
      recordedBy: recorderById.get(invoice.recordedById) ?? null,
    }));

    return NextResponse.json(invoicesWithRelations);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to load invoice records" },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/invoices
|--------------------------------------------------------------------------
| Raises an invoice against a project's budget -- the step that was
| entirely missing before this route existed. Payments were always
| correctly capped at "can't exceed invoiced" (see /api/payments); this
| is what actually lets `invoiced` become greater than zero in the
| first place.
|
| Same safety shape as recording a payment: amount re-validated against
| a FRESH read of current state inside the transaction (not the request
| body's stale view), so two concurrent invoice requests can't together
| push `invoiced` past `budget`.
|--------------------------------------------------------------------------
*/
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canRecordInvoices(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Defense in depth, same pattern as /api/payments.
  if (!isAdmin(session)) {
    return NextResponse.json(
      { error: "Only administrators can record invoices" },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, amount, date, reference, note } = parsed.data;

  const invoiceDate = new Date(date);

  if (Number.isNaN(invoiceDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentProject = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, budget: true, invoiced: true, paid: true },
      });

      if (!currentProject) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      const currentBudget = Number(currentProject.budget ?? 0);
      const currentInvoiced = Number(currentProject.invoiced ?? 0);

      const remainingToInvoice = Math.max(currentBudget - currentInvoiced, 0);

      if (amount > remainingToInvoice) {
        throw new Error(`INVOICE_EXCEEDS_BUDGET:${remainingToInvoice}`);
      }

      const invoice = await tx.invoice.create({
        data: {
          projectId,
          recordedById: session.user.id,
          amount,
          date: invoiceDate,
          reference: reference?.trim() || null,
          note: note?.trim() || null,
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

      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { invoiced: { increment: amount } },
        select: { id: true, budget: true, invoiced: true, paid: true },
      });

      return { invoice, project: updatedProject };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (error instanceof Error && error.message.startsWith("INVOICE_EXCEEDS_BUDGET:")) {
      const remaining = error.message.split(":")[1];
      return NextResponse.json(
        {
          error: `This invoice would exceed the project's remaining budget. Ksh ${Number(remaining).toLocaleString()} is still available to invoice.`,
        },
        { status: 400 }
      );
    }

    console.error("Failed to record invoice:", error);
    return NextResponse.json({ error: "Failed to record invoice" }, { status: 500 });
  }
}
