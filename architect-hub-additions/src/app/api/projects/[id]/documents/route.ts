import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/project-access";
import { validateDocumentUpload } from "@/lib/document-validation";
import { getDownloadUrl } from "@/lib/s3";

// GET /api/projects/[id]/documents?category=DRAWING
// Returns the latest version of every (non-deleted) document in the project.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const category = req.nextUrl.searchParams.get("category");
  const search = req.nextUrl.searchParams.get("q");

  const documents = await prisma.document.findMany({
    where: {
      projectId,
      isLatest: true,
      deletedAt: null,
      ...(category ? { category: category as never } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: {
      uploadedBy: { select: { id: true, name: true, initials: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });

  // versionCount = the number of prior versions PLUS this one. Documents with
  // no history (freshly created) will have _count.versions === 0.
  const withPreviewUrls = await Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      previewUrl: await getDownloadUrl(doc.fileKey, doc.name),
      versionCount: doc._count.versions + 1,
    }))
  );

  return NextResponse.json({ documents: withPreviewUrls });
}

// POST /api/projects/[id]/documents
// Confirms a completed S3 upload and creates the root Document row (v1).
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
  const { key, name, mimeType, fileSize, category } = body ?? {};

  if (!key || !name || !mimeType || typeof fileSize !== "number") {
    return NextResponse.json(
      { error: "key, name, mimeType, and fileSize are required" },
      { status: 400 }
    );
  }

  // Re-validate server-side. The presign step already checked this, but the
  // client could in theory call this endpoint directly with a fabricated key.
  const validation = validateDocumentUpload({ fileName: name, mimeType, sizeBytes: fileSize });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  // Defense in depth: the key must actually belong to this project's prefix.
  if (!key.startsWith(`projects/${projectId}/documents/`)) {
    return NextResponse.json({ error: "Upload key does not match this project" }, { status: 400 });
  }

  const document = await prisma.document.create({
    data: {
      name,
      category: category ?? "OTHER",
      fileKey: key,
      fileUrl: key, // resolved to a signed URL on read; never stored as a public URL
      fileSize,
      mimeType,
      version: 1,
      isLatest: true,
      projectId,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
