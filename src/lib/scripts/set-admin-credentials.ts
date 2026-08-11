/**
 * Creates (or fixes) one real admin account you control, independent of
 * prisma/seed.ts's demo data. Run this once to get your first legitimate
 * login, then create every other user, client, and project through the
 * actual app UI as that admin — not through re-seeding.
 *
 * Usage:
 *   npx tsx scripts/set-admin-credentials.ts you@yourrealdomain.com "a-strong-real-password" "Your Name"
 *
 * Safe to re-run: if the email already exists, this just resets its
 * password/role/lockout state rather than erroring. Also clears MFA and
 * any lockout on that account, in case that's what's actually blocking
 * you right now.
 */
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";

async function main() {
  const [, , email, password, name] = process.argv;

  if (!email || !password) {
    console.error(
      'Usage: npx tsx scripts/set-admin-credentials.ts <email> <password> ["Full Name"]'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password should be at least 8 characters — this becomes your real login.");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12); // same cost factor as src/app/api/staff/route.ts
  const displayName = name ?? email.split("@")[0];
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      mustResetPassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
    },
    create: {
      email,
      password: hashedPassword,
      name: displayName,
      role: "ADMIN",
      initials,
      isActive: true,
      mustResetPassword: false,
    },
  });

  console.log(`✅ Admin ready — log in with: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());