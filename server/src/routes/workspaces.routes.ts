import { Router } from "express";
import { addWorkspaceMember } from "../controllers/auth.controller";
import {
  activateWorkspace,
  createWorkspace,
  listWorkspaces,
} from "../controllers/workspaces.controller";

const router = Router();

router.get("/", listWorkspaces);
router.post("/", createWorkspace);
router.post("/:id/activate", activateWorkspace);
router.post("/:id/members", addWorkspaceMember);

export default router;
