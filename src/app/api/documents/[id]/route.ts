import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/rbac";
import { readStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documentProject = await prisma.project.findUnique({ where: { id: document.projectId } });
  if (!documentProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Client Portal sessions never reach this route — middleware.ts routes
  // them to /api/client-portal/documents/[id] instead, which enforces the
  // clientVisible flag. This route stays staff-only.
  if (!canAccessProject(session, documentProject)) {
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

/**
 * Only field this route supports changing today is clientVisible — the
 * flag that decides whether a document shows up in the Client Portal (see
 * /api/client-portal/documents/[id] and /api/client-portal/projects/[id]).
 * Anyone who can access the project can toggle it, same as who can upload
 * or delete a document — this isn't a more sensitive action than those.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documentProject = await prisma.project.findUnique({ where: { id: document.projectId } });
  if (!documentProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessProject(session, documentProject)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.clientVisible !== "boolean") {
    return NextResponse.json({ error: "clientVisible (boolean) is required" }, { status: 400 });
  }

  const updated = await prisma.document.update({
    where: { id },
    data: { clientVisible: body.clientVisible },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documentProject = await prisma.project.findUnique({ where: { id: document.projectId } });
  if (!documentProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessProject(session, documentProject)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete — architectural documents should never disappear entirely.
  // Take Over Project and audit history need to be able to reference them
  // even after a "delete" action.
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });

  return NextResponse.json({ success: true });
}
