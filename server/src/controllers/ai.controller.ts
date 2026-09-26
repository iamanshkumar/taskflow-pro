import { Request, Response } from "express";
import { Types } from "mongoose";
import { Task } from "../models/task.model";
import { AISuggestionAudit } from "../models/aiSuggestionAudit.model";
import { TaskNode, buildForwardAdjacency } from "../engine/graph";
import { suggestDependencies } from "../services/aiSuggestion.service";

function docToTaskNode(doc: any): TaskNode {
  return {
    id: doc._id.toString(),
    startDate: new Date(doc.startDate),
    durationDays: doc.durationDays,
    dependsOn: (doc.dependsOn || []).map((id: any) => id.toString()),
    status: doc.boardStatus,
  };
}

export async function getDependencySuggestions(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const workspaceId = req.session.workspaceId!;
    const { title, description, taskId } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({
        error: "Task title is required for AI dependency suggestions",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const allDocs = await Task.find({ workspaceId, archivedAt: null }).lean();
    const taskNodes = allDocs.map(docToTaskNode);
    const adj = buildForwardAdjacency(taskNodes);

    // Filter out the task itself if it already exists
    const existingTasks = allDocs
      .filter((d) => !taskId || d._id.toString() !== taskId)
      .map((d) => ({
        id: d._id.toString(),
        title: d.title,
        description: d.description,
      }));

    const suggestions = await suggestDependencies(
      {
        id: taskId,
        title: title.trim(),
        description: description || "",
      },
      existingTasks,
      adj,
    );

    res.json({ suggestions });
  } catch (error: any) {
    console.error("Error in AI suggestion controller:", error);
    res.status(500).json({
      error: error.message || "Failed to generate AI dependency suggestions",
      code: "AI_PROVIDER_ERROR",
    });
  }
}

export async function logSuggestionFeedback(
  req: Request,
  res: Response,
): Promise<void> {
  const workspaceId = req.session.workspaceId!;
  const {
    targetTaskId,
    targetTaskTitle,
    suggestionTaskId,
    suggestionTitle,
    rationale,
    decision,
  } = req.body ?? {};

  if (
    typeof targetTaskTitle !== "string" ||
    !targetTaskTitle.trim() ||
    typeof suggestionTitle !== "string" ||
    !suggestionTitle.trim() ||
    typeof suggestionTaskId !== "string" ||
    !Types.ObjectId.isValid(suggestionTaskId) ||
    typeof rationale !== "string" ||
    !["accepted", "rejected"].includes(decision)
  ) {
    res.status(400).json({
      error: "A valid AI suggestion decision is required",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  if (targetTaskId !== undefined && !Types.ObjectId.isValid(targetTaskId)) {
    res.status(400).json({
      error: "Target task ID is invalid",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const [targetTask, suggestionTask] = await Promise.all([
    targetTaskId
      ? Task.findOne({
          _id: targetTaskId,
          workspaceId,
          archivedAt: null,
        }).select("_id")
      : null,
    Task.findOne({
      _id: suggestionTaskId,
      workspaceId,
      archivedAt: null,
    }).select("_id"),
  ]);

  if ((targetTaskId && !targetTask) || !suggestionTask) {
    res.status(404).json({
      error: "Target or suggested task was not found",
      code: "NOT_FOUND",
    });
    return;
  }

  await AISuggestionAudit.create({
    workspaceId,
    targetTaskId,
    targetTaskTitle: targetTaskTitle.trim(),
    suggestionTaskId,
    suggestionTitle: suggestionTitle.trim(),
    rationale: rationale.slice(0, 1000),
    decision,
  });

  res.status(201).json({ logged: true });
}
