/**
 * Architect Hub — typed API client
 * Drop this into src/lib/api.ts. Every page imports from here instead of
 * @/data/mock. Set NEXT_PUBLIC_API_URL in .env.local to your backend URL.
 *
 * Default: http://localhost:4000/api/v1
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// ─── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body.message === "string" ? body.message : "Something went wrong.";
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "SUPERVISOR" | "ARCHITECT";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "DELAYED" | "COMPLETED" | "ARCHIVED";
export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "DELAYED";

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  clientName: string;
  clientContact?: string;
  location?: string;
  description?: string;
  status: ProjectStatus;
  health: ProjectHealth;
  progressPercentage: number;
  priority: ProjectPriority;
  budget?: string;
  startDate?: string;
  expectedCompletionDate?: string;
  completionDate?: string;
  archivedAt?: string;
  supervisor: { id: string; firstName: string; lastName: string; email?: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  assignments: { user: { id: string; firstName: string; lastName: string; email?: string } }[];
  financialRecord?: FinancialRecord;
}

export interface FinancialRecord {
  contractValue: string;
  amountInvoiced: string;
  amountPaid: string;
  paymentDueDate?: string;
  paymentStatus: "NOT_INVOICED" | "INVOICED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
}

export interface DailyLog {
  id: string;
  logDate: string;
  workCompleted: string;
  challenges?: string;
  pendingWork?: string;
  nextActions?: string;
  progressPercentage: number;
  version: number;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
}

export interface Document {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  tags: string[];
  createdAt: string;
  uploadedBy: { id: string; firstName: string; lastName: string };
}

export type CommunicationType =
  | "MEETING_MINUTES"
  | "CLIENT_INSTRUCTION"
  | "DESIGN_COMMENT"
  | "APPROVAL_RECORD"
  | "EMAIL_SUMMARY"
  | "CHANGE_REQUEST";

export interface Communication {
  id: string;
  type: CommunicationType;
  subject: string;
  content: string;
  occurredAt: string;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string };
}

export interface DashboardSummary {
  activeProjects: number;
  delayedProjects: number;
  completedProjects: number;
  missingDailyLogs: number;
  upcomingDeadlines: { id: string; name: string; projectNumber: string; expectedCompletionDate: string }[];
  finance: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
    monthlyRevenue: number;
  } | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

export interface TakeoverBriefing {
  project: {
    id: string;
    projectNumber: string;
    name: string;
    clientName: string;
    status: ProjectStatus;
    health: ProjectHealth;
    progressPercentage: number;
    supervisor: { id: string; firstName: string; lastName: string; email: string };
    currentArchitects: { id: string; firstName: string; lastName: string; email: string }[];
  };
  financialStatus?: FinancialRecord;
  latestDocuments: Document[];
  recentDailyLogs: DailyLog[];
  recentCommunications: Communication[];
  outstandingTasks: {
    description: string;
    nextActions?: string;
    reportedBy: string;
    reportedOn: string;
  }[];
  recentActivity: TimelineEntry[];
  takeoverHistory: {
    id: string;
    createdAt: string;
    reason?: string;
    fromUser?: { id: string; firstName: string; lastName: string };
    toUser: { id: string; firstName: string; lastName: string };
  }[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type LoginResult =
  | { mfaRequired: true; challengeToken: string }
  | { mfaRequired: false; user: User };

export const auth = {
  login: (email: string, password: string) =>
    req<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  verifyMfa: (challengeToken: string, code: string) =>
    req<{ user: User }>("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code }),
    }),

  logout: () => req<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => req<User>("/users/me"),

  forgotPassword: (email: string) =>
    req<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    req<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboard = {
  summary: () => req<DashboardSummary>("/dashboard/summary"),
};

// ─── Users / Staff ────────────────────────────────────────────────────────────

export const users = {
  list: () => req<User[]>("/users"),

  get: (id: string) => req<User>(`/users/${id}`),

  create: (payload: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
    temporaryPassword: string;
  }) => req<User>("/users", { method: "POST", body: JSON.stringify(payload) }),

  update: (
    id: string,
    payload: Partial<{ firstName: string; lastName: string; phone: string; role: UserRole; isActive: boolean }>,
  ) => req<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deactivate: (id: string) =>
    req<User>(`/users/${id}/deactivate`, { method: "PATCH" }),
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = {
  list: (params?: { search?: string; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    return req<Paginated<Project>>(`/projects?${qs}`);
  },

  get: (id: string) => req<Project>(`/projects/${id}`),

  create: (payload: {
    name: string;
    clientName: string;
    clientContact?: string;
    location?: string;
    description?: string;
    startDate?: string;
    expectedCompletionDate?: string;
    priority: ProjectPriority;
    budget?: number;
    supervisorId: string;
    architectIds?: string[];
  }) => req<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),

  update: (id: string, payload: Record<string, unknown>) =>
    req<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  archive: (id: string) =>
    req<Project>(`/projects/${id}/archive`, { method: "PATCH" }),

  duplicate: (id: string) =>
    req<Project>(`/projects/${id}/duplicate`, { method: "POST" }),
};

// ─── Assignments ──────────────────────────────────────────────────────────────

export const assignments = {
  assignArchitect: (projectId: string, userId: string, reason?: string) =>
    req(`/projects/${projectId}/assignments/architects`, {
      method: "POST",
      body: JSON.stringify({ userId, reason }),
    }),

  unassignArchitect: (projectId: string, userId: string) =>
    req(`/projects/${projectId}/assignments/architects/${userId}`, { method: "DELETE" }),

  reassignSupervisor: (projectId: string, newSupervisorId: string, reason?: string) =>
    req(`/projects/${projectId}/assignments/supervisor`, {
      method: "POST",
      body: JSON.stringify({ newSupervisorId, reason }),
    }),

  history: (projectId: string) =>
    req<{ id: string; role: string; reason?: string; createdAt: string; fromUser?: User; toUser: User }[]>(
      `/projects/${projectId}/assignments/history`,
    ),
};

// ─── Daily logs ───────────────────────────────────────────────────────────────

export const dailyLogs = {
  list: (projectId: string, params?: { page?: number; fromDate?: string; toDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.fromDate) qs.set("fromDate", params.fromDate);
    if (params?.toDate) qs.set("toDate", params.toDate);
    return req<Paginated<DailyLog>>(`/projects/${projectId}/daily-logs?${qs}`);
  },

  submit: (
    projectId: string,
    payload: {
      logDate: string;
      workCompleted: string;
      challenges?: string;
      pendingWork?: string;
      nextActions?: string;
      progressPercentage: number;
    },
  ) => req<DailyLog>(`/projects/${projectId}/daily-logs`, { method: "POST", body: JSON.stringify(payload) }),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const documents = {
  list: (projectId: string) => req<Document[]>(`/projects/${projectId}/documents`),

  requestUploadUrl: (
    projectId: string,
    payload: { fileName: string; mimeType: string; sizeBytes: number; category: string },
  ) =>
    req<{ uploadUrl: string; storageKey: string }>(`/projects/${projectId}/documents/upload-url`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  confirmUpload: (
    projectId: string,
    payload: {
      storageKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      category: string;
      tags?: string[];
      parentDocumentId?: string;
    },
  ) =>
    req<Document>(`/projects/${projectId}/documents/confirm`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDownloadUrl: (projectId: string, documentId: string) =>
    req<{ downloadUrl: string; fileName: string }>(
      `/projects/${projectId}/documents/${documentId}/download-url`,
    ),

  getVersions: (projectId: string, documentId: string) =>
    req<Document[]>(`/projects/${projectId}/documents/${documentId}/versions`),
};

// ─── Communications ───────────────────────────────────────────────────────────

export const communications = {
  list: (projectId: string, search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return req<Communication[]>(`/projects/${projectId}/communications${qs}`);
  },

  create: (
    projectId: string,
    payload: {
      type: CommunicationType;
      subject: string;
      content: string;
      occurredAt: string;
    },
  ) =>
    req<Communication>(`/projects/${projectId}/communications`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── Finance ──────────────────────────────────────────────────────────────────

export const finance = {
  getProject: (projectId: string) =>
    req<FinancialRecord | null>(`/projects/${projectId}/finance`),

  upsertProject: (
    projectId: string,
    payload: {
      contractValue: number;
      amountInvoiced?: number;
      amountPaid?: number;
      paymentDueDate?: string;
    },
  ) =>
    req<FinancialRecord>(`/projects/${projectId}/finance`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  firmSummary: () => req<{
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
    monthlyRevenue: number;
  }>("/finance/summary"),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = {
  list: (unreadOnly?: boolean) =>
    req<Notification[]>(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),

  markRead: (id: string) => req(`/notifications/${id}/read`, { method: "PATCH" }),
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

export const timeline = {
  forProject: (projectId: string, page = 1) =>
    req<Paginated<TimelineEntry>>(`/projects/${projectId}/timeline?page=${page}`),
};

// ─── Takeover ─────────────────────────────────────────────────────────────────

export const takeover = {
  briefing: (projectId: string) =>
    req<TakeoverBriefing>(`/projects/${projectId}/takeover/briefing`),

  initiate: (projectId: string, payload: { toUserId?: string; fromUserId?: string; reason?: string }) =>
    req(`/projects/${projectId}/takeover`, { method: "POST", body: JSON.stringify(payload) }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`;
}

export function initials(u: { firstName: string; lastName: string }) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
}

export function formatKsh(value: number | string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function healthToStatus(health: ProjectHealth): "on_track" | "at_risk" | "delayed" {
  if (health === "ON_TRACK") return "on_track";
  if (health === "AT_RISK") return "at_risk";
  return "delayed";
}

export function guessDocCategory(fileName: string, mime: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "dwg") return "DRAWING_DWG";
  if (ext === "dxf") return "DRAWING_DXF";
  if (ext === "rvt") return "DRAWING_REVIT";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "IMAGE";
  if (ext === "xlsx" || ext === "xls") return "BOQ";
  if (ext === "pptx") return "PRESENTATION";
  return "OTHER";
}
