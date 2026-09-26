import { useState } from "react";
import type {
  Task,
  CreateTaskPayload,
  AISuggestion,
  UpdateTaskPayload,
} from "../types/task";
import { apiClient, getErrorMessage } from "../api/client";
import {
  X,
  Sparkles,
  Check,
  Calendar,
  Clock,
  Loader2,
  Info,
} from "lucide-react";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTaskPayload) => Promise<boolean>;
  onUpdate?: (id: string, payload: UpdateTaskPayload) => Promise<boolean>;
  onAddDependency: (
    from: string,
    to: string,
  ) => Promise<{ success: boolean; error?: string; cyclicPath?: string[] }>;
  editingTask?: Task | null;
  existingTasks: Task[];
  initialStatus?: "Backlog" | "In Progress" | "Review" | "Done";
}

export function TaskModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  onAddDependency,
  editingTask,
  existingTasks,
  initialStatus = "Backlog",
}: TaskModalProps) {
  const defaultDate = new Date().toISOString().split("T")[0];
  const getInitialFormState = () => {
    if (!editingTask) {
      return {
        title: "",
        description: "",
        startDate: defaultDate,
        durationDays: 1,
        selectedPrereqIds: [] as string[],
      };
    }

    return {
      title: editingTask.title,
      description: editingTask.description || "",
      startDate: new Date(editingTask.startDate).toISOString().split("T")[0],
      durationDays: editingTask.durationDays,
      selectedPrereqIds: editingTask.dependsOn || [],
    };
  };

  const [title, setTitle] = useState(getInitialFormState().title);
  const [description, setDescription] = useState(
    getInitialFormState().description,
  );
  const [startDate, setStartDate] = useState(getInitialFormState().startDate);
  const [durationDays, setDurationDays] = useState(
    getInitialFormState().durationDays,
  );
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>(
    getInitialFormState().selectedPrereqIds,
  );

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiDecisionPending, setIsAiDecisionPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const eligiblePrereqs = existingTasks.filter(
    (t) => !editingTask || t.id !== editingTask.id,
  );

  const fetchAiSuggestions = async () => {
    if (!title.trim()) {
      setAiError("Provide a title before querying the AI advisor.");
      return;
    }

    try {
      setIsAiLoading(true);
      setAiError(null);
      const res = await apiClient.getAISuggestions({
        title,
        description,
        taskId: editingTask?.id,
      });

      const unselectedSuggestions = res.suggestions.filter(
        (s) => !selectedPrereqIds.includes(s.taskId),
      );
      setAiSuggestions(unselectedSuggestions);
      if (unselectedSuggestions.length === 0) {
        setAiError("No plausible prerequisites detected.");
      }
    } catch (error: unknown) {
      setAiError(getErrorMessage(error) || "AI Advisor connection failure");
    } finally {
      setIsAiLoading(false);
    }
  };

  const logAiDecision = async (
    suggestion: AISuggestion,
    decision: "accepted" | "rejected",
  ) => {
    await apiClient.logAISuggestionFeedback({
      targetTaskId: editingTask?.id,
      targetTaskTitle: title.trim(),
      suggestionTaskId: suggestion.taskId,
      suggestionTitle: suggestion.title,
      rationale: suggestion.rationale,
      decision,
    });
  };

  const acceptAiSuggestion = async (suggestion: AISuggestion) => {
    setAiError(null);
    setIsAiDecisionPending(true);
    try {
      await logAiDecision(suggestion, "accepted");

      if (editingTask) {
        const result = await onAddDependency(suggestion.taskId, editingTask.id);
        if (!result.success) {
          setAiError(result.error || "Could not attach this prerequisite.");
          return;
        }
      }

      setSelectedPrereqIds((prev) =>
        prev.includes(suggestion.taskId) ? prev : [...prev, suggestion.taskId],
      );
      setAiSuggestions((prev) =>
        prev.filter((item) => item.taskId !== suggestion.taskId),
      );
    } catch (error: unknown) {
      setAiError(getErrorMessage(error));
    } finally {
      setIsAiDecisionPending(false);
    }
  };

  const dismissAiSuggestion = async (suggestion: AISuggestion) => {
    setAiError(null);
    setIsAiDecisionPending(true);
    try {
      await logAiDecision(suggestion, "rejected");
      setAiSuggestions((prev) =>
        prev.filter((item) => item.taskId !== suggestion.taskId),
      );
    } catch (error: unknown) {
      setAiError(getErrorMessage(error));
    } finally {
      setIsAiDecisionPending(false);
    }
  };

  const togglePrereq = (taskId: string) => {
    setSelectedPrereqIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || durationDays < 1) return;

    setSubmitError(null);
    try {
      setIsSubmitting(true);
      if (editingTask) {
        if (!onUpdate) {
          setSubmitError("Task editing is unavailable.");
          return;
        }

        const updated = await onUpdate(editingTask.id, {
          title,
          description,
          startDate: new Date(startDate).toISOString(),
          durationDays,
        });
        if (!updated) {
          setSubmitError("The task changes could not be saved.");
          return;
        }
      } else {
        const created = await onSubmit({
          title,
          description,
          startDate: new Date(startDate).toISOString(),
          durationDays,
          dependsOn: selectedPrereqIds,
          boardStatus: initialStatus,
        });

        if (!created) {
          setSubmitError("The task could not be created. Please try again.");
          return;
        }
      }
      onClose();
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f0f13] border border-white/15 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 text-neutral-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="pk-square bg-white" />
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-white">
                {editingTask ? "EDIT WORK ENTRY" : "NEW WORK ENTRY"}
              </h2>
              <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                STATUS: {initialStatus.toUpperCase()} // DAG COMPLIANT
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              TITLE <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Audio Schema Pipeline"
              className="w-full px-3 py-2 bg-neutral-950 border border-white/15 focus:border-white text-xs font-mono text-white placeholder-neutral-600 outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              DETAILS & SPECIFICATION
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Technical specs, deliverables, or criteria..."
              className="w-full px-3 py-2 bg-neutral-950 border border-white/15 focus:border-white text-xs font-mono text-white placeholder-neutral-600 outline-none transition-colors resize-none"
            />
          </div>

          {/* Date & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
                <Calendar size={11} className="text-neutral-500" /> START DATE
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
                <Clock size={11} className="text-neutral-500" /> DURATION (DAYS)
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

          {/* AI Dependency Suggestions Section */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-300">
                  AI ADVISOR // PREREQUISITES
                </span>
              </div>
              <button
                type="button"
                onClick={fetchAiSuggestions}
                disabled={isAiLoading || !title.trim()}
                className="pk-button-ghost px-2.5 py-1 text-[10px] font-mono flex items-center gap-1 disabled:opacity-40"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> ANALYZING...
                  </>
                ) : (
                  <>
                    <Sparkles size={11} /> SCAN PREREQUISITES
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <p className="text-[11px] font-mono text-amber-300/90 flex items-center gap-1 mt-1 bg-amber-950/40 p-2 border border-amber-800/40">
                <Info size={12} /> {aiError}
              </p>
            )}

            {/* AI Suggestion Chips */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2 mt-2 p-3 bg-neutral-950 border border-white/15">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                  GROUNDED RECOMMENDATIONS:
                </span>
                <div className="space-y-1.5">
                  {aiSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.taskId}
                      className="flex items-center justify-between p-2 bg-[#121216] border border-white/10 text-xs font-mono"
                    >
                      <div className="pr-2">
                        <span className="font-bold text-white">
                          {suggestion.title}
                        </span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {suggestion.rationale}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => acceptAiSuggestion(suggestion)}
                          disabled={isAiDecisionPending}
                          className="px-2 py-1 text-[10px] font-mono uppercase bg-white text-black font-bold hover:bg-neutral-200 transition-colors flex items-center gap-1"
                        >
                          <Check size={10} /> ACCEPT
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissAiSuggestion(suggestion)}
                          disabled={isAiDecisionPending}
                          className="p-1 text-neutral-500 hover:text-white disabled:opacity-40"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual Prerequisites Selector */}
          {!editingTask && eligiblePrereqs.length > 0 && (
            <div className="pt-2">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
                MANUAL ATTACHMENTS ({selectedPrereqIds.length} SELECTED)
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 bg-neutral-950 p-2 border border-white/10 font-mono text-xs">
                {eligiblePrereqs.map((prereq) => {
                  const isChecked = selectedPrereqIds.includes(prereq.id);
                  return (
                    <label
                      key={prereq.id}
                      className={`flex items-center justify-between p-1.5 cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-white/10 text-white font-semibold"
                          : "hover:bg-white/5 text-neutral-400"
                      }`}
                    >
                      <span className="truncate pr-2">{prereq.title}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePrereq(prereq.id)}
                        className="accent-white"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Actions */}
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
              DISCARD
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="pk-button px-5 py-2 text-xs disabled:opacity-50"
            >
              {isSubmitting
                ? "RECORDING..."
                : editingTask
                  ? "UPDATE ENTRY"
                  : "COMMIT WORK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
