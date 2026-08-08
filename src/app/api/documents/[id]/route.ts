import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";
import { readStoredFile } from "@/lib/storage";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessProject(session, document.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await readStoredFile(document.fileKey);
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 410 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(document.name)}"`,
      "Content-Length": String(document.fileSize),
    },
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id }, include: { project: true } });
  if (!document || document.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessProject(session, document.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete — architectural documents should never disappear entirely.
  // Take Over Project and audit history need to be able to reference them
  // even after a "delete" action.
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });

  return NextResponse.json({ success: true });
}
