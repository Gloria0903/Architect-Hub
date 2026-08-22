import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { authenticator } from "otplib";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const Schema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

/**
 * The only place mfaEnabled/mfaSecret actually get written. Requires a
 * real, currently-valid code generated from this exact secret â€” proof
 * the QR was scanned correctly â€” before turning MFA on. This is what
 * guarantees nobody can lock themselves out of their own account: if the
 * scan didn't work, this call fails and the account is untouched.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A 6-digit TOTP code is brute-forceable (1M combinations) if left
  // unlimited. Keyed by user id (not just IP) since this is a session-gated
  // endpoint â€” one legitimate user shouldn't be able to hammer their own
  // code endlessly either.
  const limited = rateLimit(`mfa-confirm:${session.user.id}:${getClientIp(req)}`, 5, 5 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const valid = authenticator.verify({
    token: parsed.data.code,
    secret: parsed.data.secret,
  });

  if (!valid) {
    return NextResponse.json(
      { error: "That code doesn't match. Check your authenticator app and try again." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: true, mfaSecret: parsed.data.secret },
  });

  return NextResponse.json({ success: true });
}
