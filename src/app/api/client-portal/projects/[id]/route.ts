import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-portal-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // clientId is part of the where clause, not a post-fetch check — a
  // client can never even learn whether a project id belonging to another
  // client exists.
  const project = await prisma.project.findFirst({
    where: { id, clientId: ctx.clientId },
    select: {
      id: true,
      sheetNo: true,
      name: true,
      description: true,
      location: true,
      status: true,
      progress: true,
      startDate: true,
      dueDate: true,
      completionDate: true,
      architectId: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /*
   * Fetched as separate flat queries instead of nested selects on the
   * project query above -- on this app's hosting, queries involving
   * relation joins fail with "Connection terminated unexpectedly".
   */
  const [architect, documents, comments] = await Promise.all([
    project.architectId
      ? prisma.user.findUnique({
          where: { id: project.architectId },
          select: { name: true, initials: true, avatarUrl: true },
        })
      : Promise.resolve(null),
    prisma.document.findMany({
      where: { projectId: id, clientVisible: true, isLatest: true, deletedAt: null },
      select: { id: true, name: true, category: true, fileSize: true, version: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.clientComment.findMany({
      where: { projectId: id },
      select: { id: true, content: true, type: true, author: true, viaPortal: true, createdAt: true, resolvedAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Rewrite to the client-portal download proxy (enforces clientVisible +
  // clientId ownership) rather than the staff-only /api/documents/{id}.
  const withPortalUrls = {
    ...project,
    architect,
    documents: documents.map((d) => ({
      ...d,
      fileUrl: `/api/client-portal/documents/${d.id}`,
    })),
    comments,
  };
  return NextResponse.json(withPortalUrls);
}
