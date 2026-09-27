import test from "node:test";
import assert from "node:assert/strict";

import { buildForwardAdjacency, type TaskNode } from "./engine/graph";
import {
  suggestDependencies,
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

test("uses Gemini 3.8 Flash and grounds its response", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OPENAI_API_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
    if (originalGoogleKey === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = originalGoogleKey;
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
  });

  globalThis.fetch = async (input, init) => {
    assert.equal(
      input.toString(),
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    assert.equal(
      new Headers(init?.headers).get("x-goog-api-key"),
      "test-gemini-key",
    );

    const requestBody = JSON.parse(String(init?.body));
    assert.equal(
      requestBody.generationConfig.responseMimeType,
      "application/json",
    );

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      title: "Create API endpoint",
                      rationale: "The UI needs the endpoint to load its data.",
                    },
                    { title: "Invented task", rationale: "Not on the board." },
                  ]),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const existingTasks: ExistingTask[] = [
    { id: "api-task", title: "Create API endpoint" },
  ];
  const suggestions = await suggestDependencies(
    { title: "Build account settings UI", description: "" },
    existingTasks,
    buildForwardAdjacency([makeTaskNode("api-task")]),
  );

  assert.deepEqual(suggestions, [
    {
      taskId: "api-task",
      title: "Create API endpoint",
      rationale: "The UI needs the endpoint to load its data.",
    },
  ]);
});
