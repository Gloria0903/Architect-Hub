import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-portal-auth";

export async function GET() {
  const ctx = await requireClientSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { clientId: ctx.clientId },
    select: {
      id: true,
      sheetNo: true,
      name: true,
      location: true,
      status: true,
      progress: true,
      startDate: true,
      dueDate: true,
      completionDate: true,
      architect: { select: { name: true, initials: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}
