import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

/**
 * Permanently and irreversibly deletes a project and everything attached
 * to it -- daily logs, documents, payments, invoices, client comments,
 * tasks, milestones, phases, assignment history. All of that cascades
 * automatically via the FK constraints already defined in schema.prisma
 * (Cascade on every projectId relation) once prisma.project.delete()
 * actually runs.
 *
 * This is deliberately much harder to trigger by accident than the
 * existing DELETE /api/projects/[id], which only archives (soft-delete,
 * fully reversible via /unarchive):
 *
 *   1. The project must already be archived first -- no direct path from
 *      an active project straight to permanent deletion.
 *   2. The request body must include the project's exact sheetNo as
 *      confirmation, not just an admin session -- protects against a
 *      misclick or a stray API call, mirroring the "type the repo name"
 *      pattern used by GitHub/etc. for equally irreversible actions.
 *
 * Note: this does NOT delete the underlying files from S3 -- Document
 * rows referencing S3 keys are removed from the database, but the
 * objects themselves are left in the bucket. Acceptable tradeoff here
 * (avoids this endpoint also depending on S3 being reachable to
 * complete a database operation), but means orphaned S3 objects will
 * accumulate for permanently-deleted projects. Worth a periodic S3
 * lifecycle/cleanup policy if that matters at your storage volume.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json(
      { error: "Only administrators can permanently delete a project" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, sheetNo: true, archivedAt: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!existing.archivedAt) {
    return NextResponse.json(
      { error: "Only an archived project can be permanently deleted. Archive it first." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const confirmSheetNo = (body?.confirmSheetNo as string | undefined)?.trim();

  if (confirmSheetNo !== existing.sheetNo) {
    return NextResponse.json(
      { error: "Confirmation text does not match the project's sheet number." },
      { status: 400 }
    );
  }

  try {
    await prisma.project.delete({ where: { id } });
  } catch (error) {
    console.error("Failed to permanently delete project:", error);
    return NextResponse.json(
      { error: "Failed to permanently delete project" },
      { status: 500 }
    );
  }

  try {
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        message: `Project "${existing.name}" (${existing.sheetNo}) was permanently deleted`,
        type: "SUCCESS",
      },
    });
  } catch (error) {
    console.error("Permanent-delete notification failed:", error);
  }

  return NextResponse.json({ success: true });
}
