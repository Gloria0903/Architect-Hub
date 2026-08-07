import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/project-access";
import { validateDocumentUpload } from "@/lib/document-validation";
import { buildDocumentKey, getUploadUrl } from "@/lib/s3";

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

  const existing = await prisma.document.findUnique({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.fileName || !body?.contentType || typeof body?.sizeBytes !== "number") {
    return NextResponse.json(
      { error: "fileName, contentType, and sizeBytes are required" },
      { status: 400 }
    );
  }

  const validation = validateDocumentUpload({
    fileName: body.fileName,
    mimeType: body.contentType,
    sizeBytes: body.sizeBytes,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const key = buildDocumentKey(projectId, body.fileName);
  const uploadUrl = await getUploadUrl({
    key,
    contentType: body.contentType,
    contentLength: body.sizeBytes,
  });

  return NextResponse.json({ uploadUrl, key });
}
