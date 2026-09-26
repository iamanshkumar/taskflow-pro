import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, BoardStatus } from "../types/task";
import {
  Calendar,
  Clock,
  Link2,
  Archive,
  Edit2,
  RotateCw,
  Flame,
  Lock,
  CheckCircle2,
  GripVertical,
} from "lucide-react";

interface TaskCardProps {
  task: Task;
  allTasks: Task[];
  onArchive: (id: string) => Promise<{ success: boolean; error?: string }>;
  onEdit: (task: Task) => void;
  onReschedule: (task: Task) => void;
  onManageDeps: (task: Task) => void;
  onMove?: (taskId: string, targetCol: BoardStatus) => void;
  isOverlay?: boolean;
}

const COLUMNS: BoardStatus[] = ["Backlog", "In Progress", "Review", "Done"];

export function TaskCard({
  task,
  allTasks,
  onArchive,
  onEdit,
  onReschedule,
  onManageDeps,
  onMove,
  isOverlay = false,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };

  const isBlocked = task.dependencyStatus === "Blocked";
  const prereqNames = (task.dependsOn || [])
    .map((pId) => allTasks.find((t) => t.id === pId)?.title)
    .filter(Boolean);

  const formattedDate = new Date(task.startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-none p-4 mb-3 border transition-all duration-200 select-none ${
        task.isCritical
          ? "border-amber-500/60 bg-[#141419] shadow-lg shadow-amber-500/5"
          : "border-white/10 bg-[#121216] hover:border-white/25 hover:bg-[#16161b]"
      } ${isOverlay ? "rotate-1 scale-105 shadow-2xl border-white bg-[#1a1a20]" : ""}`}
    >
      {/* Top row: Status Tag & Monospace Index */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Blocked / Ready Status */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
              isBlocked
                ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
            }`}
          >
            {isBlocked ? <Lock size={10} /> : <CheckCircle2 size={10} />}
            {task.dependencyStatus}
          </span>

          {/* Critical Path Marker */}
          {task.isCritical && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-600/50"
              title="This task is on the Critical Path determining project delivery"
            >
              <Flame size={10} className="text-amber-400 fill-amber-400" />
              CRITICAL
            </span>
          )}
        </div>

        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-300 p-1 transition-colors"
          title="Drag card"
        >
          <GripVertical size={14} />
        </div>
      </div>

      {/* Task Title */}
      <h4 className="font-semibold text-neutral-100 text-sm tracking-tight mb-1.5 leading-snug">
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-neutral-400 line-clamp-2 mb-3 font-light leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Prerequisites Chips */}
      {prereqNames.length > 0 && (
        <div className="mb-3 pt-2.5 border-t border-white/5 flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-neutral-500 font-mono">
            REQUIRES:
          </span>
          {prereqNames.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="text-[10px] font-mono bg-neutral-900 text-neutral-300 px-1.5 py-0.5 border border-white/10 max-w-37.5 truncate"
              title={name}
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Metadata & Actions Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-neutral-400 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1 text-[11px]"
            title="Start Date"
          >
            <Calendar size={11} className="text-neutral-500" />
            {formattedDate}
          </span>
          <span
            className="flex items-center gap-1 text-[11px]"
            title="Duration"
          >
            <Clock size={11} className="text-neutral-500" />
            {task.durationDays}D
          </span>
        </div>

        {/* Card Actions */}
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onReschedule(task)}
            className="p-1 hover:text-white hover:bg-white/10 transition-colors"
            title="Reschedule / Shift Date"
          >
            <RotateCw size={12} />
          </button>
          <button
            onClick={() => onManageDeps(task)}
            className="p-1 hover:text-white hover:bg-white/10 transition-colors"
            title="Manage Dependencies"
          >
            <Link2 size={12} />
          </button>
          <button
            onClick={() => onEdit(task)}
            className="p-1 hover:text-white hover:bg-white/10 transition-colors"
            title="Edit Task"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => void onArchive(task.id)}
            className="p-1 hover:text-white hover:bg-white/10 transition-colors"
            title="Archive Task"
          >
            <Archive size={12} />
          </button>
        </div>
      </div>

      {/* Quick Move Status Pills */}
      {onMove && (
        <div className="mt-2.5 pt-2 border-t border-white/5 flex justify-end gap-1">
          {COLUMNS.filter((c) => c !== task.boardStatus).map((targetCol) => (
            <button
              key={targetCol}
              onClick={() => onMove(task.id, targetCol)}
              className="text-[9px] font-mono uppercase bg-neutral-900 hover:bg-white hover:text-black text-neutral-400 px-1.5 py-0.5 border border-white/10 transition-all"
            >
              → {targetCol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
