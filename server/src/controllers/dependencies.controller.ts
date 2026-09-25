import { Request, Response } from "express";
import { Task } from "../models/task.model";
import { TaskNode, buildForwardAdjacency } from "../engine/graph";
import { wouldCreateCycle } from "../engine/cycleDetection";

function docToTaskNode(doc: any): TaskNode {
  return {
    id: doc._id.toString(),
    startDate: new Date(doc.startDate),
    durationDays: doc.durationDays,
    dependsOn: doc.dependsOn.map((id: any) => id.toString()),
    status: doc.boardStatus,
  };
}

export async function addDependency(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      res
        .status(400)
        .json({
          error: "from and to IDs are required",
          code: "VALIDATION_ERROR",
        });
      return;
    }

    const allDocs = await Task.find({}).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const adj = buildForwardAdjacency(taskNodes);

    const cycleCheck = wouldCreateCycle(adj, from, to);
    if (cycleCheck.cycle) {
      res.status(409).json({
        error: "This dependency would create a circular relationship",
        code: "CYCLE_DETECTED",
        details: { path: cycleCheck.path },
      });
      return;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      to,
      { $addToSet: { dependsOn: from } },
      { new: true },
    );

    res.json({ updatedTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function removeDependency(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { from, to } = req.body;

    const updatedTask = await Task.findByIdAndUpdate(
      to,
      { $pull: { dependsOn: from } },
      { new: true },
    );

    res.json({ updatedTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}
