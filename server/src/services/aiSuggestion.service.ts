import { TaskId, AdjacencyMap } from "../engine/graph";
import { wouldCreateCycle } from "../engine/cycleDetection";

export interface ExistingTask {
  id: TaskId;
  title: string;
  description?: string;
}

export interface RawSuggestion {
  title: string;
  rationale: string;
}

export interface GroundedSuggestion {
  taskId: TaskId;
  title: string;
  rationale: string;
}

/**
 * Builds grounded prompt strictly instructing the LLM to only pick from existing task titles.
 */
function buildGroundedPrompt(
  newTask: { title: string; description: string },
  existingTasks: ExistingTask[],
): string {
  const existingList = existingTasks.map((t) => `- "${t.title}"`).join("\n");

  return `You are an expert software project dependency analyzer assisting a workflow management system (TaskFlow Pro).
Given a NEW task and a list of EXISTING tasks on the board, analyze logical prerequisites and suggest which existing tasks the new task most likely depends on (e.g., Schema/DB comes before API, API comes before UI/Integration tests, Auth comes before Protected routes).

CRITICAL RULES:
1. Grounding Rule: You MUST ONLY suggest tasks that are present in the EXISTING TASKS list below. Never invent, hallucinate, or rephrase task titles.
2. If no existing task is a plausible prerequisite for the new task, return an empty array [].
3. Format Rule: Return STRICT JSON format only (an array of objects) with NO Markdown code blocks, NO prose, NO backticks.

Example JSON output format:
[
  {
    "title": "Exact Title From List",
    "rationale": "Clear 1-sentence technical reason why this must finish first."
  }
]

NEW TASK:
Title: ${newTask.title}
Description: ${newTask.description || "No description provided"}

EXISTING TASKS:
${existingList}
`;
}

/**
 * Heuristic fallback for offline / mock testing or when LLM API keys are not supplied.
 */
function heuristicSuggestions(
  newTask: { title: string; description: string },
  existingTasks: ExistingTask[],
): RawSuggestion[] {
  const newText = `${newTask.title} ${newTask.description}`.toLowerCase();
  const suggestions: RawSuggestion[] = [];

  const patterns = [
    {
      keywords: ["test", "testing", "integration", "e2e", "qa", "verify"],
      prereqKeywords: [
        "api",
        "backend",
        "endpoint",
        "route",
        "schema",
        "controller",
        "engine",
      ],
      rationale:
        "Testing and verification tasks typically require the underlying backend/API components to be implemented first.",
    },
    {
      keywords: [
        "ui",
        "frontend",
        "component",
        "screen",
        "client",
        "page",
        "modal",
      ],
      prereqKeywords: ["api", "schema", "model", "endpoint", "backend"],
      rationale:
        "Frontend and UI views generally depend on backend APIs and data models being ready.",
    },
    {
      keywords: ["api", "controller", "route", "service", "endpoint"],
      prereqKeywords: ["db", "database", "schema", "model", "migration"],
      rationale:
        "API and service layers depend on database schemas and data models.",
    },
    {
      keywords: ["deploy", "ci", "cd", "docker", "production", "release"],
      prereqKeywords: ["test", "build", "api", "ui", "auth"],
      rationale:
        "Deployment and release pipelines require core application features and tests to be completed.",
    },
    {
      keywords: ["auth", "login", "profile", "dashboard"],
      prereqKeywords: ["user", "schema", "db", "model"],
      rationale:
        "User-facing auth and dashboard flows require underlying user models and database setup.",
    },
  ];

  for (const pattern of patterns) {
    const hasTrigger = pattern.keywords.some((k) => newText.includes(k));
    if (hasTrigger) {
      for (const existing of existingTasks) {
        const existText =
          `${existing.title} ${existing.description || ""}`.toLowerCase();
        const matchesPrereq = pattern.prereqKeywords.some((pk) =>
          existText.includes(pk),
        );
        if (
          matchesPrereq &&
          !suggestions.some((s) => s.title === existing.title)
        ) {
          suggestions.push({
            title: existing.title,
            rationale: pattern.rationale,
          });
        }
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Calls LLM provider (Google Gemini or OpenAI) if configured.
 */
async function callLLM(prompt: string): Promise<RawSuggestion[] | null> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!resp.ok) {
        console.warn(`Gemini API returned status ${resp.status}`);
        return null;
      }

      const json: any = await resp.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(
          text.replace(/```json\n?|\n?```/g, "").trim(),
        );
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn("Gemini API call failed, falling back to heuristic:", e);
      return null;
    }
  }

  if (openaiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) return null;

      const json: any = await resp.json();
      const text = json?.choices?.[0]?.message?.content;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.suggestions)) return parsed.suggestions;
      }
    } catch (e) {
      console.warn("OpenAI API call failed, falling back to heuristic:", e);
      return null;
    }
  }

  return null;
}

export function validateSuggestions(
  rawSuggestions: RawSuggestion[],
  targetTaskId: TaskId | undefined,
  existingTasks: ExistingTask[],
  adjacency: AdjacencyMap,
): GroundedSuggestion[] {
  const titleToTask = new Map<string, ExistingTask>();
  for (const task of existingTasks) {
    titleToTask.set(task.title.trim().toLowerCase(), task);
  }

  const grounded: GroundedSuggestion[] = [];
  const seenIds = new Set<TaskId>();

  for (const raw of rawSuggestions) {
    if (!raw.title) continue;
    const matched = titleToTask.get(raw.title.trim().toLowerCase());
    if (!matched || seenIds.has(matched.id)) continue;

    if (targetTaskId) {
      const cycleResult = wouldCreateCycle(adjacency, matched.id, targetTaskId);
      if (cycleResult.cycle) continue;
    }

    seenIds.add(matched.id);
    grounded.push({
      taskId: matched.id,
      title: matched.title,
      rationale: raw.rationale || "Suggested based on task workflow order.",
    });
  }

  return grounded;
}

/**
 * Main AI suggestion function with grounding validation & cycle pre-check.
 */
export async function suggestDependencies(
  newTask: { id?: string; title: string; description: string },
  existingTasks: ExistingTask[],
  adjacency: AdjacencyMap,
): Promise<GroundedSuggestion[]> {
  if (existingTasks.length === 0 || !newTask.title.trim()) {
    return [];
  }

  const prompt = buildGroundedPrompt(newTask, existingTasks);
  let rawSuggestions = await callLLM(prompt);

  // Fallback to intelligent heuristic if LLM fails or no key configured
  if (!rawSuggestions || rawSuggestions.length === 0) {
    rawSuggestions = heuristicSuggestions(newTask, existingTasks);
  }

  return validateSuggestions(
    rawSuggestions,
    newTask.id,
    existingTasks,
    adjacency,
  );
}
