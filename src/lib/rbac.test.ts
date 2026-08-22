import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  canAccessProject,
  canCreateProjects,
  canManageClients,
  canManageFirmSettings,
  canManageStaff,
  canReassignProjects,
  canRecordPayments,
  canViewPayments,
  isAdmin,
  isSeniorArchitect,
  projectAccessWhere,
  relatedProjectAccessWhere,
} from "./rbac";

function makeSession(
  role: "ADMIN" | "SENIOR_ARCHITECT" | "ARCHITECT",
  userId = "user-1"
): Session {
  return {
    user: { id: userId, role, email: "test@archub.io", name: "Test User" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

describe("rbac", () => {
  it("grants admins every admin-only capability", () => {
    const admin = makeSession("ADMIN");
    expect(isAdmin(admin)).toBe(true);
    expect(canManageStaff(admin)).toBe(true);
    expect(canManageClients(admin)).toBe(true);
    expect(canCreateProjects(admin)).toBe(true);
    expect(canReassignProjects(admin)).toBe(true);
    expect(canRecordPayments(admin)).toBe(true);
  });

  it("denies architects every admin-only capability", () => {
    const architect = makeSession("ARCHITECT");
    expect(isAdmin(architect)).toBe(false);
    expect(canManageStaff(architect)).toBe(false);
    expect(canManageClients(architect)).toBe(false);
    expect(canCreateProjects(architect)).toBe(false);
    expect(canReassignProjects(architect)).toBe(false);
    expect(canRecordPayments(architect)).toBe(false);
  });

  it("gives admins an unscoped project query (no WHERE restriction)", () => {
    const admin = makeSession("ADMIN");
    expect(projectAccessWhere(admin)).toEqual({});
  });

  it("scopes architects' project query to their own architect/supervisor assignments", () => {
    const architect = makeSession("ARCHITECT", "arch-42");
    expect(projectAccessWhere(architect)).toEqual({
      OR: [{ architectId: "arch-42" }, { supervisorId: "arch-42" }],
    });
  });

  it("lets an architect access a project only if assigned as architect or supervisor", () => {
    const architect = makeSession("ARCHITECT", "arch-42");

    expect(
      canAccessProject(architect, { architectId: "arch-42", supervisorId: null })
    ).toBe(true);
    expect(
      canAccessProject(architect, { architectId: null, supervisorId: "arch-42" })
    ).toBe(true);
    expect(
      canAccessProject(architect, { architectId: "someone-else", supervisorId: "another-person" })
    ).toBe(false);
  });

  it("lets an admin access any project regardless of assignment", () => {
    const admin = makeSession("ADMIN");
    expect(
      canAccessProject(admin, { architectId: "someone-else", supervisorId: null })
    ).toBe(true);
  });

  // --- Senior Architect: firm-wide oversight, between ADMIN and ARCHITECT ---

  it("grants senior architects project create/reassign and firm-wide visibility", () => {
    const senior = makeSession("SENIOR_ARCHITECT");
    expect(isSeniorArchitect(senior)).toBe(true);
    expect(isAdmin(senior)).toBe(false);
    expect(canCreateProjects(senior)).toBe(true);
    expect(canReassignProjects(senior)).toBe(true);
    expect(projectAccessWhere(senior)).toEqual({});
    expect(relatedProjectAccessWhere(senior)).toBeUndefined();
    expect(
      canAccessProject(senior, { architectId: "someone-else", supervisorId: null })
    ).toBe(true);
  });

  it("denies senior architects admin-only capabilities (staff, clients, firm settings, payments)", () => {
    const senior = makeSession("SENIOR_ARCHITECT");
    expect(canManageStaff(senior)).toBe(false);
    expect(canManageClients(senior)).toBe(false);
    expect(canManageFirmSettings(senior)).toBe(false);
    expect(canRecordPayments(senior)).toBe(false);
  });

  it("lets both architects and senior architects view (but not record) payments", () => {
    const architect = makeSession("ARCHITECT");
    const senior = makeSession("SENIOR_ARCHITECT");
    expect(canViewPayments(architect)).toBe(true);
    expect(canViewPayments(senior)).toBe(true);
    expect(canRecordPayments(architect)).toBe(false);
    expect(canRecordPayments(senior)).toBe(false);
  });

  it("still scopes a plain architect's related-project queries to their own assignments", () => {
    const architect = makeSession("ARCHITECT", "arch-42");
    expect(relatedProjectAccessWhere(architect)).toEqual({
      OR: [{ architectId: "arch-42" }, { supervisorId: "arch-42" }],
    });
  });
});
