import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Workspace } from "../models/workspace.model";
import { Task } from "../models/task.model";
import { AISuggestionAudit } from "../models/aiSuggestionAudit.model";

interface WorkspaceSummary {
  id: string;
  name: string;
  role: "owner" | "member";
}

export interface AuthSessionResponse {
  user: { id: string; email: string; displayName: string };
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}

function regenerateSession(
  req: Request,
  userId: string,
  workspaceId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }

      req.session.userId = userId;
      req.session.workspaceId = workspaceId;
      req.session.save((saveError) => {
        if (saveError) reject(saveError);
        else resolve();
      });
    });
  });
}

export async function buildAuthSession(
  userId: string,
  preferredWorkspaceId?: string,
): Promise<AuthSessionResponse | null> {
  const user = await User.findById(userId);
  if (!user) return null;

  const workspaces = await Workspace.find({ "members.userId": user._id });
  if (workspaces.length === 0) return null;

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ??
    workspaces[0];

  return {
    user: { id: user.id, email: user.email, displayName: user.displayName },
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      role:
        workspace.members.find((member) => member.userId.equals(user._id))
          ?.role ?? "member",
    })),
    activeWorkspaceId: activeWorkspace.id,
  };
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function register(req: Request, res: Response): Promise<void> {
  const { displayName, email, password } = req.body ?? {};
  if (
    typeof displayName !== "string" ||
    !displayName.trim() ||
    displayName.trim().length > 80 ||
    typeof email !== "string" ||
    !validEmail(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    res.status(400).json({
      error: "Enter a name, valid email, and password of 10-72 bytes",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    res.status(409).json({
      error: "An account with this email already exists",
      code: "EMAIL_IN_USE",
    });
    return;
  }

  const legacyWorkspaceCount = await Workspace.countDocuments();
  const user = await User.create({
    displayName: displayName.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
  });

  const workspace = await Workspace.create({
    name: `${displayName.trim()}'s Workspace`,
    ownerId: user._id,
    members: [{ userId: user._id, role: "owner" }],
  });

  if (legacyWorkspaceCount === 0) {
    await Task.updateMany(
      { workspaceId: { $exists: false } },
      { $set: { workspaceId: workspace._id } },
    );
    await AISuggestionAudit.updateMany(
      { workspaceId: { $exists: false } },
      { $set: { workspaceId: workspace._id } },
    );
  }

  await regenerateSession(req, user.id, workspace.id);
  res.status(201).json(await buildAuthSession(user.id, workspace.id));
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({
      error: "Email and password are required",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+passwordHash",
  );
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({
      error: "Email or password is incorrect",
      code: "INVALID_CREDENTIALS",
    });
    return;
  }

  const workspace = await Workspace.findOne({ "members.userId": user._id });
  if (!workspace) {
    res.status(403).json({
      error: "This account does not belong to a workspace",
      code: "NO_WORKSPACE_ACCESS",
    });
    return;
  }

  await regenerateSession(req, user.id, workspace.id);
  res.json(await buildAuthSession(user.id, workspace.id));
}

export async function getCurrentSession(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = await buildAuthSession(
    req.session.userId!,
    req.session.workspaceId,
  );
  if (!payload) {
    res
      .status(401)
      .json({ error: "Session is no longer valid", code: "UNAUTHENTICATED" });
    return;
  }

  req.session.workspaceId = payload.activeWorkspaceId;
  res.json(payload);
}

export function logout(req: Request, res: Response): void {
  req.session.destroy((error) => {
    if (error) {
      res
        .status(500)
        .json({ error: "Could not end session", code: "SERVER_ERROR" });
      return;
    }

    res.clearCookie("taskflow.sid", {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" ||
        process.env.COOKIE_SAME_SITE === "none",
      sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
    });
    res.status(204).end();
  });
}

export async function addWorkspaceMember(
  req: Request,
  res: Response,
): Promise<void> {
  const email = req.body?.email;
  const workspaceId = req.params.id as string;

  if (typeof email !== "string" || !validEmail(email)) {
    res
      .status(400)
      .json({ error: "A valid email is required", code: "VALIDATION_ERROR" });
    return;
  }
  if (!Types.ObjectId.isValid(workspaceId)) {
    res
      .status(400)
      .json({ error: "Invalid workspace ID", code: "VALIDATION_ERROR" });
    return;
  }

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    ownerId: req.session.userId,
  });
  if (!workspace) {
    res
      .status(404)
      .json({
        error: "Workspace not found or not owned by you",
        code: "NOT_FOUND",
      });
    return;
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    res.status(404).json({
      error: "That person must create an account before you can add them",
      code: "USER_NOT_FOUND",
    });
    return;
  }

  if (workspace.members.some((member) => member.userId.equals(user._id))) {
    res
      .status(409)
      .json({
        error: "User is already a workspace member",
        code: "ALREADY_MEMBER",
      });
    return;
  }

  workspace.members.push({
    userId: user._id,
    role: "member",
    joinedAt: new Date(),
  });
  await workspace.save();
  res
    .status(201)
    .json({
      member: { id: user.id, email: user.email, displayName: user.displayName },
    });
}
