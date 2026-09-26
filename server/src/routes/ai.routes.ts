import { Router } from "express";
import {
  getDependencySuggestions,
  logSuggestionFeedback,
} from "../controllers/ai.controller";

const router = Router();

router.post("/suggest-dependencies", getDependencySuggestions);
router.post("/suggestion-feedback", logSuggestionFeedback);

export default router;
