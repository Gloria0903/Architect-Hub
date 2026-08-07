import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/project-access";
import { validateDocumentUpload } from "@/lib/document-validation";

/**
 * Any document row can be either the root (v1, parentId null) or a later
 * version (parentId = root's id). This resolves whichever id was passed
 * down to the root, since version history is always keyed off the root.
 */
async function resolveRootId(documentId: string): Promise<string | null> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, parentId: true },
  });
  if (!doc) return null;
  return doc.parentId ?? doc.id;
}

// GET /api/documents/[id]/versions — full version history, newest first
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { allowed } = await canAccessDocument(
    { id: session.user.id, role: session.user.role },
    id
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rootId = await resolveRootId(id);
  if (!rootId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const versions = await prisma.document.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: rootId }, { parentId: rootId }],
    },
    include: { uploadedBy: { select: { id: true, name: true, initials: true } } },
    orderBy: { version: "desc" },
  });

  return NextResponse.json({ versions });
}

// POST /api/documents/[id]/versions — confirm a completed upload as a new
// version. `id` can be the root document or any existing version of it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { allowed, projectId } = await canAccessDocument(
    { id: session.user.id, role: session.user.role },
    id
  );
  if (!allowed || !projectId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { key, name, mimeType, fileSize } = body ?? {};
  if (!key || !name || !mimeType || typeof fileSize !== "number") {
    return NextResponse.json(
      { error: "key, name, mimeType, and fileSize are required" },
      { status: 400 }
    );
  }

  const validation = validateDocumentUpload({ fileName: name, mimeType, sizeBytes: fileSize });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  if (!key.startsWith(`projects/${projectId}/documents/`)) {
    return NextResponse.json({ error: "Upload key does not match this project" }, { status: 400 });
  }

  const rootId = await resolveRootId(id);
  if (!rootId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Everything below must succeed or fail together: if we flip isLatest off
  // the old version but crash before creating the new one, the project would
  // briefly show zero current versions of a document that's actively in use.
  const newVersion = await prisma.$transaction(async (tx) => {
    const currentLatest = await tx.document.findFirst({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      orderBy: { version: "desc" },
    });

    if (!currentLatest) {
      throw new Error("Root document disappeared mid-transaction");
    }

    await tx.document.updateMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      data: { isLatest: false },
    });

    return tx.document.create({
      data: {
        name,
        category: currentLatest.category,
        fileKey: key,
        fileUrl: key,
        fileSize,
        mimeType,
        version: currentLatest.version + 1,
        isLatest: true,
        projectId,
        uploadedById: session.user.id,
        parentId: rootId,
      },
    });
  });

  return NextResponse.json({ document: newVersion }, { status: 201 });
}
