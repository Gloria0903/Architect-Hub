import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

/**
 * Reverses DELETE /api/projects/[id] (which soft-deletes via archivedAt —
 * see that route). Without this, archiving is a one-way door: the normal
 * PATCH handler explicitly refuses to touch an archived project, and there
 * was previously no way back short of a direct database edit.
 */
export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!existing.archivedAt) {
    return NextResponse.json({ error: "Project is not archived" }, { status: 400 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: { archivedAt: null },
    select: { id: true, name: true, sheetNo: true, archivedAt: true },
  });

  try {
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        message: `Project "${project.name}" (${project.sheetNo}) has been restored from the archive`,
        type: "SUCCESS",
      },
    });
  } catch (error) {
    console.error("Unarchive notification failed:", error);
  }

  return NextResponse.json({ success: true, archived: false, project });
}
