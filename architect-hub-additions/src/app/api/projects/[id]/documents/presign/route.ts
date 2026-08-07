import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { validateDocumentUpload } from "@/lib/document-validation";
import { buildDocumentKey, getUploadUrl } from "@/lib/s3";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  const allowed = await canAccessProject(
    { id: session.user.id, role: session.user.role },
    projectId
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
