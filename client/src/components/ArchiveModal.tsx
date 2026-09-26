import { useState } from "react";
import type { ArchivedTask } from "../types/task";
import { Archive, RotateCcw, X } from "lucide-react";

interface ArchiveModalProps {
  isOpen: boolean;
  isLoading: boolean;
  tasks: ArchivedTask[];
  onClose: () => void;
  onRestore: (taskId: string) => Promise<boolean>;
}

export function ArchiveModal({
  isOpen,
  isLoading,
  tasks,
  onClose,
  onRestore,
}: ArchiveModalProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (!isOpen) return null;

  const restore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      await onRestore(taskId);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        className="bg-[#0f0f13] border border-white/15 w-full max-w-2xl max-h-[85vh] flex flex-col p-6 text-neutral-100 shadow-2xl"
      >
        <header className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Archive size={17} className="text-neutral-300" />
            <div>
              <h2
                id="archive-title"
                className="font-mono text-xs font-bold uppercase tracking-widest"
              >
                ARCHIVED TASKS
              </h2>
              <p className="mt-1 text-[11px] font-mono text-neutral-500">
                Restore tasks to return them to the active board.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close archived tasks"
            className="p-1 text-neutral-500 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="mt-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="py-10 text-center font-mono text-xs text-neutral-500">
              LOADING ARCHIVE...
            </p>
          ) : tasks.length === 0 ? (
            <p className="py-10 text-center font-mono text-xs text-neutral-500">
              NO ARCHIVED TASKS
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-neutral-100">
                      {task.title}
                    </h3>
                    <p className="mt-1 text-[11px] font-mono text-neutral-500">
                      {task.boardStatus} · archived{" "}
                      {new Date(task.archivedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restore(task.id)}
                    disabled={restoringId !== null}
                    className="pk-button-ghost shrink-0 px-3 py-2 text-[10px] font-mono flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <RotateCcw size={12} />
                    {restoringId === task.id ? "RESTORING..." : "RESTORE"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
