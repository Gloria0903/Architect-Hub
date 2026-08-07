import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.initials = user.initials;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "SENIOR_ARCHITECT" | "ARCHITECT";
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!passwordValid) return null;

        // Only check MFA if the user has it explicitly enabled
        if (user.mfaEnabled && user.mfaSecret) {
          const { authenticator } = await import("otplib");
          const code = (credentials.mfaCode as string) || "";
          if (!code) return null;
          const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
          if (!valid) return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          initials: user.initials,
        };
      },
    }),
  ],
});
