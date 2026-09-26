import {
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  Flame,
  GitBranch,
  LockKeyhole,
  Sparkles,
  Users,
} from "lucide-react";

interface PreviewTask {
  title: string;
  state: "READY" | "BLOCKED" | "DONE";
  tone: "ready" | "blocked" | "done";
  critical?: boolean;
  requires?: string;
}

const columns: Array<{ name: string; count: string; tasks: PreviewTask[] }> = [
  {
    name: "BACKLOG",
    count: "02",
    tasks: [
      { title: "Write release checklist", state: "READY", tone: "ready" },
      {
        title: "Prepare stakeholder review",
        state: "BLOCKED",
        tone: "blocked",
        requires: "Release checklist",
      },
    ],
  },
  {
    name: "IN PROGRESS",
    count: "01",
    tasks: [
      {
        title: "Build dependency API",
        state: "READY",
        tone: "ready",
        critical: true,
      },
    ],
  },
  {
    name: "REVIEW",
    count: "01",
    tasks: [
      {
        title: "Verify schedule propagation",
        state: "READY",
        tone: "ready",
        critical: true,
        requires: "Dependency API",
      },
    ],
  },
  {
    name: "DONE",
    count: "01",
    tasks: [{ title: "Model task relationships", state: "DONE", tone: "done" }],
  },
];

const principles = [
  {
    number: "01",
    title: "Dependencies are real edges",
    description:
      "Connect prerequisites directly. TaskFlow checks every proposed edge for cycles before it changes the graph.",
  },
  {
    number: "02",
    title: "Readiness is calculated",
    description:
      "A task is Ready only when all its prerequisites are Done. Otherwise it is Blocked, without a manual status to drift.",
  },
  {
    number: "03",
    title: "Schedule impact is propagated",
    description:
      "Date and duration changes move downstream work in dependency order. Reconverging paths use the maximum delay, not the sum.",
  },
];

export function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6]">
      <header className="border-b border-white/10 px-5 sm:px-8">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-white no-underline"
          >
            <span className="pk-square bg-white" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">
              TASKFLOW // PRO
            </span>
          </a>
          <nav className="flex items-center gap-5 font-mono text-[10px] uppercase text-neutral-400">
            <a className="hidden sm:inline hover:text-white" href="#engine">
              ENGINE
            </a>
            <a className="hidden sm:inline hover:text-white" href="#teams">
              WORKSPACES
            </a>
            <a
              href="/app"
              className="border border-white/20 px-3 py-2 text-white hover:bg-white hover:text-black"
            >
              OPEN APP
            </a>
          </nav>
        </div>
      </header>

      <section className="home-grid border-b border-white/10 px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl home-reveal">
          <p className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
            <span className="h-1.5 w-1.5 bg-amber-300" />
            DEPENDENCY-AWARE PROJECT WORK
          </p>
          <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
            TaskFlow Pro
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-300 sm:text-xl">
            A team task board that understands what blocks what, and how a
            change in one task moves the plan downstream.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/app"
              className="pk-button inline-flex items-center gap-2 px-5 py-3 text-xs no-underline"
            >
              OPEN YOUR WORKSPACE <ArrowRight size={14} />
            </a>
            <a
              href="#engine"
              className="inline-flex items-center gap-2 border border-white/20 px-5 py-3 font-mono text-xs text-neutral-200 no-underline hover:border-white/50"
            >
              SEE HOW IT WORKS <ArrowDownRight size={14} />
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/10 pt-4 font-mono text-[10px] uppercase text-neutral-500">
            <span>Cycle checked</span>
            <span>Critical path visible</span>
            <span>Workspace scoped</span>
            <span>Human-approved AI</span>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                THE BOARD, WITH THE GRAPH INCLUDED
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                Work status and dependency status, side by side.
              </h2>
            </div>
            <p className="font-mono text-[10px] uppercase text-neutral-500">
              SAMPLE WORKSPACE / 05 TASKS
            </p>
          </div>

          <div className="border border-white/15 bg-[#0d0d10]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 font-mono text-[10px] uppercase text-neutral-500">
              <span>PROJECT DELIVERY</span>
              <span className="flex items-center gap-2 text-amber-300">
                <Flame size={12} /> CRITICAL CHAIN: 9 DAYS
              </span>
            </div>
            <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {columns.map((column) => (
                <section key={column.name} className="min-w-0">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-3 font-mono text-[10px] uppercase text-neutral-400">
                    <span>{column.name}</span>
                    <span>{column.count}</span>
                  </div>
                  <div className="space-y-2 p-3">
                    {column.tasks.map((task) => (
                      <article
                        key={task.title}
                        className={`border border-white/10 border-l-2 bg-[#121216] p-3 ${
                          task.critical
                            ? "border-l-amber-400"
                            : task.tone === "blocked"
                              ? "border-l-rose-400"
                              : task.tone === "done"
                                ? "border-l-neutral-600"
                                : "border-l-emerald-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase text-neutral-400">
                          {task.tone === "blocked" ? (
                            <span className="text-rose-300">BLOCKED</span>
                          ) : task.tone === "done" ? (
                            <span className="text-neutral-400">DONE</span>
                          ) : (
                            <span className="text-emerald-300">READY</span>
                          )}
                          {task.critical && (
                            <span className="ml-auto flex items-center gap-1 text-amber-300">
                              <Flame size={9} /> CRITICAL
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-xs font-semibold text-white">
                          {task.title}
                        </h3>
                        {task.requires && (
                          <p className="mt-2 border-t border-white/5 pt-2 font-mono text-[9px] text-neutral-500">
                            REQUIRES: {task.requires}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <p className="mt-3 font-mono text-[10px] text-neutral-500">
            Board columns show execution progress. Ready/Blocked is derived from
            prerequisite completion.
          </p>
        </div>
      </section>

      <section
        id="engine"
        className="border-b border-white/10 bg-[#101014] px-5 py-14 sm:px-8 sm:py-20"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
              THE SCHEDULING ENGINE
            </p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              A change upstream should not become guesswork downstream.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-neutral-400">
              TaskFlow models prerequisites as a directed graph. It rejects
              circular edges, calculates readiness from task state, and
              recalculates the schedule when dates or durations change.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 border-l-2 border-amber-400 pl-3 font-mono text-xs text-neutral-200">
              <GitBranch size={14} className="text-amber-300" />
              MAX-PATH PROPAGATION / NO DOUBLE COUNTING
            </div>
          </div>

          <div className="border-t border-white/15 pt-2">
            {principles.map((principle) => (
              <article
                key={principle.number}
                className="grid gap-3 border-b border-white/10 py-5 sm:grid-cols-[48px_1fr] sm:gap-5"
              >
                <span className="font-mono text-xs text-amber-300">
                  {principle.number}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {principle.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
                    {principle.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">
              HUMAN-APPROVED AI
            </p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Suggestions can help. They never edit your graph for you.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-neutral-400">
              The advisor considers tasks already in the workspace and explains
              each proposed prerequisite. Accept or reject every suggestion; the
              normal cycle check still guards accepted edges.
            </p>
          </div>
          <div className="border-y border-white/15 py-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
              <Sparkles size={13} className="text-emerald-300" />
              GROUNDED RECOMMENDATION
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              Build dependency API
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-400">
              UI integration tests typically depend on the API being available
              first.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 border border-emerald-800/70 px-2.5 py-1.5 font-mono text-[10px] text-emerald-200">
                <CheckCircle2 size={11} /> ACCEPTED BY A PERSON
              </span>
              <span className="border border-white/10 px-2.5 py-1.5 font-mono text-[10px] text-neutral-500">
                CYCLE VALIDATION REQUIRED
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="teams"
        className="border-b border-white/10 bg-[#101014] px-5 py-14 sm:px-8 sm:py-20"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">
              PRIVATE WORKSPACES
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
              One team, one shared graph. Separate from every other workspace.
            </h2>
            <p className="mt-5 leading-relaxed text-neutral-400">
              Sign in to create a workspace. Owners can add existing TaskFlow
              accounts as members, and switch between workspaces without mixing
              task data.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 font-mono text-[10px] uppercase text-neutral-400">
            <span className="inline-flex items-center gap-2">
              <LockKeyhole size={13} className="text-sky-300" /> Private
              sessions
            </span>
            <span className="inline-flex items-center gap-2">
              <Users size={13} className="text-sky-300" /> Owner and member
              roles
            </span>
          </div>
        </div>
      </section>

      <footer className="px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-white">
              TASKFLOW // PRO
            </p>
            <p className="mt-1 font-mono text-[10px] text-neutral-500">
              DETERMINISTIC WORKFLOWS FOR DEPENDENCY-HEAVY PROJECTS
            </p>
          </div>
          <a
            href="/app"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase text-white underline underline-offset-4 hover:text-amber-200"
          >
            OPEN THE WORKSPACE <ArrowRight size={13} />
          </a>
        </div>
      </footer>
    </main>
  );
}
