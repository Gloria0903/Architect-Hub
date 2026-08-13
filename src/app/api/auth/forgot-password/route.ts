import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { enqueueEmail } from "@/lib/queues/email-queue";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to enumerate valid accounts.
  const genericResponse = NextResponse.json({
    message: "If an account exists for that email, a reset link has been generated.",
  });

  if (!email) return genericResponse;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return genericResponse;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL || ""}/reset-password?token=${rawToken}`;

  await enqueueEmail({
    kind: "PASSWORD_RESET",
    to: user.email,
    recipientName: user.name,
    resetUrl,
    expiresInMinutes: RESET_TOKEN_TTL_MS / 60_000,
  });

  return genericResponse;
}
