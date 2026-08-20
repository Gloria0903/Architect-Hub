import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  rateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { enqueueEmail } from "@/lib/queues/email-queue";

const RESET_TOKEN_TTL_MS =
  60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const limited = rateLimit(
    `forgot-password:${ip}`,
    5,
    15 * 60 * 1000
  );

  if (!limited.ok) {
    return NextResponse.json(
      {
        error:
          "Too many requests. Try again later.",
      },
      {
        status: 429,
      }
    );
  }

  const body =
    await req.json().catch(() => null);

  const email = (
    body?.email as
      | string
      | undefined
  )
    ?.trim()
    .toLowerCase();

  /*
   * Always return exactly the same response
   * whether the account exists or not.
   *
   * This prevents email/account enumeration.
   */
  const genericResponse =
    NextResponse.json({
      message:
        "If an account exists for that email, a reset link has been generated.",
    });

  if (!email) {
    return genericResponse;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (!user || !user.isActive) {
    return genericResponse;
  }

  /*
   * ---------------------------------------------------------------
   * INVALIDATE PREVIOUS RESET TOKENS
   * ---------------------------------------------------------------
   *
   * Only the newest password-reset request should remain valid.
   */
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },

    data: {
      usedAt: new Date(),
    },
  });

  /*
   * ---------------------------------------------------------------
   * GENERATE SECURE TOKEN
   * ---------------------------------------------------------------
   */

  const rawToken =
    crypto.randomBytes(32).toString("hex");

  /*
   * Never store the raw token in the database.
   */
  const tokenHash =
    crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,

      userId: user.id,

      expiresAt: new Date(
        Date.now() +
          RESET_TOKEN_TTL_MS
      ),
    },
  });

  /*
   * ---------------------------------------------------------------
   * BUILD RESET URL
   * ---------------------------------------------------------------
   */

  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(
      /\/$/,
      ""
    );

  if (!baseUrl) {
    console.error(
      "NEXTAUTH_URL is not configured."
    );

    /*
     * Do not expose configuration problems
     * to the user or leak whether the account exists.
     */
    return genericResponse;
  }

  const resetUrl =
    `${baseUrl}/reset-password?token=${rawToken}`;

  /*
   * ---------------------------------------------------------------
   * QUEUE EMAIL
   * ---------------------------------------------------------------
   */

  await enqueueEmail({
    kind: "PASSWORD_RESET",
    to: user.email,
    recipientName: user.name,
    resetUrl,
    expiresInMinutes:
      RESET_TOKEN_TTL_MS / 60_000,
  });

  return genericResponse;
}