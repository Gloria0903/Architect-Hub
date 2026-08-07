import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { validatePassword, generateTemporaryPassword } from "@/lib/password-policy";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isSelf = id === session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Only admins can change role, email, department, or active status.
  if (!isAdmin && (body.role || body.email || body.department !== undefined || body.isActive !== undefined)) {
    return NextResponse.json({ error: "Only an admin can change role, email, department, or active status" }, { status: 403 });
  }

  // Prevent an admin from locking themselves out entirely.
  if (isAdmin && isSelf && body.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const initials = body.name
    ? body.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : undefined;

  let hashedPassword: string | undefined;
  let generatedPassword: string | undefined;
  let mustResetPassword: boolean | undefined;

  if (body.password) {
    if (isSelf && !isAdmin) {
      // Self-service password change must prove the current password first.
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!body.currentPassword || !(await bcrypt.compare(body.currentPassword, existing.password))) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }
    const check = validatePassword(body.password);
    if (!check.valid) return NextResponse.json({ error: check.errors.join(" ") }, { status: 400 });
    hashedPassword = await bcrypt.hash(body.password, 12);
    mustResetPassword = false;
  } else if (isAdmin && body.resetPassword === true) {
    // Admin-triggered reset: generate a fresh temp password, force change on next login.
    generatedPassword = generateTemporaryPassword();
    hashedPassword = await bcrypt.hash(generatedPassword, 12);
    mustResetPassword = true;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name, initials }),
      ...(isAdmin && body.email && { email: body.email }),
      ...(isAdmin && body.role && { role: body.role }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(isAdmin && body.department !== undefined && { department: body.department }),
      ...(isAdmin && body.isActive !== undefined && { isActive: body.isActive }),
      ...(hashedPassword && { password: hashedPassword, passwordChangedAt: new Date() }),
      ...(mustResetPassword !== undefined && { mustResetPassword }),
      ...(hashedPassword && { failedLoginAttempts: 0, lockedUntil: null }),
    },
    select: {
      id: true, name: true, email: true, role: true, phone: true, department: true,
      initials: true, isActive: true, mustResetPassword: true,
    },
  });

  return NextResponse.json({ ...user, temporaryPassword: generatedPassword });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
