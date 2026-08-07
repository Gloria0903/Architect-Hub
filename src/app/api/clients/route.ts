import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/rbac";
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

  const clients = await prisma.client.findMany({
    include: {
      projects: {
        select: { id: true, sheetNo: true, name: true, status: true, progress: true },
      },
      _count: { select: { projects: true, comments: true } },
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
