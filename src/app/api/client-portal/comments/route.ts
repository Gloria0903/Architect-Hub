import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-portal-auth";
import { z } from "zod";

const Schema = z.object({
  projectId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const ctx = await requireClientSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Ownership check via the where clause, same pattern as the project
  // detail route — never trust a projectId from the client without
  // scoping the lookup to this client's own id.
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, clientId: ctx.clientId },
    select: { id: true, architectId: true, supervisorId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = await prisma.client.findUnique({ where: { id: ctx.clientId }, select: { contactPerson: true } });

  const comment = await prisma.clientComment.create({
    data: {
      projectId: project.id,
      clientId: ctx.clientId,
      content: parsed.data.content,
      type: "QUERY",
      author: client?.contactPerson ?? "Client",
      viaPortal: true,
    },
  });

  // Notify whoever's actually on the project — same idea as staff-side
  // comment creation, just triggered from the portal side instead.
  const notifyIds = [project.architectId, project.supervisorId].filter((id): id is string => Boolean(id));
  if (notifyIds.length > 0) {
    await prisma.notification.createMany({
      data: notifyIds.map(userId => ({
        userId,
        message: `New client message on a project you're assigned to`,
        type: "INFO" as const,
      })),
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
