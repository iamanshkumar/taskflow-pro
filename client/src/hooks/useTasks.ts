import { useState, useEffect, useCallback } from "react";
import type {
  Task,
  BoardStatus,
  CreateTaskPayload,
  UpdateTaskPayload,
  ReschedulePayload,
} from "../types/task";
import { apiClient, ApiError } from "../api/client";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
};

export function useTasks(workspaceId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criticalPath, setCriticalPath] = useState<string[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!workspaceId) {
      setTasks([]);
      setCriticalPath([]);
      setTotalDuration(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.getTasks();
      setTasks(res.tasks);
      if (res.criticalPath) setCriticalPath(res.criticalPath);
      if (res.totalProjectDurationDays !== undefined) {
        setTotalDuration(res.totalProjectDurationDays);
      }
      setError(null);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let isMounted = true;

    const loadTasks = async () => {
      if (!workspaceId) {
        setTasks([]);
        setCriticalPath([]);
        setTotalDuration(0);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await apiClient.getTasks();
        if (!isMounted) return;

        setTasks(res.tasks);
        if (res.criticalPath) setCriticalPath(res.criticalPath);
        if (res.totalProjectDurationDays !== undefined) {
          setTotalDuration(res.totalProjectDurationDays);
        }
        setError(null);
      } catch (error: unknown) {
        if (!isMounted) return;
        setError(getErrorMessage(error));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const createTask = async (payload: CreateTaskPayload): Promise<boolean> => {
    try {
      const created = await apiClient.createTask(payload);

      if (payload.dependsOn && payload.dependsOn.length > 0) {
        for (const prereqId of payload.dependsOn) {
          try {
            await apiClient.addDependency(prereqId, created.id);
          } catch (dependencyError: unknown) {
            console.warn(
              "Failed to attach initial dependency:",
              dependencyError,
            );
          }
        }
      }

      await fetchTasks();
      setError(null);
      return true;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setError(message);
      return false;
    }
  };

  const updateTask = async (
    id: string,
    payload: UpdateTaskPayload,
  ): Promise<boolean> => {
    try {
      await apiClient.updateTask(id, payload);
      await fetchTasks();
      return true;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setError(message);
      throw error;
    }
  };

  const moveTask = async (taskId: string, newStatus: BoardStatus) => {
    const previousTasks = [...tasks];

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, boardStatus: newStatus } : t)),
    );

    try {
      const { updatedTask, reevaluatedDownstream } =
        await apiClient.updateTaskStatus(taskId, newStatus);

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === updatedTask.id) {
            return {
              ...t,
              boardStatus: updatedTask.boardStatus as BoardStatus,
            };
          }

          const downstream = reevaluatedDownstream?.find((r) => r.id === t.id);
          return downstream
            ? { ...t, dependencyStatus: downstream.dependencyStatus }
            : t;
        }),
      );
      setError(null);
    } catch (error: unknown) {
      setTasks(previousTasks);
      const message = getErrorMessage(error);
      setError(message);
      throw error;
    }
  };

  const rescheduleTask = async (taskId: string, payload: ReschedulePayload) => {
    try {
      const result = await apiClient.rescheduleTask(taskId, payload);
      await fetchTasks();
      return result;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setError(message);
      throw error;
    }
  };

  const archiveTask = async (
    taskId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.archiveTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await fetchTasks();
      return { success: true };
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const addDependency = async (
    from: string,
    to: string,
  ): Promise<{ success: boolean; error?: string; cyclicPath?: string[] }> => {
    try {
      await apiClient.addDependency(from, to);
      await fetchTasks();
      return { success: true };
    } catch (error: unknown) {
      const details = error instanceof ApiError ? error.details : undefined;
      const cyclicPath = details?.path;
      return {
        success: false,
        error: getErrorMessage(error),
        cyclicPath,
      };
    }
  };

  const removeDependency = async (
    from: string,
    to: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.removeDependency(from, to);
      await fetchTasks();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  return {
    tasks,
    criticalPath,
    totalDuration,
    loading,
    error,
    refresh: fetchTasks,
    createTask,
    updateTask,
    moveTask,
    rescheduleTask,
    archiveTask,
    addDependency,
    removeDependency,
  };
}
