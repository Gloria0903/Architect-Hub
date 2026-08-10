import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Fetched fresh from the database rather than assumed present in the
 * session/JWT — mfaEnabled may not be one of the fields your session
 * callback in lib/auth.ts currently exposes, and this avoids depending
 * on that either way.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabled: true },
  });

  return NextResponse.json({ mfaEnabled: user?.mfaEnabled ?? false });
}
