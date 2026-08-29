import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-portal-auth";
import { readStoredFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document || document.deletedAt || !document.clientVisible) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const documentProject = await prisma.project.findUnique({ where: { id: document.projectId } });

  // Same rule as the client-portal project detail route: their own
  // project only, and only documents staff explicitly flagged visible.
  if (!documentProject || documentProject.clientId !== ctx.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
