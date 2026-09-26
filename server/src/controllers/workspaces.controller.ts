import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Workspace } from "../models/workspace.model";
import { buildAuthSession } from "./auth.controller";

function saveWorkspaceSession(
  req: Request,
  workspaceId: string,
): Promise<void> {
  req.session.workspaceId = workspaceId;
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

export async function listWorkspaces(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.session.userId!;
  const workspaces = await Workspace.find({ "members.userId": userId });
  res.json({
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      role:
        workspace.members.find((member) => member.userId.toString() === userId)
          ?.role ?? "member",
    })),
  });
}

export async function createWorkspace(
  req: Request,
  res: Response,
): Promise<void> {
  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
    res.status(400).json({
      error: "Workspace name must be between 1 and 80 characters",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const workspace = await Workspace.create({
    name: name.trim(),
    ownerId: req.session.userId,
    members: [{ userId: req.session.userId, role: "owner" }],
  });
  await saveWorkspaceSession(req, workspace.id);
  res
    .status(201)
    .json(await buildAuthSession(req.session.userId!, workspace.id));
}

export async function activateWorkspace(
  req: Request,
  res: Response,
): Promise<void> {
  const workspaceId = req.params.id as string;
  const userId = req.session.userId!;
  if (!Types.ObjectId.isValid(workspaceId)) {
    res.status(400).json({
      error: "Invalid workspace ID",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    "members.userId": userId,
  });

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    return;
  }

  await saveWorkspaceSession(req, workspace.id);
  res.json(await buildAuthSession(userId, workspace.id));
}
