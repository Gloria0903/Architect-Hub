import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageStaff, isAdmin } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateTemporaryPassword, validatePassword } from "@/lib/password-policy";

const Schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "ARCHITECT"]),
  phone: z.string().optional(),
  department: z.string().optional(),
  password: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = isAdmin(session);

  // Non-admins still need id/name/initials/role — the rest of the app
  // resolves author names on daily logs, assigned-architect labels, etc.
  // from this list client-side, so it can't simply be admin-only.
  // What IS admin-only: contact details, account/activity metadata, and
  // per-person project/log counts — the counts specifically, because
  // summing (total staff − logs today) is exactly how "missing daily
  // report" gets inferred, and an architect shouldn't be able to derive
  // that about colleagues who aren't on their projects.
  const staff = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      initials: true,
      role: true,
      ...(admin && {
        email: true,
        phone: true,
        department: true,
        joinDate: true,
        lastLoginAt: true,
        isActive: true,
        mustResetPassword: true,
        _count: { select: { assignedProjects: true, dailyLogs: true } },
      }),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageStaff(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  let tempPassword: string | undefined;
  if (parsed.data.password) {
    const check = validatePassword(parsed.data.password);
    if (!check.valid) return NextResponse.json({ error: check.errors.join(" ") }, { status: 400 });
  } else {
    tempPassword = generateTemporaryPassword();
  }

  const initials = parsed.data.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hashedPassword = await bcrypt.hash(parsed.data.password ?? tempPassword!, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: parsed.data.role,
      phone: parsed.data.phone,
      department: parsed.data.department,
      initials,
      mustResetPassword: true,
    },
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, department: true, initials: true, joinDate: true,
      isActive: true, mustResetPassword: true,
    },
  });

  return NextResponse.json({ ...user, temporaryPassword: tempPassword }, { status: 201 });
}
