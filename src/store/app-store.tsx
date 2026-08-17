"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
// ─── Types (mirrored from Prisma enums) ──────────────────────────────────────

export type Role = "ADMIN" | "ARCHITECT";
export type ProjectStatus = "ON_TRACK" | "AT_RISK" | "DELAYED" | "COMPLETED";
export type PaymentStatus = "paid" | "partial" | "overdue" | "pending";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type CommentType = "FEEDBACK" | "APPROVAL" | "CHANGE_REQUEST" | "QUERY";
export type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  email: string;
  role: Role;
  phone?: string;
  department?: string;
  joinDate: string;
  isActive?: boolean;
  mustResetPassword?: boolean;
  _count?: { assignedProjects: number; dailyLogs: number };
}

export interface Client {
  id: string;
  name: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  projects?: Project[];
  portalEnabled?: boolean;
  lastPortalLoginAt?: string;
}

export interface Project {
  id: string;
  sheetNo: string;
  name: string;
  clientId: string;
  client?: Client;
  location: string;
  description?: string;
  status: ProjectStatus;
  progress: number;
  architectId?: string;
  architect?: StaffMember;
  supervisorId?: string;
  supervisor?: StaffMember;
  startDate: string;
  dueDate: string;
  budget: number;
  invoiced: number;
  paid: number;
  priority: Priority;
  assignmentHistory?: AssignmentRecord[];
  dailyLogs?: DailyLog[];
  comments?: ClientComment[];
  payments?: Payment[];
}

export interface AssignmentRecord {
  id: string;
  projectId: string;
  fromArchitectId?: string;
  fromArchitect?: { id: string; name: string };
  toArchitectId: string;
  toArchitect?: { id: string; name: string };
  reason?: string;
  date: string;
  performedBy?: { id: string; name: string };
}

export interface DailyLog {
  id: string;
  projectId: string;
  project?: { id: string; name: string; sheetNo: string };
  authorId: string;
  author?: { id: string; name: string; initials: string; avatarUrl?: string | null };
  date: string;
  workCompleted: string;
  challenges: string;
  pendingWork: string;
  nextActions: string;
  progress: number;
  submittedAt: string;
}

export interface ClientComment {
  id: string;
  projectId: string;
  project?: { id: string; name: string; sheetNo: string };
  clientId: string;
  client?: { id: string; name: string };
  author: string;
  content: string;
  type: CommentType;
  viaPortal?: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface Payment {
  id: string;
  projectId: string;
  project?: { id: string; name: string; sheetNo: string };
  amount: number;
  date: string;
  reference?: string;
  note?: string;
  recordedBy?: { id: string; name: string };
}

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  uploadedAt: string;
  projectId: string;
  project?: { id: string; name: string; sheetNo: string };
  uploadedById: string;
  clientVisible?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatKsh(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

export function statusLabel(s: ProjectStatus) {
  return { ON_TRACK: "On track", AT_RISK: "At risk", DELAYED: "Delayed", COMPLETED: "Completed" }[s];
}

export function roleLabel(r: Role) {
  return { ADMIN: "Admin", ARCHITECT: "Architect" }[r];
}

export function commentTypeLabel(t: CommentType) {
  return { FEEDBACK: "Feedback", APPROVAL: "Approval", CHANGE_REQUEST: "Change request", QUERY: "Query" }[t];
}

export function priorityLabel(p: Priority) {
  return { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }[p];
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    if (res.status === 401) {
    throw new Error("Unauthorized");
}
    const err = isJson ? await res.json().catch(() => ({ error: "Request failed" })) : { error: `Request failed (HTTP ${res.status})` };
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (!isJson) {
    throw new Error("Server returned an unexpected non-JSON response. Please try again.");
  }

  return res.json();
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppState {
  staff: StaffMember[];
  clients: Client[];
  projects: Project[];
  logs: DailyLog[];
  comments: ClientComment[];
  payments: Payment[];
  notifications: Notification[];
  documents: Document[];
  loading: boolean;
  error: string | null;
}

interface AppActions {
  refresh: () => Promise<void>;
  addStaff: (s: Omit<StaffMember, "id" | "initials" | "_count" | "joinDate"> & { password?: string }) => Promise<{ temporaryPassword?: string }>;
  updateStaff: (id: string, patch: Partial<StaffMember> & { password?: string; currentPassword?: string; resetPassword?: boolean }) => Promise<{ temporaryPassword?: string }>;
  removeStaff: (id: string) => Promise<void>;
  addClient: (c: Omit<Client, "id" | "createdAt" | "projects">) => Promise<void>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  addProject: (p: {
    name: string; clientId: string; location: string; description?: string;
    architectId?: string; supervisorId?: string; startDate: string; dueDate: string;
    budget: number; priority: Priority;
  }) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  reassignProject: (projectId: string, toArchitectId: string, reason: string) => Promise<void>;
  addLog: (l: { projectId: string; workCompleted: string; challenges: string; pendingWork: string; nextActions: string; progress: number }) => Promise<void>;
  addComment: (c: { projectId: string; clientId: string; author: string; content: string; type: CommentType }) => Promise<void>;
  resolveComment: (id: string) => Promise<void>;
  addPayment: (p: { projectId: string; amount: number; date: string; reference?: string; note?: string }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  uploadDocument: (projectId: string, file: File) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  toggleDocumentVisibility: (id: string, clientVisible: boolean) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

const Ctx = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  // Client Portal sessions never have access to the staff data endpoints
  // below (see middleware.ts) — the portal pages fetch /api/client-portal/*
  // directly instead. Treat a client session the same as "unauthenticated"
  // here so this provider doesn't spend the whole session retrying 403s.
  const isStaffSession = status === "authenticated" && session?.user?.role !== "CLIENT";
  const [state, setState] = useState<AppState>({
    staff: [], clients: [], projects: [], logs: [],
    comments: [], payments: [], notifications: [], documents: [],
    loading: true, error: null,
  });

  const refresh = useCallback(async () => {
    try {
      setState(s => ({ ...s, loading: true, error: null }));
      const [staff, clients, projects, logs, comments, payments, notificationResponse, documents] =
  await Promise.all([
    apiFetch<StaffMember[]>("/api/staff"),
    apiFetch<Client[]>("/api/clients"),
    apiFetch<Project[]>("/api/projects"),
    apiFetch<DailyLog[]>("/api/logs"),
    apiFetch<ClientComment[]>("/api/comments"),
    apiFetch<Payment[]>("/api/payments"),
    apiFetch<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
    apiFetch<Document[]>("/api/documents"),
  ]);

const notifications = notificationResponse.notifications ?? [];
      setState({ staff, clients, projects, logs, comments, payments, notifications, documents, loading: false, error: null });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
  if (isStaffSession) {
    refresh();
  }

  if (status === "unauthenticated" || (status === "authenticated" && !isStaffSession)) {
    setState((s) => ({
      ...s,
      loading: false,
    }));
  }
}, [status, isStaffSession, refresh]);

  // Keep data fresh when other users change it (new logs, payments, comments, etc.)
  // without the current user having to trigger a mutation of their own: poll
  // periodically, and refetch immediately whenever the tab regains focus.
  useEffect(() => {
    if (!isStaffSession) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [status, isStaffSession, refresh]);

  const addStaff = useCallback(async (data: Parameters<AppActions["addStaff"]>[0]) => {
    const result = await apiFetch<{ temporaryPassword?: string }>("/api/staff", { method: "POST", body: JSON.stringify({ ...data, role: data.role.toUpperCase() }) });
    await refresh();
    return result;
  }, [refresh]);

  const updateStaff = useCallback(async (id: string, patch: Parameters<AppActions["updateStaff"]>[1]) => {
    const result = await apiFetch<{ temporaryPassword?: string }>(`/api/staff/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await refresh();
    return result;
  }, [refresh]);

  const removeStaff = useCallback(async (id: string) => {
    await apiFetch(`/api/staff/${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const addClient = useCallback(async (data: Parameters<AppActions["addClient"]>[0]) => {
    await apiFetch("/api/clients", { method: "POST", body: JSON.stringify(data) });
    await refresh();
  }, [refresh]);

  const updateClient = useCallback(async (id: string, patch: Partial<Client>) => {
    await apiFetch(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await refresh();
  }, [refresh]);

  const removeClient = useCallback(async (id: string) => {
    await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const addProject = useCallback(async (data: Parameters<AppActions["addProject"]>[0]) => {
    await apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ ...data, priority: data.priority.toUpperCase() }) });
    await refresh();
  }, [refresh]);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    await apiFetch(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await refresh();
  }, [refresh]);

  const removeProject = useCallback(async (id: string) => {
    await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const reassignProject = useCallback(async (projectId: string, toArchitectId: string, reason: string) => {
    await apiFetch(`/api/projects/${projectId}/reassign`, { method: "POST", body: JSON.stringify({ toArchitectId, reason }) });
    await refresh();
  }, [refresh]);

  const addLog = useCallback(async (data: Parameters<AppActions["addLog"]>[0]) => {
    await apiFetch("/api/logs", { method: "POST", body: JSON.stringify(data) });
    await refresh();
  }, [refresh]);

  const addComment = useCallback(async (data: Parameters<AppActions["addComment"]>[0]) => {
    await apiFetch("/api/comments", { method: "POST", body: JSON.stringify({ ...data, type: data.type.toUpperCase() }) });
    await refresh();
  }, [refresh]);

  const resolveComment = useCallback(async (id: string) => {
    await apiFetch(`/api/comments/${id}/resolve`, { method: "POST" });
    await refresh();
  }, [refresh]);

  const addPayment = useCallback(async (data: Parameters<AppActions["addPayment"]>[0]) => {
    await apiFetch("/api/payments", { method: "POST", body: JSON.stringify(data) });
    await refresh();
  }, [refresh]);

  const markNotificationRead = useCallback(async (id: string) => {
    await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
    setState(s => ({ ...s, notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
  }, []);

  const uploadDocument = useCallback(async (projectId: string, file: File) => {
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await refresh();
  }, [refresh]);

  const removeDocument = useCallback(async (id: string) => {
    await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const toggleDocumentVisibility = useCallback(async (id: string, clientVisible: boolean) => {
    await apiFetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientVisible }),
    });
    await refresh();
  }, [refresh]);

  const uploadAvatar = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/users/me/avatar", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await refresh();
  }, [refresh]);

  const removeAvatar = useCallback(async () => {
    await apiFetch("/api/users/me/avatar", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{
      ...state,
      refresh, addStaff, updateStaff, removeStaff,
      addClient, updateClient, removeClient,
      addProject, updateProject, removeProject, reassignProject,
      addLog, addComment, resolveComment, addPayment, markNotificationRead,
      uploadDocument, removeDocument, toggleDocumentVisibility, uploadAvatar, removeAvatar,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within AppProvider");
  return ctx;
}