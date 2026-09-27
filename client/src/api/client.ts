import type {
  Task,
  CreateTaskPayload,
  UpdateTaskPayload,
  ReschedulePayload,
  AISuggestion,
  CriticalPathData,
  ArchivedTask,
  WorkspaceExport,
} from "../types/task";

// Prefer the Vercel same-origin /api rewrite in production. This keeps the
// session cookie first-party even though the API itself runs on Render.
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: {
    path?: string[];
    dependentIds?: string[];
    dependentTitles?: string[];
  };
}

export interface AISuggestionFeedback {
  targetTaskId?: string;
  targetTaskTitle: string;
  suggestionTaskId: string;
  suggestionTitle: string;
  rationale: string;
  decision: "accepted" | "rejected";
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: "owner" | "member";
}

export interface AuthSession {
  user: { id: string; email: string; displayName: string };
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
};

export class ApiError extends Error {
  code?: string;
  details?: {
    path?: string[];
    dependentIds?: string[];
    dependentTitles?: string[];
  };

  constructor(
    message: string,
    code?: string,
    details?: {
      path?: string[];
      dependentIds?: string[];
      dependentTitles?: string[];
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: options?.credentials ?? "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data.error || `Request failed with status ${response.status}`,
      data.code,
      data.details,
    );
  }
  return data as T;
}

export const apiClient = {
  getAuthSession: () => request<AuthSession>("/auth/me"),

  register: (payload: {
    displayName: string;
    email: string;
    password: string;
  }) =>
    request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  createWorkspace: (name: string) =>
    request<AuthSession>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  activateWorkspace: (workspaceId: string) =>
    request<AuthSession>(`/workspaces/${workspaceId}/activate`, {
      method: "POST",
    }),

  addWorkspaceMember: (workspaceId: string, email: string) =>
    request<{ member: { id: string; email: string; displayName: string } }>(
      `/workspaces/${workspaceId}/members`,
      { method: "POST", body: JSON.stringify({ email }) },
    ),

  getTasks: () =>
    request<{
      tasks: Task[];
      criticalPath?: string[];
      totalProjectDurationDays?: number;
    }>("/tasks"),

  getCriticalPath: () => request<CriticalPathData>("/tasks/critical-path"),

  createTask: (payload: CreateTaskPayload) =>
    request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTask: (id: string, payload: UpdateTaskPayload) =>
    request<{ updatedTask: Task }>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteTask: (id: string) =>
    request<{ deleted: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  archiveTask: (id: string) =>
    request<{ archived: boolean }>(`/tasks/${id}/archive`, { method: "PATCH" }),

  getArchivedTasks: () => request<{ tasks: ArchivedTask[] }>("/tasks/archived"),

  restoreTask: (id: string) =>
    request<{ restored: boolean }>(`/tasks/${id}/restore`, { method: "PATCH" }),

  exportWorkspace: () => request<WorkspaceExport>("/tasks/export"),

  rescheduleTask: (id: string, payload: ReschedulePayload) =>
    request<{
      changedTask: { id: string; startDate: string; durationDays: number };
      affectedTasks: Array<{
        id: string;
        title: string;
        oldStartDate: string;
        newStartDate: string;
      }>;
    }>(`/tasks/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  updateTaskStatus: (id: string, boardStatus: string) =>
    request<{
      updatedTask: { id: string; boardStatus: string };
      reevaluatedDownstream: Array<{
        id: string;
        dependencyStatus: "Blocked" | "Ready";
      }>;
    }>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ boardStatus }),
    }),

  addDependency: (from: string, to: string) =>
    request<{
      updatedTask: Task;
      affectedTasks?: Array<{
        id: string;
        title: string;
        oldStartDate: string;
        newStartDate: string;
      }>;
    }>("/dependencies", {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),

  removeDependency: (from: string, to: string) =>
    request<{ updatedTask: Task }>("/dependencies", {
      method: "DELETE",
      body: JSON.stringify({ from, to }),
    }),

  getAISuggestions: (payload: {
    title: string;
    description?: string;
    taskId?: string;
  }) =>
    request<{ suggestions: AISuggestion[] }>("/ai/suggest-dependencies", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logAISuggestionFeedback: (payload: AISuggestionFeedback) =>
    request<{ logged: boolean }>("/ai/suggestion-feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
