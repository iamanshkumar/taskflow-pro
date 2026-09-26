import { Router } from "express";
import {
  getTasks,
  getCriticalPath,
  createTask,
  updateTask,
  deleteTask,
  rescheduleTask,
  updateTaskStatus,
  getArchivedTasks,
  archiveTask,
  restoreTask,
  exportWorkspaceTasks,
} from "../controllers/tasks.controller";

const router = Router();

router.get("/", getTasks);
router.get("/critical-path", getCriticalPath);
router.get("/archived", getArchivedTasks);
router.get("/export", exportWorkspaceTasks);
router.post("/", createTask);
router.patch("/:id/archive", archiveTask);
router.patch("/:id/restore", restoreTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);
router.patch("/:id/reschedule", rescheduleTask);
router.patch("/:id/status", updateTaskStatus);

export default router;
