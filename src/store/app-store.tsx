"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Role = "ADMIN" | "ARCHITECT";
export type ProjectStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "DELAYED"
  | "COMPLETED";
export type PaymentStatus = "paid" | "partial" | "overdue" | "pending";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type CommentType =
  | "FEEDBACK"
  | "APPROVAL"
  | "CHANGE_REQUEST"
  | "QUERY";
export type NotificationType =
  | "INFO"
  | "WARNING"
  | "SUCCESS"
  | "ERROR";

// ─── Interfaces ──────────────────────────────────────────────────────────────

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
  _count?: {
    assignedProjects: number;
    dailyLogs: number;
  };
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
  fromArchitect?: {
    id: string;
    name: string;
  };
  toArchitectId: string;
  toArchitect?: {
    id: string;
    name: string;
  };
  reason?: string;
  date: string;
  performedBy?: {
    id: string;
    name: string;
  };
}

export interface DailyLog {
  id: string;
  projectId: string;
  project?: {
    id: string;
    name: string;
    sheetNo: string;
  };
  authorId: string;
  author?: {
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string | null;
  };
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
  project?: {
    id: string;
    name: string;
    sheetNo: string;
  };
  clientId: string;
  client?: {
    id: string;
    name: string;
  };
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
  project?: {
    id: string;
    name: string;
    sheetNo: string;
  };
  amount: number;
  date: string;
  reference?: string;
  note?: string;
  recordedBy?: {
    id: string;
    name: string;
  };
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
  project?: {
    id: string;
    name: string;
    sheetNo: string;
  };
  uploadedById: string;
  clientVisible?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatKsh(n: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}

export function statusLabel(s: ProjectStatus) {
  return {
    ON_TRACK: "On track",
    AT_RISK: "At risk",
    DELAYED: "Delayed",
    COMPLETED: "Completed",
  }[s];
}

export function roleLabel(r: Role) {
  return {
    ADMIN: "Admin",
    ARCHITECT: "Architect",
  }[r];
}

export function commentTypeLabel(t: CommentType) {
  return {
    FEEDBACK: "Feedback",
    APPROVAL: "Approval",
    CHANGE_REQUEST: "Change request",
    QUERY: "Query",
  }[t];
}

export function priorityLabel(p: Priority) {
  return {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
  }[p];
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── API Helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    credentials: "same-origin",
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized");
    }

    if (res.status === 403) {
      throw new Error("You do not have permission to perform this action.");
    }

    const err = isJson
      ? await res
          .json()
          .catch(() => ({ error: "Request failed" }))
      : {
          error: `Request failed (HTTP ${res.status})`,
        };

    throw new Error(
      err?.error || `HTTP ${res.status}`
    );
  }

  if (!isJson) {
    throw new Error(
      "Server returned an unexpected non-JSON response."
    );
  }

  return res.json();
}

// ─── Application State ───────────────────────────────────────────────────────

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

// ─── Application Actions ─────────────────────────────────────────────────────

interface AppActions {
  refresh: () => Promise<void>;

  addStaff: (
    s: Omit<
      StaffMember,
      "id" | "initials" | "_count" | "joinDate"
    > & {
      password?: string;
    }
  ) => Promise<{ temporaryPassword?: string }>;

  updateStaff: (
    id: string,
    patch: Partial<StaffMember> & {
      password?: string;
      currentPassword?: string;
      resetPassword?: boolean;
    }
  ) => Promise<{ temporaryPassword?: string }>;

  removeStaff: (id: string) => Promise<void>;

  addClient: (
    c: Omit<Client, "id" | "createdAt" | "projects">
  ) => Promise<void>;

  updateClient: (
    id: string,
    patch: Partial<Client>
  ) => Promise<void>;

  removeClient: (id: string) => Promise<void>;

  addProject: (p: {
    name: string;
    clientId: string;
    location: string;
    description?: string;
    architectId?: string;
    supervisorId?: string;
    startDate: string;
    dueDate: string;
    budget: number;
    priority: Priority;
  }) => Promise<void>;

  updateProject: (
    id: string,
    patch: Partial<Project>
  ) => Promise<void>;

  removeProject: (id: string) => Promise<void>;

  reassignProject: (
    projectId: string,
    toArchitectId: string,
    reason: string
  ) => Promise<void>;

  addLog: (l: {
    projectId: string;
    workCompleted: string;
    challenges: string;
    pendingWork: string;
    nextActions: string;
    progress: number;
  }) => Promise<void>;

  addComment: (c: {
    projectId: string;
    clientId: string;
    author: string;
    content: string;
    type: CommentType;
  }) => Promise<void>;

  resolveComment: (id: string) => Promise<void>;

  addPayment: (p: {
    projectId: string;
    amount: number;
    date: string;
    reference?: string;
    note?: string;
  }) => Promise<void>;

  markNotificationRead: (id: string) => Promise<void>;

  // IMPORTANT:
  // category is optional so existing calls using
  // uploadDocument(projectId, file) continue working.
  uploadDocument: (
    projectId: string,
    file: File,
    category?: string
  ) => Promise<void>;

  removeDocument: (id: string) => Promise<void>;

  toggleDocumentVisibility: (
    id: string,
    clientVisible: boolean
  ) => Promise<void>;

  uploadAvatar: (file: File) => Promise<void>;

  removeAvatar: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const Ctx = createContext<
  (AppState & AppActions) | null
>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status, data: session } = useSession();

  const isStaffSession =
    status === "authenticated" &&
    session?.user?.role !== "CLIENT";

  const [state, setState] = useState<AppState>({
    staff: [],
    clients: [],
    projects: [],
    logs: [],
    comments: [],
    payments: [],
    notifications: [],
    documents: [],
    loading: true,
    error: null,
  });

  // ─── Refresh all staff data ───────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!isStaffSession) {
      return;
    }

    try {
      setState((s) => ({
        ...s,
        loading: true,
        error: null,
      }));

      const [
        staff,
        clients,
        projects,
        logs,
        comments,
        payments,
        notificationResponse,
        documents,
      ] = await Promise.all([
        apiFetch<StaffMember[]>("/api/staff"),
        apiFetch<Client[]>("/api/clients"),
        apiFetch<Project[]>("/api/projects"),
        apiFetch<DailyLog[]>("/api/logs"),
        apiFetch<ClientComment[]>("/api/comments"),
        apiFetch<Payment[]>("/api/payments"),
        apiFetch<{
          notifications: Notification[];
          unreadCount: number;
        }>("/api/notifications"),
        apiFetch<Document[]>("/api/documents"),
      ]);

      const notifications =
        notificationResponse.notifications ?? [];

      setState({
        staff,
        clients,
        projects,
        logs,
        comments,
        payments,
        notifications,
        documents,
        loading: false,
        error: null,
      });
    } catch (e) {
      console.error("Failed to refresh application data:", e);

      setState((s) => ({
        ...s,
        loading: false,
        error:
          e instanceof Error
            ? e.message
            : "Failed to load application data.",
      }));
    }
  }, [isStaffSession]);

  // ─── Initial data load ────────────────────────────────────────────────────

  useEffect(() => {
    if (isStaffSession) {
      refresh();
      return;
    }

    if (
      status === "unauthenticated" ||
      (status === "authenticated" && !isStaffSession)
    ) {
      setState((s) => ({
        ...s,
        loading: false,
      }));
    }
  }, [status, isStaffSession, refresh]);

  // ─── Keep data fresh ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isStaffSession) {
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, 30000);

    const onFocus = () => {
      refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", onFocus);

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      clearInterval(interval);

      window.removeEventListener(
        "focus",
        onFocus
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [isStaffSession, refresh]);

  // ─── Staff ─────────────────────────────────────────────────────────────────

  const addStaff = useCallback(
    async (
      data: Parameters<AppActions["addStaff"]>[0]
    ) => {
      const result =
        await apiFetch<{
          temporaryPassword?: string;
        }>("/api/staff", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            role: data.role.toUpperCase(),
          }),
        });

      await refresh();

      return result;
    },
    [refresh]
  );

  const updateStaff = useCallback(
    async (
      id: string,
      patch: Parameters<
        AppActions["updateStaff"]
      >[1]
    ) => {
      const result =
        await apiFetch<{
          temporaryPassword?: string;
        }>(`/api/staff/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });

      await refresh();

      return result;
    },
    [refresh]
  );

  const removeStaff = useCallback(
    async (id: string) => {
      await apiFetch(`/api/staff/${id}`, {
        method: "DELETE",
      });

      await refresh();
    },
    [refresh]
  );

  // ─── Clients ──────────────────────────────────────────────────────────────

  const addClient = useCallback(
    async (
      data: Parameters<AppActions["addClient"]>[0]
    ) => {
      await apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(data),
      });

      await refresh();
    },
    [refresh]
  );

  const updateClient = useCallback(
    async (
      id: string,
      patch: Partial<Client>
    ) => {
      await apiFetch(`/api/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      await refresh();
    },
    [refresh]
  );

  const removeClient = useCallback(
    async (id: string) => {
      await apiFetch(`/api/clients/${id}`, {
        method: "DELETE",
      });

      await refresh();
    },
    [refresh]
  );

  // ─── Projects ─────────────────────────────────────────────────────────────

  const addProject = useCallback(
    async (
      data: Parameters<AppActions["addProject"]>[0]
    ) => {
      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          priority: data.priority.toUpperCase(),
        }),
      });

      await refresh();
    },
    [refresh]
  );

  const updateProject = useCallback(
    async (
      id: string,
      patch: Partial<Project>
    ) => {
      await apiFetch(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      await refresh();
    },
    [refresh]
  );

  const removeProject = useCallback(
    async (id: string) => {
      await apiFetch(`/api/projects/${id}`, {
        method: "DELETE",
      });

      await refresh();
    },
    [refresh]
  );

  const reassignProject = useCallback(
    async (
      projectId: string,
      toArchitectId: string,
      reason: string
    ) => {
      await apiFetch(
        `/api/projects/${projectId}/reassign`,
        {
          method: "POST",
          body: JSON.stringify({
            toArchitectId,
            reason,
          }),
        }
      );

      await refresh();
    },
    [refresh]
  );

  // ─── Daily Logs ───────────────────────────────────────────────────────────

  const addLog = useCallback(
    async (
      data: Parameters<AppActions["addLog"]>[0]
    ) => {
      await apiFetch("/api/logs", {
        method: "POST",
        body: JSON.stringify(data),
      });

      await refresh();
    },
    [refresh]
  );

  // ─── Comments ─────────────────────────────────────────────────────────────

  const addComment = useCallback(
    async (
      data: Parameters<AppActions["addComment"]>[0]
    ) => {
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          type: data.type.toUpperCase(),
        }),
      });

      await refresh();
    },
    [refresh]
  );

  const resolveComment = useCallback(
    async (id: string) => {
      await apiFetch(
        `/api/comments/${id}/resolve`,
        {
          method: "POST",
        }
      );

      await refresh();
    },
    [refresh]
  );

  // ─── Payments ─────────────────────────────────────────────────────────────

  const addPayment = useCallback(
    async (
      data: Parameters<AppActions["addPayment"]>[0]
    ) => {
      await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify(data),
      });

      await refresh();
    },
    [refresh]
  );

  // ─── Notifications ───────────────────────────────────────────────────────

  const markNotificationRead = useCallback(
    async (id: string) => {
      await apiFetch(
        `/api/notifications/${id}`,
        {
          method: "PATCH",
        }
      );

      setState((s) => ({
        ...s,
        notifications: s.notifications.map(
          (notification) =>
            notification.id === id
              ? {
                  ...notification,
                  read: true,
                }
              : notification
        ),
      }));
    },
    []
  );

  // ─── DOCUMENT UPLOAD ─────────────────────────────────────────────────────

  const uploadDocument = useCallback(
    async (
      projectId: string,
      file: File,
      category: string = "OTHER"
    ): Promise<void> => {
      // Basic validation
      if (!projectId) {
        throw new Error(
          "A project must be selected before uploading."
        );
      }

      if (!(file instanceof File)) {
        throw new Error(
          "Invalid file selected."
        );
      }

      if (file.size === 0) {
        throw new Error(
          `"${file.name}" is empty.`
        );
      }

      console.log(
        "Starting document upload:",
        {
          projectId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          category,
        }
      );

      // Build multipart request
      const formData = new FormData();

      formData.append(
        "file",
        file,
        file.name
      );

      formData.append(
        "projectId",
        projectId
      );

      formData.append(
        "category",
        category
      );

      let response: Response;

      try {
        response = await fetch(
          "/api/documents",
          {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          }
        );
      } catch (error) {
        console.error(
          "Document upload network error:",
          error
        );

        throw new Error(
          "Could not connect to the document upload service."
        );
      }

      // Read server response
      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let result: any = null;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        result = await response
          .json()
          .catch(() => null);
      } else {
        const text =
          await response.text();

        result = {
          error:
            text ||
            `Upload failed with HTTP ${response.status}`,
        };
      }

      console.log(
        "Document upload response:",
        {
          status: response.status,
          result,
        }
      );

      // Handle server errors
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please log in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You do not have permission to upload documents to this project."
          );
        }

        if (response.status === 413) {
          throw new Error(
            "The file is too large to upload."
          );
        }

        throw new Error(
          result?.error ||
            `Upload failed with HTTP ${response.status}`
        );
      }

      // Make sure server actually created a document
      if (!result?.id) {
        console.error(
          "Upload response did not contain a document ID:",
          result
        );

        throw new Error(
          "The server accepted the upload but did not return a document record."
        );
      }

      console.log(
        "Document uploaded successfully:",
        result
      );

      // Refresh document list
      await refresh();
    },
    [refresh]
  );

  // ─── Documents ────────────────────────────────────────────────────────────

  const removeDocument = useCallback(
    async (id: string) => {
      await apiFetch(
        `/api/documents/${id}`,
        {
          method: "DELETE",
        }
      );

      await refresh();
    },
    [refresh]
  );

  const toggleDocumentVisibility =
    useCallback(
      async (
        id: string,
        clientVisible: boolean
      ) => {
        await apiFetch(
          `/api/documents/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              clientVisible,
            }),
          }
        );

        await refresh();
      },
      [refresh]
    );

  // ─── Avatar ───────────────────────────────────────────────────────────────

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!(file instanceof File)) {
        throw new Error(
          "Invalid file selected."
        );
      }

      const form = new FormData();

      form.append(
        "file",
        file,
        file.name
      );

      const res = await fetch(
        "/api/users/me/avatar",
        {
          method: "POST",
          body: form,
          credentials: "same-origin",
        }
      );

      if (!res.ok) {
        const err =
          await res
            .json()
            .catch(() => ({
              error: "Upload failed",
            }));

        throw new Error(
          err.error ||
            `HTTP ${res.status}`
        );
      }

      await refresh();
    },
    [refresh]
  );

  const removeAvatar = useCallback(
    async () => {
      await apiFetch(
        "/api/users/me/avatar",
        {
          method: "DELETE",
        }
      );

      await refresh();
    },
    [refresh]
  );

  // ─── Provider ─────────────────────────────────────────────────────────────

  return (
    <Ctx.Provider
      value={{
        ...state,

        refresh,

        addStaff,
        updateStaff,
        removeStaff,

        addClient,
        updateClient,
        removeClient,

        addProject,
        updateProject,
        removeProject,
        reassignProject,

        addLog,

        addComment,
        resolveComment,

        addPayment,

        markNotificationRead,

        uploadDocument,
        removeDocument,
        toggleDocumentVisibility,

        uploadAvatar,
        removeAvatar,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStore() {
  const ctx = useContext(Ctx);

  if (!ctx) {
    throw new Error(
      "useStore must be used within AppProvider"
    );
  }

  return ctx;
}