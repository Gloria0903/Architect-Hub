import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile, deleteStoredFile } from "@/lib/storage";
import { validateAvatarUpload, sniffDangerousSignature } from "@/lib/avatar-validation";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Layer 1: declared MIME type + size against the allow-list.
  const declaredCheck = validateAvatarUpload({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });
  if (!declaredCheck.ok) {
    return NextResponse.json({ error: declaredCheck.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Layer 2: actual file bytes, independent of whatever was declared.
  const sniffed = sniffDangerousSignature(buffer);
  if (sniffed.dangerous) {
    return NextResponse.json(
      { error: `This file's content looks like a ${sniffed.label}, which isn't allowed as a profile photo.` },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarKey: true },
  });

  const { fileKey } = await saveUploadedFile(file, buffer);

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      avatarKey: fileKey,
      avatarUrl: `/api/avatar/${session.user.id}?v=${fileKey}`,
    },
    select: { id: true, avatarUrl: true },
  });

  // Clean up the old file only after the new one is safely written and the
  // DB row updated — never delete-then-fail and leave the user with nothing.
  if (existing?.avatarKey) {
    await deleteStoredFile(existing.avatarKey);
  }

  return NextResponse.json(updated);
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarKey: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarKey: null, avatarUrl: null },
  });

  if (existing?.avatarKey) {
    await deleteStoredFile(existing.avatarKey);
  }

  return NextResponse.json({ success: true });
}
