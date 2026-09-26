import { useState } from "react";
import type { Task, ReschedulePayload } from "../types/task";
import { getErrorMessage } from "../api/client";
import { X, Calendar, Clock, ArrowRight, Info } from "lucide-react";

interface AffectedTaskResult {
  id: string;
  title: string;
  oldStartDate: string;
  newStartDate: string;
}

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  allTasks?: Task[];
  onReschedule: (
    taskId: string,
    payload: ReschedulePayload,
  ) => Promise<{
    changedTask: { id: string; startDate: string; durationDays: number };
    affectedTasks: AffectedTaskResult[];
  }>;
}

export function RescheduleModal({
  isOpen,
  onClose,
  task,
  onReschedule,
}: RescheduleModalProps) {
  const [startDate, setStartDate] = useState(() =>
    task ? new Date(task.startDate).toISOString().split("T")[0] : "",
  );
  const [durationDays, setDurationDays] = useState(task?.durationDays ?? 1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [affectedResults, setAffectedResults] = useState<
    AffectedTaskResult[] | null
  >(null);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || durationDays < 1) return;

    setSubmitError(null);
    try {
      setLoading(true);
      const res = await onReschedule(task.id, {
        startDate: new Date(startDate).toISOString(),
        durationDays,
      });

      if (res && res.affectedTasks) {
        setAffectedResults(res.affectedTasks);
      } else {
        onClose();
      }
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f0f13] border border-white/15 w-full max-w-lg p-6 text-neutral-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="pk-square bg-white" />
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-white">
                SCHEDULE RECALIBRATION // CPM PROPAGATION
              </h2>
              <p className="text-[11px] font-mono text-neutral-500">
                TARGET:{" "}
                <span className="text-white font-semibold">{task.title}</span>
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

        {/* Form or Affected Cascades Preview */}
        {!affectedResults ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="p-3 bg-neutral-950 border border-white/10 font-mono text-xs text-neutral-400 flex items-start gap-2">
              <Info size={14} className="text-white shrink-0 mt-0.5" />
              <span className="text-[11px] leading-relaxed">
                CPM Non-Compounding Invariant: Downstream tasks shift by
                max(prerequisite finish) to prevent artificial cumulative delay.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
                  <Calendar size={11} className="text-neutral-500" /> NEW START
                  DATE
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-white/15 focus:border-white text-xs font-mono text-white outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
                  <Clock size={11} className="text-neutral-500" /> DURATION
                  (DAYS)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={durationDays}
                  onChange={(e) =>
                    setDurationDays(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full px-3 py-2 bg-neutral-950 border border-white/15 focus:border-white text-xs font-mono text-white outline-none"
                />
              </div>
            </div>

            {submitError && (
              <p
                role="alert"
                className="border border-rose-800/60 bg-rose-950/40 p-2 text-[11px] font-mono text-rose-200"
              >
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="pk-button-ghost px-4 py-2 text-xs"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={loading}
                className="pk-button px-5 py-2 text-xs disabled:opacity-50"
              >
                {loading ? "PROPAGATING..." : "RUN CPM FORWARD PASS"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="p-3 bg-neutral-950 border border-white/15 font-mono text-xs">
              <span className="font-bold text-white block uppercase">
                SCHEDULE PROPAGATION EXECUTED
              </span>
              <p className="mt-0.5 text-neutral-400 text-[11px]">
                {affectedResults.length === 0
                  ? "Zero downstream shift required. Graph constraints satisfied."
                  : `${affectedResults.length} downstream node(s) recalibrated.`}
              </p>
            </div>

            {affectedResults.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-mono text-xs">
                {affectedResults.map((aff) => (
                  <div
                    key={aff.id}
                    className="p-2.5 bg-neutral-950 border border-white/10 flex items-center justify-between"
                  >
                    <span className="text-neutral-200">
                      {aff.title || aff.id.slice(-6)}
                    </span>
                    <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                      <span>
                        {new Date(aff.oldStartDate).toLocaleDateString()}
                      </span>
                      <ArrowRight size={10} className="text-white" />
                      <span className="text-white font-bold">
                        {new Date(aff.newStartDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-white/10">
              <button onClick={onClose} className="pk-button px-5 py-2 text-xs">
                DONE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
