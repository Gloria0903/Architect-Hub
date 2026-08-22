import { prisma } from "./prisma";

export type SessionUser = { id: string; role: "ADMIN" | "SENIOR_ARCHITECT" | "ARCHITECT" };

/**
 * A user can access a project's documents if they're an Admin, a Senior
 * Architect (firm-wide oversight), the assigned architect, or the
 * supervisor. Adjust here if Phase 2 adds team-based access — this is the
 * single choke point, so callers never need to duplicate the rule.
 */
export async function canAccessProject(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "SENIOR_ARCHITECT") return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { architectId: true, supervisorId: true },
  });

  if (!project) return false;
  return project.architectId === user.id || project.supervisorId === user.id;
}

/**
 * Same rule, but resolved from a document's owning project. Used by
 * document-scoped routes (`/api/documents/[id]/...`) that don't already
 * have the projectId in the URL.
 */
export async function canAccessDocument(user: SessionUser, documentId: string): Promise<{ allowed: boolean; projectId: string | null }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { projectId: true },
  });
  if (!doc) return { allowed: false, projectId: null };
  const allowed = await canAccessProject(user, doc.projectId);
  return { allowed, projectId: doc.projectId };
}
