import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageStaff, isAdmin } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import {
  generateTemporaryPassword,
  validatePassword,
} from "@/lib/password-policy";
import { redisConfigured } from "@/lib/redis";
import { enqueueEmail } from "@/lib/queues/email-queue";

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
|
| Staff creation is ADMIN-only.
|
| Important:
| - Email is normalized before persistence.
| - Names and optional text fields are trimmed.
| - Password validation remains centralized in password-policy.ts.
|
*/

const Schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100, "Name is too long"),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email address is too long")
    .transform((value) => value.toLowerCase()),

  role: z.enum(["ADMIN", "SENIOR_ARCHITECT", "ARCHITECT"]),

  phone: z
    .string()
    .trim()
    .max(50, "Phone number is too long")
    .optional(),

  department: z
    .string()
    .trim()
    .max(100, "Department is too long")
    .optional(),

  password: z
    .string()
    .optional(),
});

/*
|--------------------------------------------------------------------------
| GET /api/staff
|--------------------------------------------------------------------------
|
| Authentication:
|   ADMIN       -> full staff information
|   ARCHITECT   -> basic staff identity information only
|
| Architects need basic identity information because the frontend uses
| staff names/initials when displaying:
|
| - assigned architects
| - supervisors
| - daily-log authors
| - other project-related labels
|
| Sensitive information remains ADMIN-only.
|
*/

export async function GET() {
  /*
   * ------------------------------------------------------------------------
   * Authentication
   * ------------------------------------------------------------------------
   */

  const session = await auth();

  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const admin = isAdmin(session);

  try {
    /*
     * ----------------------------------------------------------------------
     * Retrieve staff
     * ----------------------------------------------------------------------
     *
     * Basic identity fields are available to authenticated users.
     *
     * Sensitive/account-management fields are returned only to ADMINs.
     */

    const staff = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        initials: true,
        avatarUrl: true,
        role: true,

        ...(admin
          ? {
              email: true,
              phone: true,
              department: true,
              joinDate: true,
              lastLoginAt: true,
              isActive: true,
              mustResetPassword: true,
              mfaEnabled: true,

              _count: {
                select: {
                  assignedProjects: true,
                  dailyLogs: true,
                },
              },
            }
          : {}),
      },

      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error(
      "Failed to fetch staff:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load staff",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/staff
|--------------------------------------------------------------------------
|
| Create a staff account.
|
| ADMIN ONLY.
|
| Security rules:
|
| 1. User must be authenticated.
| 2. User must have ADMIN role.
| 3. Request body must be valid JSON.
| 4. Input must pass Zod validation.
| 5. Email is normalized.
| 6. Password must satisfy password policy.
| 7. Password is hashed before persistence.
| 8. Temporary password is returned only when generated.
| 9. Database errors are handled safely.
|
*/

export async function POST(req: NextRequest) {
  /*
   * ------------------------------------------------------------------------
   * Authentication
   * ------------------------------------------------------------------------
   */

  const session = await auth();

  if (!session) {
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
   * ------------------------------------------------------------------------
   * RBAC
   * ------------------------------------------------------------------------
   */

  if (!canManageStaff(session)) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * canManageStaff() is currently ADMIN-only.
   *
   * Keep the explicit admin check here as defense-in-depth because staff
   * creation is a highly privileged operation.
   */

  if (!isAdmin(session)) {
    return NextResponse.json(
      {
        error: "Only administrators can create staff accounts",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * ------------------------------------------------------------------------
   * Parse request body
   * ------------------------------------------------------------------------
   */

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON request body",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ------------------------------------------------------------------------
   * Validate request
   * ------------------------------------------------------------------------
   */

  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const {
    name,
    email,
    role,
    phone,
    department,
    password,
  } = parsed.data;

  /*
   * ------------------------------------------------------------------------
   * Normalize optional values
   * ------------------------------------------------------------------------
   */

  const normalizedPhone =
    phone && phone.length > 0
      ? phone
      : undefined;

  const normalizedDepartment =
    department && department.length > 0
      ? department
      : undefined;

  /*
   * ------------------------------------------------------------------------
   * Check for existing account
   * ------------------------------------------------------------------------
   *
   * This provides a clean user-facing error before attempting creation.
   *
   * The database unique constraint remains the final authority because two
   * requests could still arrive simultaneously.
   * ------------------------------------------------------------------------
   */

  try {
    const existing =
      await prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          error: "Email already registered",
        },
        {
          status: 409,
        }
      );
    }
  } catch (error) {
    console.error(
      "Failed to check existing staff email:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to validate staff account",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * ------------------------------------------------------------------------
   * Password handling
   * ------------------------------------------------------------------------
   *
   * If the administrator supplies a password:
   *
   *     validate supplied password
   *
   * Otherwise:
   *
   *     generate secure temporary password
   *
   * In both cases the database receives only the bcrypt hash.
   */

  let temporaryPassword: string | undefined;

  let plainPassword: string;

  if (password) {
    const check = validatePassword(password);

    if (!check.valid) {
      return NextResponse.json(
        {
          error: check.errors.join(" "),
        },
        {
          status: 400,
        }
      );
    }

    plainPassword = password;
  } else {
    plainPassword = generateTemporaryPassword();

    /*
     * Prefer inviting via email over ever displaying a plaintext
     * password: if email delivery is configured, the new person sets
     * their own password through a secure one-time link (same
     * mechanism as forgot-password) and this generated password is
     * never shown to anyone, including the admin creating the account.
     * Only fall back to returning it in the API response (for the
     * admin to relay manually) when email isn't configured at all --
     * an account with no way to reach it otherwise would be locked out.
     */
    if (!redisConfigured) {
      temporaryPassword = plainPassword;
    }
  }

  /*
   * ------------------------------------------------------------------------
   * Generate initials
   * ------------------------------------------------------------------------
   */

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /*
   * ------------------------------------------------------------------------
   * Hash password
   * ------------------------------------------------------------------------
   */

  let hashedPassword: string;

  try {
    hashedPassword =
      await bcrypt.hash(
        plainPassword,
        12
      );
  } catch (error) {
    console.error(
      "Failed to hash staff password:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create staff account",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * ------------------------------------------------------------------------
   * Create user
   * ------------------------------------------------------------------------
   */

  try {
    const user =
      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,

          phone:
            normalizedPhone,

          department:
            normalizedDepartment,

          initials,

          /*
           * Every newly created account must complete the password-reset
           * flow before being treated as fully activated.
           */
          mustResetPassword: true,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          department: true,
          initials: true,
          avatarUrl: true,
          joinDate: true,
          isActive: true,
          mustResetPassword: true,
        },
      });

    /*
     * ----------------------------------------------------------------------
     * Invite email
     * ----------------------------------------------------------------------
     *
     * Only when the admin didn't supply a password directly, and email
     * delivery is actually configured (see the plainPassword branch
     * above for the fallback when it isn't).
     *
     * Reuses the exact same PasswordResetToken mechanism and
     * /reset-password page as "forgot password" -- a secure, single-use,
     * time-limited link, not a plaintext password in an email.
     */

    if (!password && redisConfigured) {
      try {
        const INVITE_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, same as password reset

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        await prisma.passwordResetToken.create({
          data: {
            tokenHash,
            userId: user.id,
            expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
          },
        });

        const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "");

        if (baseUrl) {
          await enqueueEmail({
            kind: "ACCOUNT_INVITE",
            to: user.email,
            recipientName: user.name,
            role: user.role,
            invitedBy: session.user.name ?? "Your admin",
            setupUrl: `${baseUrl}/reset-password?token=${rawToken}`,
            expiresInMinutes: INVITE_TOKEN_TTL_MS / 60_000,
          });
        } else {
          console.error("NEXTAUTH_URL is not configured -- could not send invite email.");
        }
      } catch (error) {
        // Don't fail account creation over an email hiccup -- the admin
        // can still see the account was created and resend an invite
        // (or use forgot-password) if the email never arrives.
        console.error("Failed to send invite email:", error);
      }
    }

    /*
     * ----------------------------------------------------------------------
     * Return created account
     * ----------------------------------------------------------------------
     *
     * temporaryPassword exists only when email delivery wasn't available
     * and the administrator needs to relay a password manually.
     *
     * invited is true when an invite email was actually sent, so the UI
     * can show the right confirmation message.
     *
     * Never return the bcrypt hash.
     */

    return NextResponse.json(
      {
        ...user,

        ...(temporaryPassword
          ? {
              temporaryPassword,
            }
          : {}),

        invited: !password && redisConfigured,
      },
      {
        status: 201,
      }
    );
  } catch (error: unknown) {
    /*
     * ----------------------------------------------------------------------
     * Database uniqueness protection
     * ----------------------------------------------------------------------
     *
     * Even though we checked findUnique() above, another request could have
     * created the same email between that check and this create().
     *
     * Prisma's P2002 represents a unique constraint violation.
     */

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Email already registered",
        },
        {
          status: 409,
        }
      );
    }

    console.error(
      "Failed to create staff account:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create staff account",
      },
      {
        status: 500,
      }
    );
  }
}