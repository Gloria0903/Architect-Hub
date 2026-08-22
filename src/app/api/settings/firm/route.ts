import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageFirmSettings } from "@/lib/rbac";
import { z } from "zod";

const SINGLETON_ID = "singleton";
const DEFAULTS = {
  firmName: "Architect Hub",
  country: "Kenya",
  currency: "KES",
  timezone: "Africa/Nairobi",
  requireMfa: false,
};

const Schema = z.object({
  firmName: z.string().trim().min(1, "Firm name can't be empty").max(80),
  country: z.string().trim().min(1, "Country can't be empty").max(80),
  currency: z.string().trim().min(1, "Currency can't be empty").max(10),
  timezone: z.string().trim().min(1, "Timezone can't be empty").max(80),
  requireMfa: z.boolean().optional(),
});

/**
 * Firm profile is a single row (`FirmSettings.id === "singleton"`),
 * upserted lazily. GET is intentionally public (no auth check) — the
 * *unauthenticated* login page needs to render the firm name too — but
 * only an admin can change any of it (see the PATCH handler and rbac.ts).
 * Nothing in this record is sensitive.
 */
export async function GET() {
  const settings = await prisma.firmSettings.findUnique({ where: { id: SINGLETON_ID } });
  return NextResponse.json({
    firmName: settings?.firmName ?? DEFAULTS.firmName,
    country: settings?.country ?? DEFAULTS.country,
    currency: settings?.currency ?? DEFAULTS.currency,
    timezone: settings?.timezone ?? DEFAULTS.timezone,
    requireMfa: settings?.requireMfa ?? DEFAULTS.requireMfa,
  });
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

  const { firmName, country, currency, timezone, requireMfa } = parsed.data;

  const settings = await prisma.firmSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, firmName, country, currency, timezone, ...(requireMfa !== undefined && { requireMfa }) },
    update: { firmName, country, currency, timezone, ...(requireMfa !== undefined && { requireMfa }) },
  });

  return NextResponse.json({
    firmName: settings.firmName,
    country: settings.country,
    currency: settings.currency,
    timezone: settings.timezone,
    requireMfa: settings.requireMfa,
  });
}
