import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CommentType } from "@prisma/client";
import { isAdmin, canAccessProject } from "@/lib/rbac";
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

  /*
   * Same flat-query fix as elsewhere in this app: relational where
   * filters and nested includes both fail with "Connection terminated
   * unexpectedly" on this app's hosting. Non-admin project access is
   * resolved to a flat list of project IDs first, instead of
   * `where: { project: { OR: [...] } }` (a join).
   */
  let accessibleProjectIds: string[] | undefined;

  if (!isAdmin(session)) {
    const accessibleProjects = await prisma.project.findMany({
      where: {
        OR: [
          { architectId: session.user.id },
          { supervisorId: session.user.id },
        ],
      },
      select: { id: true },
    });
    accessibleProjectIds = accessibleProjects.map((p) => p.id);
  }

  const comments = await prisma.clientComment.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(unresolved && { resolvedAt: null }),
      ...(accessibleProjectIds ? { projectId: { in: accessibleProjectIds } } : {}),
    },
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
  });

  const commentProjectIds = [...new Set(comments.map((c) => c.projectId))];
  const commentClientIds = [...new Set(comments.map((c) => c.clientId))];

  const [relatedProjects, relatedClients] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: commentProjectIds } },
      select: { id: true, name: true, sheetNo: true },
    }),
    prisma.client.findMany({
      where: { id: { in: commentClientIds } },
      select: { id: true, name: true },
    }),
  ]);

  const projectById = new Map(relatedProjects.map((p) => [p.id, p]));
  const clientById = new Map(relatedClients.map((c) => [c.id, c]));

  const commentsWithRelations = comments.map((comment) => ({
    ...comment,
    project: projectById.get(comment.projectId) ?? null,
    client: clientById.get(comment.clientId) ?? null,
  }));

  return NextResponse.json(commentsWithRelations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: {
      id: true,
      name: true,
      sheetNo: true,
      clientId: true,
      architectId: true,
      supervisorId: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  if (!canAccessProject(session, project)) {
    return NextResponse.json(
      { error: "You do not have access to this project" },
      { status: 403 }
    );
  }

  if (project.clientId !== parsed.data.clientId) {
    return NextResponse.json(
      { error: "Client does not belong to this project" },
      { status: 400 }
    );
  }

  /*
   * Flat create, no nested include -- project is already fetched
   * above (flat), so it's reused directly for the response and the
   * notification loop instead of re-fetching it via a nested select.
   */
  const comment = await prisma.clientComment.create({
    data: {
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      author: parsed.data.author,
      content: parsed.data.content,
      type: parsed.data.type as CommentType,
    },
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
  });

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true, name: true },
  });

  const notifyRecipients = [project.architectId, project.supervisorId].filter(
    (uid): uid is string => Boolean(uid)
  );
  await Promise.all(
    [...new Set(notifyRecipients)].map((userId) =>
      notifyClientComment({
        userId,
        projectId: project.id,
        projectName: `${project.name} (${project.sheetNo})`,
        commentPreview: comment.content,
        commentType: comment.type,
      })
    )
  );

  return NextResponse.json(
    {
      ...comment,
      project: { id: project.id, name: project.name, sheetNo: project.sheetNo },
      client,
    },
    { status: 201 }
  );
}
