import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin, canAccessProject } from "@/lib/rbac";
import { saveUploadedFile } from "@/lib/storage";
import { validateDocumentUpload, sniffDangerousSignature } from "@/lib/document-validation";
import { notifyDocumentUploaded } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const documents = await prisma.document.findMany({
    where: {
      ...(projectId && { projectId }),
      isLatest: true,
      deletedAt: null,
      ...(!isAdmin(session) && {
        project: { OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }] },
      }),
    },
    include: {
      project: { select: { id: true, name: true, sheetNo: true } },
      uploadedBy: { select: { id: true, name: true, initials: true } },
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
  const category = formData.get("category");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // Layer 1: declared MIME type + extension against the allow-list.
  const declaredCheck = validateDocumentUpload({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });
  if (!declaredCheck.ok) {
    return NextResponse.json({ error: declaredCheck.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Layer 2: actual file bytes, independent of whatever was declared. This
  // is the check that would have caught a renamed/mislabeled .exe.
  const sniffed = sniffDangerousSignature(buffer);
  if (sniffed.dangerous) {
    return NextResponse.json(
      { error: `This file's content looks like a ${sniffed.label}, which isn't an allowed document type.` },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!canAccessProject(session, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const validCategories = ["DRAWING", "BOQ", "CONTRACT", "SITE_REPORT", "PRESENTATION", "OTHER"];
  const resolvedCategory = typeof category === "string" && validCategories.includes(category) ? category : "OTHER";

  const { fileKey, fileSize } = await saveUploadedFile(file, buffer);

  const document = await prisma.document.create({
    data: {
      name: file.name,
      category: resolvedCategory as never,
      fileKey,
      fileUrl: `/api/documents/placeholder`,
      fileSize,
      mimeType: file.type || "application/octet-stream",
      projectId,
      uploadedById: session.user.id,
    },
    include: {
      project: { select: { id: true, name: true, sheetNo: true } },
      uploadedBy: { select: { id: true, name: true, initials: true } },
    },
  });

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { fileUrl: `/api/documents/${document.id}` },
    include: {
      project: { select: { id: true, name: true, sheetNo: true } },
      uploadedBy: { select: { id: true, name: true, initials: true } },
    },
  });

  const notifyRecipients = [project.architectId, project.supervisorId].filter(
    (uid): uid is string => Boolean(uid) && uid !== session.user.id
  );
  await Promise.all(
    [...new Set(notifyRecipients)].map((userId) =>
      notifyDocumentUploaded({
        userId,
        projectId: project.id,
        projectName: `${project.name} (${project.sheetNo})`,
        documentName: file.name,
        uploadedByName: session.user.name ?? "A team member",
      })
    )
  );

  return NextResponse.json(updated, { status: 201 });
}
