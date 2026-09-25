import { Router } from "express";
import {
  getTasks,
  createTask,
  deleteTask,
  rescheduleTask,
  updateTaskStatus,
} from "../controllers/tasks.controller";

const router = Router();

router.get("/", getTasks);
router.post("/", createTask);
router.delete("/:id", deleteTask);
router.patch("/:id/reschedule", rescheduleTask);
router.patch("/:id/status", updateTaskStatus);

export default router;
