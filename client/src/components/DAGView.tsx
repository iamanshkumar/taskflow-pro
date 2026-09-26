import type { Task } from "../types/task";
import {
  X,
  Flame,
  Clock,
  CheckCircle2,
  Lock,
  Info,
} from "lucide-react";

interface DAGViewProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  criticalPath: string[];
  totalDurationDays: number;
}

export function DAGView({
  isOpen,
  onClose,
  tasks,
  criticalPath,
  totalDurationDays,
}: DAGViewProps) {
  if (!isOpen) return null;

  const levelMap = new Map<string, number>();

  const computeLevel = (taskId: string, visited = new Set<string>()): number => {
    if (levelMap.has(taskId)) return levelMap.get(taskId)!;
    if (visited.has(taskId)) return 0;

    visited.add(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      levelMap.set(taskId, 0);
      return 0;
    }

    const maxPrereqLevel = Math.max(
      ...task.dependsOn.map((pId) => computeLevel(pId, new Set(visited))),
    );
    const lvl = maxPrereqLevel + 1;
    levelMap.set(taskId, lvl);
    return lvl;
  };

  tasks.forEach((t) => computeLevel(t.id));

  const maxLevel = Math.max(0, ...Array.from(levelMap.values()));
  const layers: Task[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    layers.push(tasks.filter((t) => levelMap.get(t.id) === i));
  }

  const criticalSet = new Set(criticalPath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c0c0f] border border-white/15 w-full max-w-6xl max-h-[90vh] flex flex-col p-6 text-neutral-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="pk-square bg-white" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-white">
                  TOPOLOGICAL DAG MATRIX // CRITICAL PATH METHOD
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 border border-amber-600/50 bg-amber-950/60 text-amber-300 flex items-center gap-1">
                  <Flame size={11} className="text-amber-400" />
                  TOTAL DURATION: {totalDurationDays} DAYS
                </span>
              </div>
              <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                HORIZONTAL HIERARCHICAL TIERS. NODES IN AMBER CONSTITUTE THE LONGEST DEPENDENCY CHAIN.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 py-2.5 font-mono text-[10px] text-neutral-400 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-amber-500/80 border border-amber-400" />
            <span className="text-neutral-200 uppercase">CRITICAL PATH (SLACK = 0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-neutral-900 border border-white/20" />
            <span className="uppercase">STANDARD NODE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span>READY</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock size={11} className="text-rose-400" />
            <span>BLOCKED</span>
          </div>
        </div>

        {/* DAG Visual Representation Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto py-6 pr-2">
          {tasks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-neutral-500 font-mono text-xs">
              <Info size={20} className="mb-2" />
              <span>NO ACTIVE GRAPH NODES RECORDED.</span>
            </div>
          ) : (
            <div className="flex items-start gap-6 min-w-max pb-4">
              {layers.map((layerTasks, layerIdx) => (
                <div key={layerIdx} className="flex flex-col gap-3 min-w-[260px]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 bg-neutral-950 px-3 py-1.5 border border-white/10 text-center">
                    TIER {String(layerIdx + 1).padStart(2, "0")} ({layerIdx === 0 ? "ROOT PRESETS" : `LEVEL ${layerIdx}`})
                  </div>

                  <div className="space-y-3">
                    {layerTasks.map((t) => {
                      const isCritical = criticalSet.has(t.id);
                      const isBlocked = t.dependencyStatus === "Blocked";

                      return (
                        <div
                          key={t.id}
                          className={`p-3.5 border transition-all ${
                            isCritical
                              ? "bg-[#141419] border-amber-500/70 shadow-lg shadow-amber-500/5"
                              : "bg-[#0f0f13] border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2 font-mono text-[10px]">
                            <span
                              className={`px-1.5 py-0.2 uppercase ${
                                isBlocked
                                  ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                                  : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                              }`}
                            >
                              {t.dependencyStatus}
                            </span>
                            {isCritical && (
                              <span className="flex items-center gap-1 font-bold text-amber-300">
                                <Flame size={10} /> CRITICAL
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-xs text-white mb-1.5 tracking-tight">
                            {t.title}
                          </h4>

                          <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400 pt-2 border-t border-white/5">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {t.durationDays}D
                            </span>
                            <span className="uppercase text-neutral-300">
                              {t.boardStatus}
                            </span>
                          </div>

                          {t.dependsOn && t.dependsOn.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/5 font-mono text-[9px] text-neutral-500">
                              <span>PREDECESSORS: </span>
                              {t.dependsOn
                                .map((pId) => tasks.find((item) => item.id === pId)?.title || pId.slice(-4))
                                .join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="pk-button px-5 py-2 text-xs"
          >
            DISMISS INSPECTOR
          </button>
        </div>
      </div>
    </div>
  );
}
