import type { NextFunction, Request, Response } from "express";
import { Workspace } from "../models/workspace.model";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res
      .status(401)
      .json({ error: "Sign in required", code: "UNAUTHENTICATED" });
    return;
  }

  next();
}

export async function requireWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId, workspaceId } = req.session;
  if (!userId || !workspaceId) {
    res
      .status(401)
      .json({ error: "Sign in required", code: "UNAUTHENTICATED" });
    return;
  }

  try {
    const isMember = await Workspace.exists({
      _id: workspaceId,
      "members.userId": userId,
    });

    if (!isMember) {
      res.status(403).json({
        error: "Workspace access denied",
        code: "WORKSPACE_ACCESS_DENIED",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
