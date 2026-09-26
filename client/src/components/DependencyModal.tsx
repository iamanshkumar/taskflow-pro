import React, { useState } from "react";
import type { Task } from "../types/task";
import { getErrorMessage } from "../api/client";
import {
  X,
  Trash2,
  AlertTriangle,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface DependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTask: Task | null;
  allTasks: Task[];
  onAddDependency: (
    from: string,
    to: string,
  ) => Promise<{ success: boolean; error?: string; cyclicPath?: string[] }>;
  onRemoveDependency: (
    from: string,
    to: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function DependencyModal({
  isOpen,
  onClose,
  targetTask,
  allTasks,
  onAddDependency,
  onRemoveDependency,
}: DependencyModalProps) {
  const [selectedPrereqId, setSelectedPrereqId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cyclicPath, setCyclicPath] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !targetTask) return null;

  const currentPrereqs = (targetTask.dependsOn || [])
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];

  const downstreamDependents = allTasks.filter((t) =>
    (t.dependsOn || []).includes(targetTask.id),
  );

  const eligiblePrereqs = allTasks.filter(
    (t) =>
      t.id !== targetTask.id && !(targetTask.dependsOn || []).includes(t.id),
  );

  const handleAdd = async () => {
    if (!selectedPrereqId) return;
    setErrorMessage(null);
    setCyclicPath(null);
    setLoading(true);

    try {
      const res = await onAddDependency(selectedPrereqId, targetTask.id);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to establish graph edge.");
        if (res.cyclicPath) {
          setCyclicPath(res.cyclicPath);
        }
      } else {
        setSelectedPrereqId("");
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error) || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (prereqId: string) => {
    setErrorMessage(null);
    setCyclicPath(null);
    setLoading(true);
    try {
      const result = await onRemoveDependency(prereqId, targetTask.id);
      if (!result.success) {
        setErrorMessage(result.error || "Failed to remove dependency.");
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getTaskTitleById = (id: string) =>
    allTasks.find((t) => t.id === id)?.title || id.slice(-6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f0f13] border border-white/15 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 text-neutral-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="pk-square bg-white" />
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-white">
                GRAPH ROUTING // DEPENDENCY PATCH-BAY
              </h2>
              <p className="text-[11px] font-mono text-neutral-500">
                TARGET:{" "}
                <span className="text-white font-semibold">
                  {targetTask.title}
                </span>
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

        {/* Cycle / Conflict Alert Banner */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-950/70 border border-rose-800 text-rose-200 font-mono text-xs">
            <div className="flex items-center gap-2 font-bold uppercase">
              <AlertTriangle size={14} className="text-rose-400" />
              <span>DFS CYCLE DETECTED // OPERATION REJECTED</span>
            </div>
            <p className="mt-1 text-neutral-300 text-[11px]">{errorMessage}</p>
            {cyclicPath && cyclicPath.length > 0 && (
              <div className="mt-2.5 p-2 bg-black border border-rose-900/60">
                <span className="text-[9px] text-neutral-400 uppercase tracking-widest block mb-1">
                  CONFLICTING PATH:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {cyclicPath.map((id, index) => (
                    <React.Fragment key={index}>
                      <span className="bg-neutral-900 text-rose-300 px-1.5 py-0.5 border border-neutral-700">
                        {getTaskTitleById(id)}
                      </span>
                      {index < cyclicPath.length - 1 && (
                        <ArrowRight size={11} className="text-rose-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 space-y-6">
          {/* Add New Prerequisite */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">
              ATTACH PREREQUISITE EDGE
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedPrereqId}
                onChange={(e) => setSelectedPrereqId(e.target.value)}
                className="flex-1 px-3 py-2 bg-neutral-950 border border-white/15 focus:border-white text-xs font-mono text-white outline-none"
              >
                <option value="">-- SELECT PREREQUISITE TASK --</option>
                {eligiblePrereqs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.boardStatus}, {t.durationDays}D)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selectedPrereqId || loading}
                className="pk-button px-4 py-2 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Plus size={13} /> ATTACH
              </button>
            </div>
          </div>

          {/* Current Prerequisites List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                ACTIVE PREREQUISITES ({currentPrereqs.length})
              </label>
              <span className="text-[10px] font-mono text-neutral-500">
                ALL PREREQS MUST BE [DONE] FOR [READY]
              </span>
            </div>

            {currentPrereqs.length === 0 ? (
              <div className="p-3 bg-neutral-950 border border-white/10 text-center text-xs font-mono text-neutral-500">
                NO PREREQUISITES. NODE UNCONSTRAINED.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {currentPrereqs.map((prereq) => (
                  <div
                    key={prereq.id}
                    className="flex items-center justify-between p-2.5 bg-neutral-950 border border-white/10 text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-white">
                        {prereq.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                        <span
                          className={`px-1 py-0.2 border ${
                            prereq.boardStatus === "Done"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800/40"
                              : "bg-neutral-900 text-neutral-400 border-white/10"
                          }`}
                        >
                          {prereq.boardStatus.toUpperCase()}
                        </span>
                        <span>{prereq.durationDays} DAYS</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(prereq.id)}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                      title="Disconnect edge"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Downstream Dependents */}
          {downstreamDependents.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">
                DOWNSTREAM DEPENDENTS ({downstreamDependents.length})
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {downstreamDependents.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between p-2 bg-neutral-950 border border-white/5 text-xs font-mono text-neutral-300"
                  >
                    <span>{dep.title}</span>
                    <span className="text-[10px] text-neutral-500">
                      BOUND TO THIS NODE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-5 mt-6 border-t border-white/10 font-mono text-[10px]">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <ShieldCheck size={13} className="text-white" />
            <span>READ-ONLY DFS REACHABILITY ACTIVE</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pk-button px-4 py-2 text-xs"
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}
