import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";

/**
 * GET /api/invoices/[id] — full detail for a single invoice, used by
 * the printable invoice document. Deliberately flat queries + separate
 * batched lookups throughout, same pattern as every other route fixed
 * this session -- nested relation selects fail with "Connection
 * terminated unexpectedly" on this app's hosting.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
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

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const project = await prisma.project.findUnique({
    where: { id: invoice.projectId },
    select: {
      id: true,
      name: true,
      sheetNo: true,
      location: true,
      budget: true,
      invoiced: true,
      clientId: true,
      architectId: true,
      supervisorId: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [client, recordedBy, firmSettings] = await Promise.all([
    prisma.client.findUnique({
      where: { id: project.clientId },
      select: { id: true, name: true, contactPerson: true, email: true, phone: true, address: true },
    }),
    prisma.user.findUnique({
      where: { id: invoice.recordedById },
      select: { id: true, name: true },
    }),
    prisma.firmSettings.findUnique({
      where: { id: "singleton" },
      select: { firmName: true, country: true, currency: true },
    }),
  ]);

  // Sequence number for display -- Nth invoice ever recorded for this
  // project, in chronological order. A flat, simple count query.
  const invoiceCountForProject = await prisma.invoice.count({
    where: { projectId: project.id, createdAt: { lte: invoice.createdAt } },
  });

  return NextResponse.json({
    invoice,
    project,
    client,
    recordedBy,
    firm: {
      firmName: firmSettings?.firmName ?? "Architect Hub",
      country: firmSettings?.country ?? "Kenya",
      currency: firmSettings?.currency ?? "KES",
    },
    sequenceNumber: invoiceCountForProject,
  });
}
