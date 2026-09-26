import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";
import { connectDB } from "./config/db";
import tasksRouter from "./routes/tasks.routes";
import dependenciesRouter from "./routes/dependencies.routes";
import aiRouter from "./routes/ai.routes";
import authRouter from "./routes/auth.routes";
import workspacesRouter from "./routes/workspaces.routes";
import { requireAuth, requireWorkspace } from "./middleware/auth.middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const configuredMongoUri = process.env.MONGODB_URI?.trim();
const MONGODB_URI =
  configuredMongoUri || "mongodb://127.0.0.1:27017/taskflow_pro";
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error("SESSION_SECRET must be configured in production");
}

if (isProduction && !configuredMongoUri) {
  throw new Error("MONGODB_URI must be configured in production");
}

if (isProduction) {
  app.set("trust proxy", 1);
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  ...(process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(
  session({
    name: "taskflow.sid",
    secret: sessionSecret || "taskflow-local-development-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction || process.env.COOKIE_SAME_SITE === "none",
      sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Health Check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "taskflow-pro-backend",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/workspaces", requireAuth, workspacesRouter);
app.use("/api/tasks", requireWorkspace, tasksRouter);
app.use("/api/dependencies", requireWorkspace, dependenciesRouter);
app.use("/api/ai", requireWorkspace, aiRouter);

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "An unexpected internal server error occurred",
    code: err.code || "SERVER_ERROR",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

connectDB(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 TaskFlow Pro server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
  });

export default app;
