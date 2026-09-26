import test from "node:test";
import assert from "node:assert/strict";

import { buildForwardAdjacency, type TaskNode } from "./engine/graph";
import { getDownstreamTaskIds } from "./engine/rollback";
import { deriveStatus } from "./engine/statusDerivation";

function makeTask(
  id: string,
  status: TaskNode["status"],
  dependsOn: string[] = [],
): TaskNode {
  return {
    id,
    startDate: new Date("2026-09-20"),
    durationDays: 1,
    dependsOn,
    status,
  };
}

test("derives Ready only when every prerequisite is Done", () => {
  const nodes = [
    makeTask("root", "Done"),
    makeTask("completed", "Done", ["root"]),
    makeTask("active", "In Progress", ["completed"]),
    makeTask("waiting", "Backlog", ["completed", "active"]),
  ];
  const tasks = new Map(nodes.map((node) => [node.id, node]));

  assert.equal(deriveStatus(tasks.get("root")!, tasks), "Ready");
  assert.equal(deriveStatus(tasks.get("completed")!, tasks), "Ready");
  assert.equal(deriveStatus(tasks.get("active")!, tasks), "Ready");
  assert.equal(deriveStatus(tasks.get("waiting")!, tasks), "Blocked");
});

test("regressing a Done task reevaluates its full downstream chain", () => {
  const nodes = [
    makeTask("root", "In Progress"),
    makeTask("child", "Done", ["root"]),
    makeTask("grandchild", "Backlog", ["child"]),
  ];
  const tasks = new Map(nodes.map((node) => [node.id, node]));
  const affected = getDownstreamTaskIds("root", buildForwardAdjacency(nodes));

  assert.deepEqual(affected, ["child", "grandchild"]);
  assert.equal(deriveStatus(tasks.get("child")!, tasks), "Blocked");
  assert.equal(deriveStatus(tasks.get("grandchild")!, tasks), "Ready");
});

test("completing a prerequisite reevaluates blocked downstream tasks", () => {
  const nodes = [
    makeTask("root", "Done"),
    makeTask("child", "Backlog", ["root"]),
  ];
  const tasks = new Map(nodes.map((node) => [node.id, node]));
  const affected = getDownstreamTaskIds("root", buildForwardAdjacency(nodes));

  assert.deepEqual(affected, ["child"]);
  assert.equal(deriveStatus(tasks.get("child")!, tasks), "Ready");
});
