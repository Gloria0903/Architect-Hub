import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";
import { saveUploadedFile } from "@/lib/storage";
import { validateDocumentUpload, sniffDangerousSignature } from "@/lib/document-validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existingProject = await prisma.project.findUnique({ where: { id: existing.projectId } });
    if (!existingProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!canAccessProject(session, existingProject)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const declaredCheck = validateDocumentUpload({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
    if (!declaredCheck.ok) return NextResponse.json({ error: declaredCheck.error }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffDangerousSignature(buffer);
    if (sniffed.dangerous) {
      return NextResponse.json(
        { error: `This file's content looks like a ${sniffed.label}, which isn't an allowed document type.` },
        { status: 400 }
      );
    }

    const { fileKey, fileSize } = await saveUploadedFile(
      file,
      buffer,
      `projects/${existing.projectId}/documents`
    );

    // The root of the version chain is either this document (if it's v1) or its parent.
    const rootId = existing.parentId ?? existing.id;
    const latestVersion = await prisma.document.aggregate({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      _max: { version: true },
    });
    const nextVersion = (latestVersion._max.version ?? existing.version) + 1;

    /*
     * Deliberately NOT wrapped in prisma.$transaction() -- same
     * reasoning as /api/logs and /reassign: the wrapper itself
     * requires this app's WebSocket connection to the database,
     * unreliable on this host regardless of query simplicity. Two
     * sequential writes instead -- marking old versions superseded,
     * then creating the new one. A brief window where both an old and
     * new version show isLatest if the second write failed right
     * after the first succeeded is a minor, recoverable
     * inconsistency, not a correctness problem.
     */
    await prisma.document.updateMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      data: { isLatest: false },
    });

    const newVersion = await prisma.document.create({
      data: {
        name: file.name,
        category: existing.category,
        fileKey,
        fileUrl: `/api/documents/placeholder`,
        fileSize,
        mimeType: file.type || "application/octet-stream",
        version: nextVersion,
        isLatest: true,
        projectId: existing.projectId,
        uploadedById: session.user.id,
        parentId: rootId,
      },
    });

    const updated = await prisma.document.update({
      where: { id: newVersion.id },
      data: { fileUrl: `/api/documents/${newVersion.id}` },
    });

    const uploadedBy = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, initials: true, avatarUrl: true },
    });

    return NextResponse.json(
      {
        ...updated,
        project: { id: existingProject.id, name: existingProject.name, sheetNo: existingProject.sheetNo },
        uploadedBy,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Document version upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Document upload failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existingProject = await prisma.project.findUnique({ where: { id: existing.projectId } });
  if (!existingProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessProject(session, existingProject)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rootId = existing.parentId ?? existing.id;
  const versions = await prisma.document.findMany({
    where: { OR: [{ id: rootId }, { parentId: rootId }] },
    orderBy: { version: "desc" },
  });

  const uploaderIds = [...new Set(versions.map((v) => v.uploadedById))];
  const uploaders = await prisma.user.findMany({
    where: { id: { in: uploaderIds } },
    select: { id: true, name: true, initials: true, avatarUrl: true },
  });
  const uploaderById = new Map(uploaders.map((u) => [u.id, u]));

  const versionsWithUploader = versions.map((v) => ({
    ...v,
    uploadedBy: uploaderById.get(v.uploadedById) ?? null,
  }));

  return NextResponse.json(versionsWithUploader);
}
