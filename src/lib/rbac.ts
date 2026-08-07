import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";

/**
 * Role-based access control helpers.
 *
 * Rules:
 *  - ADMIN: full access to everything.
 *  - SENIOR_ARCHITECT: access to projects they are the architect OR supervisor on.
 *  - ARCHITECT: access to projects they are the architect on.
 */

export function isAdmin(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canManageStaff(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canManageClients(session: Session): boolean {
  return session.user.role === "ADMIN" || session.user.role === "SENIOR_ARCHITECT";
}

export function canCreateProjects(session: Session): boolean {
  return session.user.role === "ADMIN" || session.user.role === "SENIOR_ARCHITECT";
}

/** Prisma `where` clause fragment that scopes projects to what this user may see. */
export function projectAccessWhere(session: Session): Prisma.ProjectWhereInput {
  if (isAdmin(session)) return {};
  return {
    OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }],
  };
}

/** Whether the given project's architect/supervisor ids mean this user can access it. */
export function canAccessProject(
  session: Session,
  project: { architectId?: string | null; supervisorId?: string | null }
): boolean {
  if (isAdmin(session)) return true;
  return project.architectId === session.user.id || project.supervisorId === session.user.id;
}

/** Prisma `where` clause fragment scoping a project-linked resource (logs, documents, comments, payments) by role. */
export function relatedProjectAccessWhere(session: Session): Prisma.ProjectWhereInput | undefined {
  if (isAdmin(session)) return undefined;
  return {
    OR: [{ architectId: session.user.id }, { supervisorId: session.user.id }],
  };
}
