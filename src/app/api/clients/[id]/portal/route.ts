import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/rbac";
import { validatePassword, generateTemporaryPassword } from "@/lib/password-policy";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({
  portalEnabled: z.boolean(),
  // Omit to leave the existing password untouched (e.g. just toggling
  // access off/on again). Send to (re)set it — blank string means
  // "generate one for me", same convention as the staff password fields.
  password: z.string().optional(),
});

/**
 * Enabling the portal without an email on file is a dead end (email is
 * the login identifier for the client-side authorize() branch in
 * auth.ts), so this route enforces that up front rather than letting an
 * admin flip the toggle and wonder why the client can't log in.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.portalEnabled && !client.email) {
    return NextResponse.json({ error: "Add a client email address before enabling portal access." }, { status: 400 });
  }

  let temporaryPassword: string | undefined;
  let passwordHash = client.passwordHash;

  if (parsed.data.password !== undefined) {
    const plain = parsed.data.password || generateTemporaryPassword();
    const check = validatePassword(plain);
    if (!check.valid) {
      return NextResponse.json({ error: check.errors.join(" ") }, { status: 400 });
    }
    passwordHash = await bcrypt.hash(plain, 12);
    if (!parsed.data.password) temporaryPassword = plain; // only return it when we generated it
  }

  const updated = await prisma.client.update({
    where: { id },
    data: { portalEnabled: parsed.data.portalEnabled, passwordHash },
  });

  return NextResponse.json({
    portalEnabled: updated.portalEnabled,
    hasPassword: Boolean(updated.passwordHash),
    temporaryPassword,
  });
}
