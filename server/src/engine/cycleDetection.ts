import { TaskId , AdjacencyMap } from "./graph";

export interface CycleCheckResult{
    cycle : boolean;
    path? : TaskId[];
}

export function wouldCreateCycle(
  adjacency: AdjacencyMap,
  proposedFrom: TaskId,
  proposedTo: TaskId,
) : CycleCheckResult{
    if(proposedFrom===proposedTo){
        return {cycle : true , path : [proposedFrom , proposedTo]}
    }

    const visited = new Set<TaskId>();
    const pathStack : TaskId[] = [proposedTo];

    function dfs(current : TaskId) : TaskId[] | null {
        if(current==proposedFrom){
            return [...pathStack , current];
        }

        visited.add(current);

        for(const next of adjacency.get(current)??[]){
            if(visited.has(next)) continue;

            pathStack.push(next);
            const found = dfs(next);
            if(found) return found;
            pathStack.pop();
        }
        return null;
    }

    const cyclicPath = dfs(proposedTo);
    return cyclicPath ? {cycle : true , path : [proposedFrom , ...cyclicPath]} : {cycle : false};
}