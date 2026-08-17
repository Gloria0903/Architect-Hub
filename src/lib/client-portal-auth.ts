import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Every /api/client-portal/* route calls this first. Returns the client's
 * id when the session is a valid, still-enabled portal login — null
 * otherwise, in which case the route must respond 401/403 itself. This is
 * the server-side gate; middleware.ts blocks non-portal paths for clients
 * but every route here re-checks independently rather than trusting that.
 */
export async function requireClientSession(): Promise<{ session: Session; clientId: string } | null> {
  const session = await auth();
  if (!session || session.user.role !== "CLIENT" || !session.user.clientId) return null;

  // Re-check portalEnabled live (not just from the JWT) — an admin may have
  // revoked portal access after this token was issued.
  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { id: true, portalEnabled: true },
  });
  if (!client || !client.portalEnabled) return null;

  return { session, clientId: client.id };
}
