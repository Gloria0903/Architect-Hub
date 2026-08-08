const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "centimaxofficework@gmail.com";
  const password = "Centimax@Admin2026!";

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { email },
    data: {
      password: hash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
    },
  });

  console.log("=================================");
  console.log("ADMIN PASSWORD RESET SUCCESSFUL");
  console.log("=================================");
  console.log("Email:", user.email);
  console.log("Role:", user.role);
  console.log("Password:", password);
  console.log("=================================");
}

main()
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
