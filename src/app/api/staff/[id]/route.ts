import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const initials = body.name
    ? body.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name, initials }),
      ...(body.email && { email: body.email }),
      ...(body.role && { role: body.role }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.department !== undefined && { department: body.department }),
    },
    select: { id: true, name: true, email: true, role: true, phone: true, department: true, initials: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
