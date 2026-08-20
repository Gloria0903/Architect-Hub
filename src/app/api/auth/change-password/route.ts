import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/password-policy";
import {
  rateLimit,
  getClientIp,
} from "@/lib/rate-limit";

const Schema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required."),

  newPassword: z
    .string()
    .min(1, "New password is required."),
});

export async function POST(
  req: NextRequest
) {
  /*
   * ---------------------------------------------------------------
   * RATE LIMIT
   * ---------------------------------------------------------------
   */

  const ip = getClientIp(req);

  const limited = rateLimit(
    `change-password:${ip}`,
    10,
    15 * 60 * 1000
  );

  if (!limited.ok) {
    return NextResponse.json(
      {
        error:
          "Too many password-change attempts. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil(
              limited.retryAfterMs / 1000
            )
          ),
        },
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * AUTHENTICATION
   * ---------------------------------------------------------------
   */

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * READ REQUEST
   * ---------------------------------------------------------------
   */

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON request body.",
      },
      {
        status: 400,
      }
    );
  }

  const parsed =
    Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Current password and new password are required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    currentPassword,
    newPassword,
  } = parsed.data;

  /*
   * ---------------------------------------------------------------
   * PASSWORD POLICY
   * ---------------------------------------------------------------
   */

  const passwordCheck =
    validatePassword(newPassword);

  if (!passwordCheck.valid) {
    return NextResponse.json(
      {
        error:
          passwordCheck.errors.join(" "),
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * LOAD USER
   * ---------------------------------------------------------------
   */

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },

      select: {
        id: true,
        email: true,
        password: true,
        mustResetPassword: true,
        isActive: true,
        lockedUntil: true,
      },
    });

  if (!user || !user.isActive) {
    return NextResponse.json(
      {
        error:
          "Account is unavailable.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * Do not allow a locked account to change its password.
   */

  if (
    user.lockedUntil &&
    user.lockedUntil.getTime() >
      Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          "Account is temporarily locked. Please try again later.",
      },
      {
        status: 423,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * VERIFY CURRENT PASSWORD
   * ---------------------------------------------------------------
   */

  const currentPasswordValid =
    await bcrypt.compare(
      currentPassword,
      user.password
    );

  if (!currentPasswordValid) {
    return NextResponse.json(
      {
        error:
          "Current password is incorrect.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * PREVENT PASSWORD REUSE
   * ---------------------------------------------------------------
   */

  const samePassword =
    await bcrypt.compare(
      newPassword,
      user.password
    );

  if (samePassword) {
    return NextResponse.json(
      {
        error:
          "New password must be different from your current password.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ---------------------------------------------------------------
   * HASH PASSWORD
   * ---------------------------------------------------------------
   */

  const hashedPassword =
    await bcrypt.hash(
      newPassword,
      12
    );

  /*
   * ---------------------------------------------------------------
   * UPDATE ACCOUNT
   * ---------------------------------------------------------------
   *
   * This is the critical operation.
   *
   * Once the temporary password has been replaced:
   *
   *   mustResetPassword = false
   *
   * which releases the user from the forced reset state.
   */

  const updatedUser =
    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        password: hashedPassword,

        mustResetPassword: false,

        passwordChangedAt:
          new Date(),

        failedLoginAttempts: 0,

        lockedUntil: null,
      },

      select: {
        id: true,
        email: true,
        mustResetPassword: true,
      },
    });

  /*
   * ---------------------------------------------------------------
   * RESPONSE
   * ---------------------------------------------------------------
   */

  return NextResponse.json({
    success: true,

    message:
      "Password changed successfully.",

    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      mustResetPassword:
        updatedUser.mustResetPassword,
    },
  });
}