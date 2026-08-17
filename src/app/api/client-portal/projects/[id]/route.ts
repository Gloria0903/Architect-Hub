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
      architect: { select: { name: true, initials: true, avatarUrl: true } },
      documents: {
        where: { clientVisible: true, isLatest: true, deletedAt: null },
        select: { id: true, name: true, category: true, fileSize: true, version: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      },
      comments: {
        select: { id: true, content: true, type: true, author: true, viaPortal: true, createdAt: true, resolvedAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Rewrite to the client-portal download proxy (enforces clientVisible +
  // clientId ownership) rather than the staff-only /api/documents/{id}.
  const withPortalUrls = {
    ...project,
    documents: project.documents.map((d: (typeof project.documents)[number]) => ({
      ...d,
      fileUrl: `/api/client-portal/documents/${d.id}`,
    })),
  };
  return NextResponse.json(withPortalUrls);
}
