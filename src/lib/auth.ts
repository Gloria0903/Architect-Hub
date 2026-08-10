import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const DEFAULT_SESSION_SECONDS = 8 * 60 * 60; // 8 hours
const REMEMBER_ME_SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days

class MfaRequiredError extends CredentialsSignin {
  code = "MFA_REQUIRED";
}
class AccountLockedError extends CredentialsSignin {
  code = "ACCOUNT_LOCKED";
}
class AccountInactiveError extends CredentialsSignin {
  code = "ACCOUNT_INACTIVE";
}

async function logLoginEvent(userId: string | null, success: boolean, reason: string) {
  try {
    await prisma.loginEvent.create({ data: { userId: userId ?? undefined, success, reason } });
  } catch {
    // Never let audit logging break the login flow itself.
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: DEFAULT_SESSION_SECONDS },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.initials = user.initials;
        const remember = (user as { remember?: boolean }).remember;
        if (remember) {
          token.exp = Math.floor(Date.now() / 1000) + REMEMBER_ME_SESSION_SECONDS;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "ARCHITECT";
        session.user.initials = token.initials as string;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text" },
        rememberMe: { label: "Remember me", type: "text" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await logLoginEvent(null, false, `unknown_email:${email}`);
          return null;
        }

        // Account lockout check
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          await logLoginEvent(user.id, false, "locked");
          throw new AccountLockedError();
        }

        if (!user.isActive) {
          await logLoginEvent(user.id, false, "inactive");
          throw new AccountInactiveError();
        }

        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: shouldLock ? 0 : attempts,
              lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
            },
          });
          await logLoginEvent(user.id, false, shouldLock ? "locked_out" : "bad_password");
          if (shouldLock) throw new AccountLockedError();
          return null;
        }

        // Password correct — check MFA before granting a session
        if (user.mfaEnabled && user.mfaSecret) {
          const code = (credentials?.mfaCode as string) || "";
          if (!code) {
            throw new MfaRequiredError();
          }
          const { authenticator } = await import("otplib");
          const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
          if (!valid) {
            await logLoginEvent(user.id, false, "bad_mfa");
            return null;
          }
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
        });
        await logLoginEvent(user.id, true, "success");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          initials: user.initials,
          remember: (credentials?.rememberMe as string) === "true",
        };
      },
    }),
  ],
});
