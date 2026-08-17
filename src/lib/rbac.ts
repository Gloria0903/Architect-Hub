import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";

/**
 * Role-based access control helpers.
 *
 * Rules (two roles only):
 *  - ADMIN: full access to everything — user management, client management,
 *    firm settings, project creation/reassignment, payments, all reports.
 *  - ARCHITECT: scoped strictly to projects they are the architect OR
 *    supervisor on. Cannot manage staff, clients, payments, firm settings,
 *    or reassignment.
 *
 * These functions are the single source of truth for authorization checks.
 * Every API route must call the relevant helper server-side — never rely on
 * hiding a button in the UI as the actual security boundary.
 */

export function isAdmin(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canManageStaff(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canManageClients(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canManageFirmSettings(session: Session): boolean {
  return isAdmin(session);
}

export function canCreateProjects(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canReassignProjects(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function canRecordPayments(session: Session): boolean {
  return session.user.role === "ADMIN";
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
