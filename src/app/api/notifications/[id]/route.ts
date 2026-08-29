import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/notifications/[id] — mark as read
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // updateMany + userId filter (rather than update by id alone) so a user
    // can never mark someone else's notification as read by guessing an id.
    const result = await prisma.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to mark notification ${id} as read:`, error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
