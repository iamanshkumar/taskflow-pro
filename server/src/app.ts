import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import tasksRouter from "./routes/tasks.routes";
import dependenciesRouter from "./routes/dependencies.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskflow_pro";

app.use(cors());
app.use(express.json());

app.use("/api/tasks", tasksRouter);
app.use("/api/dependencies", dependenciesRouter);

connectDB(MONGODB_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
