import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { authenticator } from "otplib";
import { z } from "zod";

const Schema = z.object({ code: z.string().length(6) });

/**
 * Requires a currently-valid TOTP code, not just a button click. Without
 * this, anyone with access to an already-authenticated browser session
 * (a shared computer, a stolen session cookie) could silently strip MFA
 * off an account with one request. Asking for a live code means whoever
 * disables it still has to prove they hold the authenticator device.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: "MFA is not enabled on this account." }, { status: 400 });
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const valid = authenticator.verify({ token: parsed.data.code, secret: user.mfaSecret });
  if (!valid) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  return NextResponse.json({ success: true });
}
