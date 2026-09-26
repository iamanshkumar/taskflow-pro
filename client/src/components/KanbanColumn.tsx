import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Task, BoardStatus } from "../types/task";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  id: BoardStatus;
  title: string;
  tasks: Task[];
  allTasks: Task[];
  onArchive: (id: string) => Promise<{ success: boolean; error?: string }>;
  onEdit: (task: Task) => void;
  onReschedule: (task: Task) => void;
  onManageDeps: (task: Task) => void;
  onMove: (taskId: string, targetCol: BoardStatus) => void;
  onNewTask: (status?: BoardStatus) => void;
  index: number;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  allTasks,
  onArchive,
  onEdit,
  onReschedule,
  onManageDeps,
  onMove,
  onNewTask,
  index,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { columnId: id },
  });

  const columnNumber = String(index + 1).padStart(2, "0");

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col p-4 min-h-155 transition-all duration-200 border rounded-none ${
        isOver
          ? "border-white bg-[#181820] ring-1 ring-white/20"
          : "border-white/10 bg-[#0d0d10]"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="pk-square bg-white" />
          <span className="font-mono text-xs text-neutral-400">
            {columnNumber}
          </span>
          <h3 className="font-mono font-bold text-xs uppercase tracking-widest text-neutral-200">
            {title}
          </h3>
        </div>
        <span className="font-mono text-xs px-2 py-0.5 border border-white/10 bg-neutral-900 text-neutral-300">
          {tasks.length}
        </span>
      </div>

      {/* Droppable Sortable Task List */}
      <div className="flex-1 overflow-y-auto pr-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              onArchive={onArchive}
              onEdit={onEdit}
              onReschedule={onReschedule}
              onManageDeps={onManageDeps}
              onMove={onMove}
            />
          ))}
        </SortableContext>

        {/* Empty Column Drop Target */}
        {tasks.length === 0 && (
          <div className="h-44 border border-dashed border-white/10 flex flex-col items-center justify-center text-neutral-500 font-mono text-xs p-4 text-center">
            <span>NO ACTIVE ENTRIES</span>
            <button
              onClick={() => onNewTask(id)}
              className="mt-3 text-white hover:underline text-[11px] uppercase tracking-wider"
            >
              + ADD ITEM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
