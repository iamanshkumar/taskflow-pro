import { Router } from "express";
import {
  addDependency,
  removeDependency,
} from "../controllers/dependencies.controller";

const router = Router();

router.post("/", addDependency);
router.delete("/", removeDependency);

export default router;