import { TaskId, AdjacencyMap, TaskNode } from "./graph";
import { topologicalOrder } from "./scheduler";

export interface CPMTaskMetrics {
  earlyStartDays: number;
  earlyFinishDays: number;
  lateStartDays: number;
  lateFinishDays: number;
  slackDays: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  criticalTaskIds: TaskId[];
  totalDurationDays: number;
  metrics: Record<TaskId, CPMTaskMetrics>;
}

/**
 * Computes Critical Path Method (CPM) metrics and identifies the critical path.
 */
export function calculateCriticalPath(
  tasks: Map<TaskId, TaskNode>,
  adjacency: AdjacencyMap,
): CriticalPathResult {
  const allIds = Array.from(tasks.keys());
  if (allIds.length === 0) {
    return {
      criticalTaskIds: [],
      totalDurationDays: 0,
      metrics: {},
    };
  }

  const order = topologicalOrder(adjacency, allIds);

  const earlyStart = new Map<TaskId, number>();
  const earlyFinish = new Map<TaskId, number>();

  // 1. Forward Pass (Early Start / Early Finish)
  for (const id of order) {
    const task = tasks.get(id)!;
    const duration = task.durationDays;

    if (task.dependsOn.length === 0) {
      earlyStart.set(id, 0);
    } else {
      let maxPrereqFinish = 0;
      for (const pId of task.dependsOn) {
        const pFinish = earlyFinish.get(pId) ?? 0;
        if (pFinish > maxPrereqFinish) {
          maxPrereqFinish = pFinish;
        }
      }
      earlyStart.set(id, maxPrereqFinish);
    }

    earlyFinish.set(id, (earlyStart.get(id) ?? 0) + duration);
  }

  // Find the maximum project finish time
  let maxProjectFinish = 0;
  for (const ef of earlyFinish.values()) {
    if (ef > maxProjectFinish) {
      maxProjectFinish = ef;
    }
  }

  // 2. Backward Pass (Late Finish / Late Start)
  const lateStart = new Map<TaskId, number>();
  const lateFinish = new Map<TaskId, number>();

  // Reverse topological order
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const task = tasks.get(id)!;
    const successors = adjacency.get(id) ?? [];

    if (successors.length === 0) {
      lateFinish.set(id, maxProjectFinish);
    } else {
      let minSuccStart = Infinity;
      for (const succId of successors) {
        const sStart = lateStart.get(succId) ?? maxProjectFinish;
        if (sStart < minSuccStart) {
          minSuccStart = sStart;
        }
      }
      lateFinish.set(id, minSuccStart === Infinity ? maxProjectFinish : minSuccStart);
    }

    lateStart.set(id, (lateFinish.get(id) ?? maxProjectFinish) - task.durationDays);
  }

  // 3. Compute Slack & Critical Path
  const criticalTaskIds: TaskId[] = [];
  const metrics: Record<TaskId, CPMTaskMetrics> = {};

  for (const id of allIds) {
    const es = earlyStart.get(id) ?? 0;
    const ef = earlyFinish.get(id) ?? 0;
    const ls = lateStart.get(id) ?? 0;
    const lf = lateFinish.get(id) ?? 0;
    const slack = Math.max(0, ls - es);
    const isCritical = slack === 0 && ef > 0;

    if (isCritical) {
      criticalTaskIds.push(id);
    }

    metrics[id] = {
      earlyStartDays: es,
      earlyFinishDays: ef,
      lateStartDays: ls,
      lateFinishDays: lf,
      slackDays: slack,
      isCritical,
    };
  }

  return {
    criticalTaskIds,
    totalDurationDays: maxProjectFinish,
    metrics,
  };
}
