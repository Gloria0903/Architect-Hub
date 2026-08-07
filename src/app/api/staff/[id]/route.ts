import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

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

  // Only admins can change role, email, or department. Anyone can update their own name/phone.
  if (!isAdmin && (body.role || body.email || body.department !== undefined)) {
    return NextResponse.json({ error: "Only an admin can change role, email, or department" }, { status: 403 });
  }

  const initials = body.name
    ? body.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : undefined;

  const hashedPassword = body.password ? await bcrypt.hash(body.password, 12) : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name, initials }),
      ...(isAdmin && body.email && { email: body.email }),
      ...(isAdmin && body.role && { role: body.role }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(isAdmin && body.department !== undefined && { department: body.department }),
      ...(hashedPassword && { password: hashedPassword }),
    },
    select: { id: true, name: true, email: true, role: true, phone: true, department: true, initials: true },
  });

  return NextResponse.json(user);
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
