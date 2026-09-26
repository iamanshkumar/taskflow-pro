import { TaskId , AdjacencyMap , TaskNode } from "./graph";

export function topologicalOrder(adjacency : AdjacencyMap , allIds : TaskId[]) : TaskId[]{
    const inDegree = new Map<TaskId , number>();

    for(const id of allIds){
        inDegree.set(id, 0);
    }

    for(const [, targets] of adjacency){
        for(const t of targets){
            inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
        }
    }

    const queue : TaskId[] = allIds.filter(id=>inDegree.get(id)===0);
    const order: TaskId[] = [];

    while(queue.length>0){
        const current = queue.shift()!;
        order.push(current);
        for(const next of adjacency.get(current) ?? []){
            inDegree.set(next, inDegree.get(next)! - 1);
            if (inDegree.get(next) === 0) {
              queue.push(next);
            }
        }
    }

    if (order.length !== allIds.length) {
      throw new Error(
        "Defensive invariant violation: Cycle detected during scheduling propagation.",
      );
    }

    return order;
}

export function propagate(
  tasks: Map<TaskId, TaskNode>,
  adjacency: AdjacencyMap,
): Map<TaskId, Date> {
    const allIds = Array.from(tasks.keys());
    const order = topologicalOrder(adjacency , allIds);

    const newStart = new Map<TaskId , Date>();
    const finish = new Map<TaskId , Date>();

    for(const id of order){
        const task = tasks.get(id)!;
        if(task.dependsOn.length===0){
            newStart.set(id, new Date(task.startDate));
        }else{
            const latestPrereqFinish = Math.max(...task.dependsOn.map(pId => finish.get(pId)!.getTime()));
            newStart.set(id , new Date(latestPrereqFinish));
        }

        const durationMs = task.durationDays * 24 * 60 * 60 * 1000;
        finish.set(id, new Date(newStart.get(id)!.getTime() + durationMs));
    }

    return newStart;
}