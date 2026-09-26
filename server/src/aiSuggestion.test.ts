import test from "node:test";
import assert from "node:assert/strict";

import { buildForwardAdjacency, type TaskNode } from "./engine/graph";
import {
  validateSuggestions,
  type ExistingTask,
} from "./services/aiSuggestion.service";

const makeTaskNode = (id: string, dependsOn: string[] = []): TaskNode => ({
  id,
  startDate: new Date("2026-09-20"),
  durationDays: 1,
  dependsOn,
  status: "Backlog",
});

test("filters AI suggestions that do not match an existing task title", () => {
  const existingTasks: ExistingTask[] = [
    { id: "prerequisite", title: "Real prerequisite" },
  ];
  const adjacency = buildForwardAdjacency([
    makeTaskNode("new-task"),
    makeTaskNode("prerequisite"),
  ]);
  const grounded = validateSuggestions(
    [
      { title: "Invented prerequisite", rationale: "Not on the board." },
      { title: "Real prerequisite", rationale: "It must be completed first." },
    ],
    "new-task",
    existingTasks,
    adjacency,
  );

  assert.deepEqual(grounded, [
    {
      taskId: "prerequisite",
      title: "Real prerequisite",
      rationale: "It must be completed first.",
    },
  ]);
});

test("filters AI suggestions that would introduce a dependency cycle", () => {
  const existingTasks: ExistingTask[] = [
    { id: "downstream", title: "Existing downstream task" },
  ];
  const adjacency = buildForwardAdjacency([
    makeTaskNode("target"),
    makeTaskNode("downstream", ["target"]),
  ]);
  const grounded = validateSuggestions(
    [
      {
        title: "Existing downstream task",
        rationale: "This would close a cycle.",
      },
    ],
    "target",
    existingTasks,
    adjacency,
  );

  assert.deepEqual(grounded, []);
});
