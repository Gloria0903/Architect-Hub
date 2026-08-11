import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  // Any authenticated user can view any other user's avatar — these render
  // in shared spaces (staff list, log/comment author bubbles, project rows)
  // that already cut across role/project boundaries, so this isn't scoped
  // by canAccessProject the way document downloads are.
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarKey: true },
  });
  if (!user?.avatarKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readStoredFile(user.avatarKey);
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 410 });
  }

  const ext = user.avatarKey.slice(user.avatarKey.lastIndexOf(".")).toLowerCase();
  const mimeType = EXT_TO_MIME[ext] || "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
