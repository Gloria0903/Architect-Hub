import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/project-access";

// GET /api/documents/[id] — single document with a fresh presigned preview URL
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

  const document = await prisma.document.findUnique({
    where: { id, deletedAt: null },
    include: { uploadedBy: { select: { id: true, name: true, initials: true } } },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { getDownloadUrl } = await import("@/lib/s3");
  const previewUrl = await getDownloadUrl(document.fileKey, document.name);

  return NextResponse.json({ document: { ...document, previewUrl } });
}

// DELETE /api/documents/[id] — soft delete. Only Admins and the document's
// uploader can delete; architectural records should never vanish silently,
// so this never touches the S3 object (see lib/s3.ts:deleteObject) — actual
// storage cleanup should be a separate, deliberate retention-policy job,
// not an accidental side effect of a click.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, projectId: true, uploadedById: true, deletedAt: true },
  });

  if (!document || document.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { allowed } = await canAccessDocument(
    { id: session.user.id, role: session.user.role },
    id
  );
  const isOwner = document.uploadedById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  if (!allowed || !(isOwner || isAdmin)) {
    return NextResponse.json(
      { error: "Only an admin or the person who uploaded this document can remove it" },
      { status: 403 }
    );
  }

  await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
