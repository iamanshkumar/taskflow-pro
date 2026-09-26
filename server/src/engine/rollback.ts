import { TaskId, AdjacencyMap } from "./graph";

export function getDownstreamTaskIds(
  taskId: TaskId,
  adjacency: AdjacencyMap,
): TaskId[] {
  const affected: TaskId[] = [];
  const queue = [...(adjacency.get(taskId) ?? [])];
  const visited = new Set<TaskId>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    affected.push(current);
    queue.push(...(adjacency.get(current) ?? []));
  }

  return affected;
}
