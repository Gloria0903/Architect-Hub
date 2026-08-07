import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin, canAccessProject } from "@/lib/rbac";
import { saveUploadedFile } from "@/lib/storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const documents = await prisma.document.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(!isAdmin(session) && {
        project: { OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }] },
      }),
    },
    include: {
      project: { select: { id: true, name: true, sheetNo: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!canAccessProject(session, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileKey, fileSize } = await saveUploadedFile(file);

  const document = await prisma.document.create({
    data: {
      name: file.name,
      fileKey,
      fileUrl: `/api/documents/${fileKey}`, // placeholder, replaced with real id below
      fileSize,
      mimeType: file.type || "application/octet-stream",
      projectId,
      uploadedById: session.user.id,
    },
    include: { project: { select: { id: true, name: true, sheetNo: true } } },
  });

  // Fix fileUrl to point at the document's real download endpoint now that we have its id.
  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { fileUrl: `/api/documents/${document.id}` },
    include: { project: { select: { id: true, name: true, sheetNo: true } } },
  });

  return NextResponse.json(updated, { status: 201 });
}
