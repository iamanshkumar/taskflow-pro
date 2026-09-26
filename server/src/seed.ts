import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose, { Types } from "mongoose";
import { connectDB } from "./config/db";
import { Task } from "./models/task.model";
import { User } from "./models/user.model";
import { Workspace } from "./models/workspace.model";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskflow_pro";
const DEMO_EMAIL = "demo@taskflow.local";
const DEMO_PASSWORD = "TaskflowDemo123!";
const DAY_MS = 24 * 60 * 60 * 1000;

const taskSpecs = [
  {
    key: "requirements",
    title: "Finalize product requirements",
    description: "Confirm launch scope, user stories, and acceptance criteria.",
    durationDays: 2,
    startOffsetDays: 0,
    boardStatus: "Done" as const,
    dependsOn: [],
  },
  {
    key: "api-design",
    title: "Design the API contract",
    description: "Agree on task, dependency, and session endpoint behavior.",
    durationDays: 3,
    startOffsetDays: 2,
    boardStatus: "In Progress" as const,
    dependsOn: ["requirements"],
  },
  {
    key: "backend",
    title: "Build backend task workflows",
    description: "Implement task persistence, validation, and dependency APIs.",
    durationDays: 5,
    startOffsetDays: 5,
    boardStatus: "Backlog" as const,
    dependsOn: ["api-design"],
  },
  {
    key: "frontend",
    title: "Build the project board",
    description: "Deliver the Kanban board and task editing experience.",
    durationDays: 4,
    startOffsetDays: 5,
    boardStatus: "Backlog" as const,
    dependsOn: ["api-design"],
  },
  {
    key: "integration",
    title: "Integrate and test the workflows",
    description: "Verify the UI and API together across key project flows.",
    durationDays: 2,
    startOffsetDays: 10,
    boardStatus: "Backlog" as const,
    dependsOn: ["backend", "frontend"],
  },
  {
    key: "security-review",
    title: "Complete the security review",
    description: "Review authentication, session handling, and access control.",
    durationDays: 4,
    startOffsetDays: 2,
    boardStatus: "Backlog" as const,
    dependsOn: ["requirements"],
  },
  {
    key: "release-candidate",
    title: "Prepare the release candidate",
    description: "Package the integrated build and resolve release blockers.",
    durationDays: 1,
    startOffsetDays: 12,
    boardStatus: "Backlog" as const,
    dependsOn: ["integration"],
  },
  {
    key: "deployment",
    title: "Complete deployment readiness",
    description: "Confirm production configuration, monitoring, and rollback.",
    durationDays: 1,
    startOffsetDays: 13,
    boardStatus: "Backlog" as const,
    dependsOn: ["security-review", "release-candidate"],
  },
  {
    key: "launch",
    title: "Launch TaskFlow Pro",
    description: "Deploy the approved release and verify production health.",
    durationDays: 1,
    startOffsetDays: 14,
    boardStatus: "Backlog" as const,
    dependsOn: ["deployment"],
  },
];

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed data must not be created in production");
  }

  await connectDB(MONGODB_URI);

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await User.create({
      displayName: "TaskFlow Demo",
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    });
  }

  let workspace = await Workspace.findOne({
    ownerId: user._id,
    name: "TaskFlow Pro Demo",
  });
  if (!workspace) {
    workspace = await Workspace.create({
      name: "TaskFlow Pro Demo",
      ownerId: user._id,
      members: [{ userId: user._id, role: "owner" }],
    });
  }

  await Task.deleteMany({ workspaceId: workspace._id });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const ids = new Map(taskSpecs.map(({ key }) => [key, new Types.ObjectId()]));
  await Task.insertMany(
    taskSpecs.map((spec) => ({
      _id: ids.get(spec.key),
      workspaceId: workspace._id,
      title: spec.title,
      description: spec.description,
      boardStatus: spec.boardStatus,
      startDate: new Date(today.getTime() + spec.startOffsetDays * DAY_MS),
      durationDays: spec.durationDays,
      dependsOn: spec.dependsOn.map((key) => ids.get(key)!),
    })),
  );

  console.log(`Seeded ${taskSpecs.length} tasks in "${workspace.name}".`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .catch((error: unknown) => {
    console.error("Failed to seed demo data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
