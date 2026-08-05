import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "SENIOR_ARCHITECT", "ARCHITECT"]),
  phone: z.string().optional(),
  department: z.string().optional(),
  password: z.string().min(8).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staff = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, department: true, initials: true,
      joinDate: true, lastLoginAt: true,
      _count: {
        select: {
          assignedProjects: true,
          dailyLogs: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const initials = parsed.data.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hashedPassword = await bcrypt.hash(parsed.data.password ?? "TempPass123!", 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: parsed.data.role,
      phone: parsed.data.phone,
      department: parsed.data.department,
      initials,
    },
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, department: true, initials: true, joinDate: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
