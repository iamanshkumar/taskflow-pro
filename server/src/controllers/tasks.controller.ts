import { Request, Response } from "express";
import { Types } from "mongoose";
import { Task } from "../models/task.model";
import { TaskNode, buildForwardAdjacency } from "../engine/graph";
import { deriveStatus } from "../engine/statusDerivation";
import { propagate } from "../engine/scheduler";
import { getDownstreamTaskIds } from "../engine/rollback";
import { calculateCriticalPath } from "../engine/criticalPath";

function docToTaskNode(doc: any): TaskNode {
  return {
    id: doc._id.toString(),
    startDate: new Date(doc.startDate),
    durationDays: doc.durationDays,
    dependsOn: (doc.dependsOn || []).map((id: any) => id.toString()),
    status: doc.boardStatus,
  };
}

export async function getTasks(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const rawTasks = await Task.find({ workspaceId, archivedAt: null }).lean();
    const taskNodes = rawTasks.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
    const adj = buildForwardAdjacency(taskNodes);

    // Compute critical path metrics for enriched task metadata
    const cpResult = calculateCriticalPath(taskMap, adj);
    const criticalSet = new Set(cpResult.criticalTaskIds);

    const responseTasks = rawTasks.map((doc) => {
      const node = taskMap.get(doc._id.toString())!;
      const metrics = cpResult.metrics[node.id];
      return {
        id: doc._id.toString(),
        title: doc.title,
        description: doc.description,
        boardStatus: doc.boardStatus,
        dependencyStatus: deriveStatus(node, taskMap),
        startDate: doc.startDate,
        durationDays: doc.durationDays,
        dependsOn: (doc.dependsOn || []).map((d: any) => d.toString()),
        isCritical: criticalSet.has(node.id),
        slackDays: metrics ? metrics.slackDays : 0,
        createdAt: doc.createdAt,
      };
    });

    res.json({
      tasks: responseTasks,
      criticalPath: cpResult.criticalTaskIds,
      totalProjectDurationDays: cpResult.totalDurationDays,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const {
      title,
      description,
      startDate,
      durationDays,
      boardStatus,
      dependsOn,
    } = req.body;

    if (!title || !startDate || !durationDays) {
      res.status(400).json({
        error: "Title, startDate, and durationDays are required",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    if (
      dependsOn !== undefined &&
      (!Array.isArray(dependsOn) ||
        dependsOn.some(
          (id: unknown) =>
            typeof id !== "string" || !Types.ObjectId.isValid(id),
        ))
    ) {
      res.status(400).json({
        error: "dependsOn must contain valid task IDs",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const dependencyIds = [
      ...new Set((dependsOn as string[] | undefined) ?? []),
    ];
    if (dependencyIds.length > 0) {
      const existingDependencyCount = await Task.countDocuments({
        _id: { $in: dependencyIds },
        workspaceId,
        archivedAt: null,
      });
      if (existingDependencyCount !== dependencyIds.length) {
        res.status(404).json({
          error: "One or more prerequisite tasks were not found",
          code: "NOT_FOUND",
        });
        return;
      }
    }

    const normalizedBoardStatus =
      boardStatus &&
      ["Backlog", "In Progress", "Review", "Done"].includes(boardStatus)
        ? boardStatus
        : "Backlog";

    const normalizedDependsOn = dependencyIds.map(
      (id) => new Types.ObjectId(id),
    );

    const newTask = await Task.create({
      workspaceId,
      title: title.trim(),
      description: description || "",
      startDate: new Date(startDate),
      durationDays: Number(durationDays),
      boardStatus: normalizedBoardStatus,
      dependsOn: normalizedDependsOn,
    });

    const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
    const adj = buildForwardAdjacency(taskNodes);
    const cpResult = calculateCriticalPath(taskMap, adj);
    const criticalSet = new Set(cpResult.criticalTaskIds);
    const node = taskMap.get(newTask._id.toString())!;
    const metrics = cpResult.metrics[node.id];

    res.status(201).json({
      id: newTask._id.toString(),
      title: newTask.title,
      description: newTask.description,
      boardStatus: newTask.boardStatus,
      dependencyStatus: deriveStatus(node, taskMap),
      startDate: newTask.startDate,
      durationDays: newTask.durationDays,
      dependsOn: (newTask.dependsOn || []).map((d: any) => d.toString()),
      isCritical: criticalSet.has(node.id),
      slackDays: metrics ? metrics.slackDays : 0,
      createdAt: newTask.createdAt,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: "VALIDATION_ERROR" });
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const id = req.params.id as string;
    const { title, description, startDate, durationDays, boardStatus } =
      req.body;

    const task = await Task.findOne({ _id: id, workspaceId, archivedAt: null });
    if (!task) {
      res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
      return;
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (startDate !== undefined) task.startDate = new Date(startDate);
    if (durationDays !== undefined) task.durationDays = Number(durationDays);
    if (boardStatus !== undefined) task.boardStatus = boardStatus;

    await task.save();

    // If date/duration changed, propagate changes downstream
    if (startDate !== undefined || durationDays !== undefined) {
      const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
      const taskNodes = allDocs.map(docToTaskNode);
      const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
      const adj = buildForwardAdjacency(taskNodes);

      const propagatedStarts = propagate(taskMap, adj);
      const bulkOps = [];

      for (const [taskId, newStart] of propagatedStarts.entries()) {
        const originalDoc = allDocs.find((d) => d._id.toString() === taskId)!;
        if (originalDoc.startDate.getTime() !== newStart.getTime()) {
          bulkOps.push({
            updateOne: {
              filter: { _id: taskId },
              update: { $set: { startDate: newStart } },
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        await Task.bulkWrite(bulkOps);
      }
    }

    res.json({ updatedTask: task });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const id = req.params.id as string;
    const dependents = await Task.find({
      dependsOn: new Types.ObjectId(id) as any,
      workspaceId,
    })
      .select("_id title")
      .lean();

    if (dependents.length > 0) {
      res.status(409).json({
        error: `Cannot delete: ${dependents.length} task(s) depend on this task`,
        code: "TASK_HAS_DEPENDENTS",
        details: {
          dependentIds: dependents.map((d: any) => d._id.toString()),
          dependentTitles: dependents.map((d: any) => d.title),
        },
      });
      return;
    }

    const deleted = await Task.findOneAndDelete({ _id: id, workspaceId });
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
    const workspaceId = req.session.workspaceId!;
    const id = req.params.id as string;
    const { startDate, durationDays } = req.body;

    const taskToUpdate = await Task.findOne({
      _id: id,
      workspaceId,
      archivedAt: null,
    });
    if (!taskToUpdate) {
      res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
      return;
    }

    if (startDate) taskToUpdate.startDate = new Date(startDate);
    if (durationDays) taskToUpdate.durationDays = Number(durationDays);
    await taskToUpdate.save();

    const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
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
    const workspaceId = req.session.workspaceId!;
    const id = req.params.id as string;
    const { boardStatus } = req.body;

    if (!["Backlog", "In Progress", "Review", "Done"].includes(boardStatus)) {
      res.status(400).json({
        error: "Invalid board status",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const task = await Task.findOne({ _id: id, workspaceId, archivedAt: null });
    if (!task) {
      res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
      return;
    }

    const oldStatus = task.boardStatus;
    task.boardStatus = boardStatus;
    await task.save();

    const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
    const adj = buildForwardAdjacency(taskNodes);

    const affectedIds =
      oldStatus === boardStatus ? [] : getDownstreamTaskIds(id, adj);

    const reevaluatedDownstream = affectedIds.map((downstreamId) => {
      const node = taskMap.get(downstreamId)!;
      return {
        id: downstreamId,
        dependencyStatus: deriveStatus(node, taskMap),
      };
    });

    res.json({
      updatedTask: {
        id: task._id.toString(),
        boardStatus: task.boardStatus,
      },
      reevaluatedDownstream,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function getCriticalPath(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const taskMap = new Map(taskNodes.map((t) => [t.id, t]));
    const adj = buildForwardAdjacency(taskNodes);

    const result = calculateCriticalPath(taskMap, adj);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: "SERVER_ERROR" });
  }
}

export async function getArchivedTasks(
  req: Request,
  res: Response,
): Promise<void> {
  const workspaceId = req.session.workspaceId!;
  const tasks = await Task.find({
    workspaceId,
    archivedAt: { $ne: null },
  })
    .sort({ archivedAt: -1 })
    .lean();

  res.json({
    tasks: tasks.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      boardStatus: task.boardStatus,
      startDate: task.startDate,
      durationDays: task.durationDays,
      dependsOn: task.dependsOn.map((id) => id.toString()),
      archivedAt: task.archivedAt,
      createdAt: task.createdAt,
    })),
  });
}

export async function archiveTask(req: Request, res: Response): Promise<void> {
  const workspaceId = req.session.workspaceId!;
  const id = req.params.id as string;
  if (!Types.ObjectId.isValid(id)) {
    res
      .status(400)
      .json({ error: "Invalid task ID", code: "VALIDATION_ERROR" });
    return;
  }

  const task = await Task.findOne({ _id: id, workspaceId, archivedAt: null });
  if (!task) {
    res.status(404).json({ error: "Task not found", code: "NOT_FOUND" });
    return;
  }

  const dependents = await Task.find({
    workspaceId,
    dependsOn: task._id,
  })
    .select("_id title")
    .lean();
  if (dependents.length > 0) {
    res.status(409).json({
      error: `Cannot archive: ${dependents.length} task(s) depend on this task`,
      code: "TASK_HAS_DEPENDENTS",
      details: { dependentIds: dependents.map((item) => item._id.toString()) },
    });
    return;
  }

  task.archivedAt = new Date();
  await task.save();
  res.json({ archived: true });
}

export async function restoreTask(req: Request, res: Response): Promise<void> {
  const workspaceId = req.session.workspaceId!;
  const id = req.params.id as string;
  if (!Types.ObjectId.isValid(id)) {
    res
      .status(400)
      .json({ error: "Invalid task ID", code: "VALIDATION_ERROR" });
    return;
  }

  const task = await Task.findOne({
    _id: id,
    workspaceId,
    archivedAt: { $ne: null },
  });
  if (!task) {
    res
      .status(404)
      .json({ error: "Archived task not found", code: "NOT_FOUND" });
    return;
  }

  const activePrerequisiteCount = await Task.countDocuments({
    workspaceId,
    archivedAt: null,
    _id: { $in: task.dependsOn },
  });
  if (activePrerequisiteCount !== task.dependsOn.length) {
    res.status(409).json({
      error: "Restore this task's prerequisites first",
      code: "PREREQUISITES_ARCHIVED",
    });
    return;
  }

  task.archivedAt = null;
  await task.save();
  res.json({ restored: true });
}

export async function exportWorkspaceTasks(
  req: Request,
  res: Response,
): Promise<void> {
  const workspaceId = req.session.workspaceId!;
  const tasks = await Task.find({ workspaceId }).sort({ createdAt: 1 }).lean();

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=taskflow-workspace-${workspaceId}.json`,
  );
  res.json({
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    tasks: tasks.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      boardStatus: task.boardStatus,
      startDate: task.startDate,
      durationDays: task.durationDays,
      dependsOn: task.dependsOn.map((id) => id.toString()),
      archivedAt: task.archivedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    })),
  });
}
