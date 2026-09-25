import { Request, Response } from "express";
import { Task, ITask } from "../models/task.model";
import { TaskNode, buildForwardAdjacency } from "../engine/graph";
import { deriveStatus } from "../engine/statusDerivation";
import { propagate } from "../engine/scheduler";
import { handleStatusRegression } from "../engine/rollback";

function docToTaskNode(doc: any): TaskNode {
  return {
    id: doc._id.toString(),
    startDate: new Date(doc.startDate),
    durationDays: doc.durationDays,
    dependsOn: doc.dependsOn.map((id: any) => id.toString()),
    status: doc.boardStatus,
  };
}

export async function getTasks(req: Request, res: Response): Promise<void> {
  try {
    const rawTasks = await Task.find({}).lean();
    const taskNodes = rawTasks.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));

    const responseTasks = rawTasks.map((doc) => {
      const node = taskMap.get(doc._id.toString())!;
      return {
        id: doc._id.toString(),
        title: doc.title,
        description: doc.description,
        boardStatus: doc.boardStatus,
        dependencyStatus: deriveStatus(node, taskMap),
        startDate: doc.startDate,
        durationDays: doc.durationDays,
        dependsOn: doc.dependsOn,
        createdAt: doc.createdAt,
      };
    });

    res.json({ tasks: responseTasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, startDate, durationDays } = req.body;
    if (!title || !startDate || !durationDays) {
      res.status(400).json({
        error: "Title, startDate, and durationDays are required",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const newTask = await Task.create({
      title,
      description: description || "",
      startDate,
      durationDays,
      dependsOn: [],
    });

    res.status(201).json(newTask);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: "VALIDATION_ERROR" });
  }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const dependents = await Task.find({ dependsOn: id }).select("_id");
    if (dependents.length > 0) {
      res.status(409).json({
        error: `Cannot delete: ${dependents.length} task(s) depend on this task`,
        code: "TASK_HAS_DEPENDENTS",
        details: { dependentIds: dependents.map((d) => d._id.toString()) },
      });
      return;
    }

    const deleted = await Task.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function rescheduleTask(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { startDate, durationDays } = req.body;

    const taskToUpdate = await Task.findById(id);
    if (!taskToUpdate) {
      res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
      return;
    }

    if (startDate) taskToUpdate.startDate = new Date(startDate);
    if (durationDays) taskToUpdate.durationDays = durationDays;
    await taskToUpdate.save();

    const allDocs = await Task.find({}).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
    const adj = buildForwardAdjacency(taskNodes);

    const propagatedStarts = propagate(taskMap, adj);

    const bulkOps = [];
    const affectedTasks = [];

    for (const [taskId, newStart] of propagatedStarts.entries()) {
      const originalDoc = allDocs.find((d) => d._id.toString() === taskId)!;
      if (originalDoc.startDate.getTime() !== newStart.getTime()) {
        bulkOps.push({
          updateOne: {
            filter: { _id: taskId },
            update: { $set: { startDate: newStart } },
          },
        });
        affectedTasks.push({
          id: taskId,
          oldStartDate: originalDoc.startDate,
          newStartDate: newStart,
        });
      }
    }

    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }

    res.json({
      changedTask: {
        id,
        startDate: taskToUpdate.startDate,
        durationDays: taskToUpdate.durationDays,
      },
      affectedTasks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function updateTaskStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { boardStatus } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
      return;
    }

    const oldStatus = task.boardStatus;
    task.boardStatus = boardStatus;
    await task.save();

    const allDocs = await Task.find({}).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
    const adj = buildForwardAdjacency(taskNodes);

    const affectedIds = handleStatusRegression(id, boardStatus, oldStatus, adj);

    const reevaluatedDownstream = affectedIds.map((downstreamId) => {
      const node = taskMap.get(downstreamId)!;
      return {
        id: downstreamId,
        dependencyStatus: deriveStatus(node, taskMap),
      };
    });

    res.json({
      updatedTask: task,
      reevaluatedDownstream,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}