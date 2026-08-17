import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageFirmSettings } from "@/lib/rbac";
import { z } from "zod";

const SINGLETON_ID = "singleton";
const DEFAULT_FIRM_NAME = "Architect Hub";

const Schema = z.object({
  firmName: z.string().trim().min(1, "Firm name can't be empty").max(80),
});

/**
 * Firm branding is a single row (`FirmSettings.id === "singleton"`),
 * upserted lazily. GET is intentionally public (no auth check) — the
 * *unauthenticated* login page needs to render the firm name too — but
 * only an admin can change it (see the PATCH handler and rbac.ts). Nothing
 * about a firm's display name is sensitive.
 */
export async function GET() {
  const settings = await prisma.firmSettings.findUnique({ where: { id: SINGLETON_ID } });
  return NextResponse.json({ firmName: settings?.firmName ?? DEFAULT_FIRM_NAME });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageFirmSettings(session)) {
    return NextResponse.json({ error: "Only an admin can change firm settings" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const settings = await prisma.firmSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, firmName: parsed.data.firmName },
    update: { firmName: parsed.data.firmName },
  });

  return NextResponse.json({ firmName: settings.firmName });
}
