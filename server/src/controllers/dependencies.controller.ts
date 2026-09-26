import { Request, Response } from "express";
import { Types } from "mongoose";
import { Task } from "../models/task.model";
import { TaskNode, buildForwardAdjacency } from "../engine/graph";
import { wouldCreateCycle } from "../engine/cycleDetection";
import { propagate } from "../engine/scheduler";

function docToTaskNode(doc: any): TaskNode {
  return {
    id: doc._id.toString(),
    startDate: new Date(doc.startDate),
    durationDays: doc.durationDays,
    dependsOn: (doc.dependsOn || []).map((id: any) => id.toString()),
    status: doc.boardStatus,
  };
}

export async function addDependency(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const { from, to } = req.body;

    if (
      typeof from !== "string" ||
      typeof to !== "string" ||
      !Types.ObjectId.isValid(from) ||
      !Types.ObjectId.isValid(to)
    ) {
      res.status(400).json({
        error: "Valid from and to task IDs are required",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    if (from === to) {
      res.status(409).json({
        error: "A task cannot depend on itself",
        code: "CYCLE_DETECTED",
        details: { path: [from, to] },
      });
      return;
    }

    const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
    const existingTaskIds = new Set(allDocs.map((doc) => doc._id.toString()));
    if (!existingTaskIds.has(from) || !existingTaskIds.has(to)) {
      res.status(404).json({
        error: "Prerequisite or dependent task not found",
        code: "NOT_FOUND",
      });
      return;
    }

    const taskNodes = allDocs.map(docToTaskNode);
    const adj = buildForwardAdjacency(taskNodes);

    // 1. Read-only Cycle Validation (LLD §2)
    const cycleCheck = wouldCreateCycle(adj, from, to);
    if (cycleCheck.cycle) {
      res.status(409).json({
        error: "This dependency would create a circular relationship",
        code: "CYCLE_DETECTED",
        details: { path: cycleCheck.path },
      });
      return;
    }

    // 2. Persist edge
    const updatedTask = await Task.findOneAndUpdate(
      { _id: to, workspaceId, archivedAt: null },
      { $addToSet: { dependsOn: from } },
      { new: true },
    );

    if (!updatedTask) {
      res
        .status(404)
        .json({ error: "Target task not found", code: "NOT_FOUND" });
      return;
    }

    // 3. Re-evaluate schedule propagation in case new dependency pushes dates out
    const updatedDocs = await Task.find({
      workspaceId,
      archivedAt: null,
    }).lean();
    const updatedNodes = updatedDocs.map(docToTaskNode);
    const updatedMap = new Map(updatedNodes.map((t) => [t.id, t]));
    const updatedAdj = buildForwardAdjacency(updatedNodes);

    const propagatedStarts = propagate(updatedMap, updatedAdj);
    const bulkOps = [];
    const affectedTasks = [];

    for (const [taskId, newStart] of propagatedStarts.entries()) {
      const originalDoc = updatedDocs.find((d) => d._id.toString() === taskId)!;
      if (originalDoc.startDate.getTime() !== newStart.getTime()) {
        bulkOps.push({
          updateOne: {
            filter: { _id: taskId },
            update: { $set: { startDate: newStart } },
          },
        });
        affectedTasks.push({
          id: taskId,
          title: originalDoc.title,
          oldStartDate: originalDoc.startDate,
          newStartDate: newStart,
        });
      }
    }

    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }

    res.json({
      updatedTask,
      affectedTasks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function removeDependency(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const { from, to } = req.body;

    if (
      typeof from !== "string" ||
      typeof to !== "string" ||
      !Types.ObjectId.isValid(from) ||
      !Types.ObjectId.isValid(to)
    ) {
      res.status(400).json({
        error: "Valid from and to task IDs are required",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const edgeTasks = await Task.countDocuments({
      _id: { $in: [from, to] },
      workspaceId,
      archivedAt: null,
    });
    if (edgeTasks !== 2) {
      res.status(404).json({
        error: "Prerequisite or dependent task not found",
        code: "NOT_FOUND",
      });
      return;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: to, workspaceId, archivedAt: null },
      { $pull: { dependsOn: from } },
      { new: true },
    );

    if (!updatedTask) {
      res
        .status(404)
        .json({ error: "Target task not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ updatedTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}
