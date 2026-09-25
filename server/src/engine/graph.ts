export type TaskId = string
export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done'

export interface TaskNode{
    id : TaskId;
    startDate : Date;
    durationDays : number;
    dependsOn : TaskId[];
    status : TaskStatus;
}

export type AdjacencyMap = Map<TaskId , TaskId[]>;

export function buildForwardAdjacency(tasks : TaskNode[]) : AdjacencyMap{
    const adj = new Map<TaskId , TaskId[]>();
    for(const task of tasks){
        adj.set(task.id , []);
    }

    for(const task of tasks){
        for(const prereqId of task.dependsOn){
            const list = adj.get(prereqId);
            if(list){
                list.push(task.id);
            }
        }
    }

    return adj;
}