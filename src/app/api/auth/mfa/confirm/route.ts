import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { authenticator } from "otplib";
import { z } from "zod";

const Schema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

/**
 * The only place mfaEnabled/mfaSecret actually get written. Requires a
 * real, currently-valid code generated from this exact secret — proof
 * the QR was scanned correctly — before turning MFA on. This is what
 * guarantees nobody can lock themselves out of their own account: if the
 * scan didn't work, this call fails and the account is untouched.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
