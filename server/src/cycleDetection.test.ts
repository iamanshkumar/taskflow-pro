import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { wouldCreateCycle } from "./engine/cycleDetection";
import { buildForwardAdjacency } from "./engine/graph";
import { propagate } from "./engine/scheduler";

const taskGraph = [
  {
    id: "A",
    startDate: new Date("2026-09-20"),
    durationDays: 2,
    dependsOn: [],
    status: "Backlog" as const,
  },
  {
    id: "B",
    startDate: new Date("2026-09-22"),
    durationDays: 2,
    dependsOn: ["A"],
    status: "Backlog" as const,
  },
  {
    id: "C",
    startDate: new Date("2026-09-22"),
    durationDays: 2,
    dependsOn: ["A"],
    status: "Backlog" as const,
  },
  {
    id: "D",
    startDate: new Date("2026-09-24"),
    durationDays: 2,
    dependsOn: ["B", "C"],
    status: "Backlog" as const,
  },
];

test("rejects a self dependency", () => {
  const adjacency = buildForwardAdjacency(taskGraph);
  const result = wouldCreateCycle(adjacency, "A", "A");

  assert.equal(result.cycle, true);
  assert.deepEqual(result.path, ["A", "A"]);
});

test("rejects a multi-hop cycle", () => {
  const adjacency = buildForwardAdjacency(taskGraph);
  const result = wouldCreateCycle(adjacency, "A", "D");

  assert.equal(result.cycle, false);

  const cycleAdj = buildForwardAdjacency([
    ...taskGraph,
    {
      id: "E",
      startDate: new Date("2026-09-26"),
      durationDays: 2,
      dependsOn: ["D"],
      status: "Backlog" as const,
    },
  ]);

  const cycleResult = wouldCreateCycle(cycleAdj, "D", "A");
  assert.equal(cycleResult.cycle, true);
  assert.ok(Array.isArray(cycleResult.path));
});

test("allows an acyclic edge in the diamond graph", () => {
  const adjacency = buildForwardAdjacency(taskGraph);
  const cycleResult = wouldCreateCycle(adjacency, "B", "D");
  assert.equal(cycleResult.cycle, false);
});

test("propagates a diamond delay once instead of compounding it", () => {
  const changedTasks = taskGraph.map((task) =>
    task.id === "A" ? { ...task, durationDays: 5 } : task,
  );
  const taskMap = new Map(changedTasks.map((task) => [task.id, task]));
  const starts = propagate(taskMap, buildForwardAdjacency(changedTasks));
  const originalDStart = taskGraph.find((task) => task.id === "D")!.startDate;
  const propagatedDStart = starts.get("D")!;

  assert.equal(
    (propagatedDStart.getTime() - originalDStart.getTime()) / 86_400_000,
    3,
  );
});

test("propagates schedule changes through a three-level chain", () => {
  const chain = [
    {
      id: "A",
      startDate: new Date("2026-09-20"),
      durationDays: 4,
      dependsOn: [],
      status: "Backlog" as const,
    },
    {
      id: "B",
      startDate: new Date("2026-09-22"),
      durationDays: 2,
      dependsOn: ["A"],
      status: "Backlog" as const,
    },
    {
      id: "C",
      startDate: new Date("2026-09-24"),
      durationDays: 1,
      dependsOn: ["B"],
      status: "Backlog" as const,
    },
    {
      id: "D",
      startDate: new Date("2026-09-25"),
      durationDays: 1,
      dependsOn: ["C"],
      status: "Backlog" as const,
    },
  ];
  const taskMap = new Map(chain.map((task) => [task.id, task]));
  const starts = propagate(taskMap, buildForwardAdjacency(chain));

  assert.equal(starts.get("D")?.toISOString(), "2026-09-27T00:00:00.000Z");
});

test("cycle check and schedule propagation stay under 150ms for 50 tasks", () => {
  const tasks = Array.from({ length: 50 }, (_, index) => ({
    id: `task-${index}`,
    startDate: new Date("2026-09-20"),
    durationDays: 1,
    dependsOn: index === 0 ? [] : [`task-${index - 1}`],
    status: "Backlog" as const,
  }));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const adjacency = buildForwardAdjacency(tasks);
  const startedAt = performance.now();

  const cycleResult = wouldCreateCycle(adjacency, "task-0", "task-49");
  propagate(taskMap, adjacency);

  assert.equal(cycleResult.cycle, false);
  assert.ok(performance.now() - startedAt < 150);
});
