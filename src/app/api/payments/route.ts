import { notifyPaymentUpdate } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin, canRecordPayments } from "@/lib/rbac";
import { z } from "zod";

const Schema = z.object({
  projectId: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const payments = await prisma.payment.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(!isAdmin(session) && {
        project: { OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }] },
      }),
    },
    include: {
      project: { select: { id: true, name: true, sheetNo: true } },
      recordedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canRecordPayments(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [payment, updatedProject] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        projectId: parsed.data.projectId,
        recordedById: session.user.id,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        reference: parsed.data.reference,
        note: parsed.data.note,
      },
      include: {
        project: { select: { id: true, name: true, sheetNo: true } },
        recordedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { paid: { increment: parsed.data.amount } },
    }),
  ]);

  const outstandingBalance = updatedProject.budget - updatedProject.paid;
  const recipients = [updatedProject.architectId, updatedProject.supervisorId].filter(
    (id): id is string => Boolean(id) && id !== session.user.id
  );

  await Promise.all(
    [...new Set(recipients)].map((userId) =>
      notifyPaymentUpdate({
        userId,
        projectId: updatedProject.id,
        projectName: `${payment.project.name} (${payment.project.sheetNo})`,
        amount: parsed.data.amount,
        outstandingBalance,
      })
    )
  );

  return NextResponse.json(payment, { status: 201 });
}