import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients, isAdmin } from "@/lib/rbac";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  contactPerson: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.contactPerson && { contactPerson: data.contactPerson }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
    },
  });

  return NextResponse.json(client);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const projectCount = await prisma.project.count({ where: { clientId: id } });
  if (projectCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a client with existing projects. Delete or reassign their projects first." },
      { status: 409 }
    );
  }

  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
