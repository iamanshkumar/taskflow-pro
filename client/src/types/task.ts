export type BoardStatus = "Backlog" | "In Progress" | "Review" | "Done";
export type DependencyStatus = "Blocked" | "Ready";

export interface Task {
  id: string;
  title: string;
  description: string;
  boardStatus: BoardStatus;
  dependencyStatus: DependencyStatus;
  startDate: string;
  durationDays: number;
  dependsOn: string[];
  isCritical?: boolean;
  slackDays?: number;
  createdAt: string;
}

export interface ArchivedTask {
  id: string;
  title: string;
  description: string;
  boardStatus: BoardStatus;
  startDate: string;
  durationDays: number;
  dependsOn: string[];
  archivedAt: string;
  createdAt: string;
}

export interface WorkspaceExport {
  formatVersion: 1;
  exportedAt: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    boardStatus: BoardStatus;
    startDate: string;
    durationDays: number;
    dependsOn: string[];
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  startDate: string;
  durationDays: number;
  dependsOn?: string[];
  boardStatus?: BoardStatus;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  startDate?: string;
  durationDays?: number;
  boardStatus?: BoardStatus;
}

export interface ReschedulePayload {
  startDate?: string;
  durationDays?: number;
}

export interface AISuggestion {
  taskId: string;
  title: string;
  rationale: string;
}

export interface CPMTaskMetrics {
  earlyStartDays: number;
  earlyFinishDays: number;
  lateStartDays: number;
  lateFinishDays: number;
  slackDays: number;
  isCritical: boolean;
}

export interface CriticalPathData {
  criticalTaskIds: string[];
  totalDurationDays: number;
  metrics: Record<string, CPMTaskMetrics>;
}
