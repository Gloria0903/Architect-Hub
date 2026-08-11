import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients, isAdmin } from "@/lib/rbac";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = isAdmin(session);
  // Architects/supervisors only see clients they actually work with — a
  // client whose projects they have no involvement in shouldn't appear at
  // all, not even in a trimmed-down form.
  const projectScope = { OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }] };

  const clients = await prisma.client.findMany({
    where: admin ? {} : { projects: { some: projectScope } },
    include: {
      projects: {
        select: { id: true, sheetNo: true, name: true, status: true, progress: true },
        ...(admin ? {} : { where: projectScope }),
      },
      _count: {
        select: {
          projects: admin ? true : { where: projectScope },
          comments: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      contactPerson: parsed.data.contactPerson,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      address: parsed.data.address,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
