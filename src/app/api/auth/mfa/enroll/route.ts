import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authenticator } from "otplib";
import QRCode from "qrcode";

/**
 * Generates a fresh TOTP secret and its QR code. Deliberately does NOT
 * write anything to the database — the secret only exists in the
 * response, held client-side until /confirm proves the user actually
 * scanned it correctly. If the user abandons setup partway through, the
 * unconfirmed secret is simply discarded; nothing was ever persisted for
 * it, so there's no cleanup needed and no way to end up in a half-enabled
 * state.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = authenticator.generateSecret();
  const label = session.user.email ?? session.user.id;
  const otpauthUrl = authenticator.keyuri(label, "Architect Hub", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ secret, qrDataUrl });
}
