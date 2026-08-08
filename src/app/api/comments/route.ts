import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CommentType } from "@prisma/client";
import { isAdmin } from "@/lib/rbac";
import { notifyClientComment } from "@/lib/notifications";
import { z } from "zod";

const Schema = z.object({
  projectId: z.string(),
  clientId: z.string(),
  author: z.string(),
  content: z.string().min(5),
  type: z.enum(["FEEDBACK", "APPROVAL", "CHANGE_REQUEST", "QUERY"]),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const unresolved = searchParams.get("unresolved") === "true";

  const comments = await prisma.clientComment.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(unresolved && { resolvedAt: null }),
      ...(!isAdmin(session) && {
        project: { OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }] },
      }),
    },
    include: {
      project: { select: { id: true, name: true, sheetNo: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const comment = await prisma.clientComment.create({
    data: {
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      author: parsed.data.author,
      content: parsed.data.content,
      type: parsed.data.type as CommentType,
    },
    include: {
      project: { select: { id: true, name: true, sheetNo: true, architectId: true, supervisorId: true } },
      client: { select: { id: true, name: true } },
    },
  });

  const notifyRecipients = [comment.project.architectId, comment.project.supervisorId].filter(
    (uid): uid is string => Boolean(uid)
  );
  await Promise.all(
    [...new Set(notifyRecipients)].map((userId) =>
      notifyClientComment({
        userId,
        projectId: comment.project.id,
        projectName: `${comment.project.name} (${comment.project.sheetNo})`,
        commentPreview: comment.content,
        commentType: comment.type,
      })
    )
  );

  return NextResponse.json(comment, { status: 201 });
}
