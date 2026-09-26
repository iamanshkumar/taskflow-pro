import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  getCurrentSession,
  login,
  logout,
  register,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getCurrentSession);

export default router;
