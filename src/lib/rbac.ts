import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";

/**
 * --------------------------------------------------------------------------
 * ROLE-BASED ACCESS CONTROL
 * --------------------------------------------------------------------------
 *
 * Roles:
 *
 * ADMIN
 *   - Full access
 *   - Staff management
 *   - Client management
 *   - Project creation
 *   - Project reassignment
 *   - Financial management
 *   - Payment recording
 *   - All financial reports
 *
 * ARCHITECT
 *   - Can access projects where they are:
 *       1. architect OR
 *       2. supervisor
 *
 *   - Can view related project resources:
 *       - projects
 *       - daily logs
 *       - comments
 *       - documents
 *       - payments belonging to assigned projects
 *
 *   - Cannot:
 *       - manage staff
 *       - manage clients
 *       - create/reassign projects
 *       - record payments
 *       - perform administrative financial operations
 *
 * IMPORTANT:
 *
 * These functions are server-side authorization helpers.
 * UI restrictions are NOT considered security boundaries.
 */

/*
|--------------------------------------------------------------------------
| Role helpers
|--------------------------------------------------------------------------
*/

/**
 * Returns true only for administrators.
 */
export function isAdmin(session: Session): boolean {
  return session.user.role === "ADMIN";
}

/**
 * Returns true when the session belongs to an architect.
 */
export function isArchitect(session: Session): boolean {
  return session.user.role === "ARCHITECT";
}

/**
 * Returns true for senior architects — firm-wide oversight role that sits
 * between ADMIN and ARCHITECT. Can create/reassign projects and see every
 * project firm-wide, but not manage staff, clients, firm settings, or
 * record payments (ADMIN-only).
 */
export function isSeniorArchitect(session: Session): boolean {
  return session.user.role === "SENIOR_ARCHITECT";
}

/*
|--------------------------------------------------------------------------
| Staff management
|--------------------------------------------------------------------------
*/

export function canManageStaff(
  session: Session
): boolean {
  return isAdmin(session);
}

/*
|--------------------------------------------------------------------------
| Client management
|--------------------------------------------------------------------------
*/

export function canManageClients(
  session: Session
): boolean {
  return isAdmin(session);
}

/*
|--------------------------------------------------------------------------
| Firm settings
|--------------------------------------------------------------------------
*/

export function canManageFirmSettings(
  session: Session
): boolean {
  return isAdmin(session);
}

/*
|--------------------------------------------------------------------------
| Project management
|--------------------------------------------------------------------------
*/

/**
 * Administrators and senior architects can create projects.
 */
export function canCreateProjects(
  session: Session
): boolean {
  return isAdmin(session) || isSeniorArchitect(session);
}

/**
 * Administrators and senior architects can reassign projects.
 */
export function canReassignProjects(
  session: Session
): boolean {
  return isAdmin(session) || isSeniorArchitect(session);
}

/*
|--------------------------------------------------------------------------
| Financial permissions
|--------------------------------------------------------------------------
*/

/**
 * Only administrators can RECORD payments.
 *
 * IMPORTANT:
 *
 * This does NOT mean architects cannot READ payments.
 *
 * GET /api/payments uses project-scoped read access.
 *
 * POST /api/payments uses this function.
 */
export function canRecordPayments(
  session: Session
): boolean {
  return isAdmin(session);
}

/**
 * Whether the user can view financial/payment information.
 *
 * Both ADMIN and ARCHITECT can read financial data, but architects
 * are restricted to their assigned projects.
 */
export function canViewPayments(
  session: Session
): boolean {
  return (
    isAdmin(session) ||
    isSeniorArchitect(session) ||
    isArchitect(session)
  );
}

/*
|--------------------------------------------------------------------------
| Project access
|--------------------------------------------------------------------------
*/

/**
 * Prisma WHERE clause limiting projects to what the current user
 * is allowed to see.
 *
 * ADMIN / SENIOR_ARCHITECT:
 *   No restriction — firm-wide visibility.
 *
 * ARCHITECT:
 *   Only projects where they are architect OR supervisor.
 */
export function projectAccessWhere(
  session: Session
): Prisma.ProjectWhereInput {
  if (isAdmin(session) || isSeniorArchitect(session)) {
    return {};
  }

  return {
    OR: [
      {
        architectId: session.user.id,
      },
      {
        supervisorId: session.user.id,
      },
    ],
  };
}

/**
 * Checks whether the current user can access a specific project.
 *
 * ADMIN / SENIOR_ARCHITECT:
 *   Always true.
 *
 * ARCHITECT:
 *   Must be architect or supervisor.
 */
export function canAccessProject(
  session: Session,
  project: {
    architectId?: string | null;
    supervisorId?: string | null;
  }
): boolean {
  if (isAdmin(session) || isSeniorArchitect(session)) {
    return true;
  }

  return (
    project.architectId === session.user.id ||
    project.supervisorId === session.user.id
  );
}

/*
|--------------------------------------------------------------------------
| Related project resources
|--------------------------------------------------------------------------
*/

/**
 * Project WHERE clause used when querying resources that belong to a
 * project.
 *
 * Examples:
 *
 *   Payment
 *   Document
 *   DailyLog
 *   ClientComment
 *
 * ADMIN / SENIOR_ARCHITECT:
 *   undefined → unrestricted.
 *
 * ARCHITECT:
 *   only resources whose project is assigned to them.
 *
 * IMPORTANT:
 *
 * This object is intended to be nested under the resource's `project`
 * relation:
 *
 * where: {
 *   project: relatedProjectAccessWhere(session)
 * }
 */
export function relatedProjectAccessWhere(
  session: Session
): Prisma.ProjectWhereInput | undefined {
  if (isAdmin(session) || isSeniorArchitect(session)) {
    return undefined;
  }

  return {
    OR: [
      {
        architectId: session.user.id,
      },
      {
        supervisorId: session.user.id,
      },
    ],
  };
}