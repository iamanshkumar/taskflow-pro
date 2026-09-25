import { TaskId , TaskNode } from "./graph";

export type DependencyStatus = "Blocked" | "Ready";

export function deriveStatus(
  task: TaskNode,
  allTasks: Map<TaskId, TaskNode>,
): DependencyStatus {
    if (task.dependsOn.length === 0) return "Ready";

    const allPrereqsDone = task.dependsOn.every(
      (prereqId) => allTasks.get(prereqId)?.status === "Done",
    );

    return allPrereqsDone ? "Ready" : "Blocked";
}