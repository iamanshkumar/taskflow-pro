import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTasks } from "./hooks/useTasks";
import type {
  Task,
  BoardStatus,
  CreateTaskPayload,
  ArchivedTask,
} from "./types/task";
import { KanbanColumn } from "./components/KanbanColumn";
import { TaskCard } from "./components/TaskCard";
import { TaskModal } from "./components/TaskModal";
import { DependencyModal } from "./components/DependencyModal";
import { RescheduleModal } from "./components/RescheduleModal";
import { DAGView } from "./components/DAGView";
import { ArchiveModal } from "./components/ArchiveModal";
import { ToastContainer, type ToastMessage } from "./components/Toast";
import { AuthScreen } from "./components/AuthScreen";
import {
  Plus,
  RefreshCw,
  Flame,
  Layers,
  UserPlus,
  LogOut,
  Archive as ArchiveIcon,
  Download,
} from "lucide-react";
import {
  apiClient,
  ApiError,
  getErrorMessage,
  type AuthSession,
} from "./api/client";

const COLUMNS: BoardStatus[] = ["Backlog", "In Progress", "Review", "Done"];

export function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const session = await apiClient.getAuthSession();
        if (isMounted) setAuthSession(session);
      } catch (error: unknown) {
        if (
          isMounted &&
          (!(error instanceof ApiError) || error.code !== "UNAUTHENTICATED")
        ) {
          setAuthError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    tasks,
    criticalPath,
    totalDuration,
    loading,
    refresh,
    createTask,
    updateTask,
    moveTask,
    rescheduleTask,
    archiveTask,
    addDependency,
    removeDependency,
  } = useTasks(authSession?.activeWorkspaceId ?? null);

  // Active Drag state for DnD Overlay
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialColumn, setInitialColumn] = useState<BoardStatus>("Backlog");

  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [targetDepTask, setTargetDepTask] = useState<Task | null>(null);

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [targetRescheduleTask, setTargetRescheduleTask] = useState<Task | null>(
    null,
  );

  const [isDAGOpen, setIsDAGOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<ArchivedTask[]>([]);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // DnD Sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    const activeTaskObj = tasks.find((t) => t.id === activeTaskId);
    if (!activeTaskObj) return;

    let targetColumn: BoardStatus | null = null;

    if (COLUMNS.includes(overId as BoardStatus)) {
      targetColumn = overId as BoardStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetColumn = overTask.boardStatus;
      }
    }

    if (targetColumn && targetColumn !== activeTaskObj.boardStatus) {
      try {
        await moveTask(activeTaskId, targetColumn);
        addToast({
          type: "success",
          title: "STATUS SHIFT PERSISTED",
          description: `Moved "${activeTaskObj.title}" → ${targetColumn}.`,
        });
      } catch (error: unknown) {
        addToast({
          type: "error",
          title: "CYCLE OR VALIDATION REJECTED",
          description: getErrorMessage(error),
        });
      }
    }
  };

  const handleCreateTask = async (payload: CreateTaskPayload) => {
    try {
      const created = await createTask(payload);
      if (!created) {
        addToast({
          type: "error",
          title: "TASK CREATION FAILED",
          description:
            "Your task could not be saved. Please review the form and try again.",
        });
        return false;
      }

      addToast({
        type: "success",
        title: "TASK CREATED",
        description: `"${payload.title}" was added to ${payload.boardStatus ?? "Backlog"}.`,
      });
      return true;
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "TASK CREATION FAILED",
        description:
          getErrorMessage(error) ||
          "Something went wrong while saving the task.",
      });
      return false;
    }
  };

  const openNewTaskModal = (col: BoardStatus = "Backlog") => {
    setEditingTask(null);
    setInitialColumn(col);
    setIsTaskModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const openDependencyModal = (task: Task) => {
    setTargetDepTask(task);
    setIsDepModalOpen(true);
  };

  const openRescheduleModal = (task: Task) => {
    setTargetRescheduleTask(task);
    setIsRescheduleOpen(true);
  };

  const handleArchiveTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (
      !confirm(
        `Archive task: "${task?.title || "Item"}"? You can restore it later.`,
      )
    ) {
      return { success: false, error: "Archiving cancelled." };
    }

    const res = await archiveTask(taskId);
    if (res.success) {
      addToast({
        type: "success",
        title: "TASK ARCHIVED",
        description: "The task is recoverable from the workspace archive.",
      });
    } else {
      addToast({
        type: "error",
        title: "TASK COULD NOT BE ARCHIVED",
        description: res.error,
      });
    }

    return res;
  };

  const openArchive = async () => {
    setIsArchiveOpen(true);
    setIsArchiveLoading(true);
    try {
      const response = await apiClient.getArchivedTasks();
      setArchivedTasks(response.tasks);
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "ARCHIVE COULD NOT BE LOADED",
        description: getErrorMessage(error),
      });
    } finally {
      setIsArchiveLoading(false);
    }
  };

  const handleRestoreTask = async (taskId: string): Promise<boolean> => {
    try {
      await apiClient.restoreTask(taskId);
      setArchivedTasks((current) =>
        current.filter((task) => task.id !== taskId),
      );
      await refresh();
      addToast({
        type: "success",
        title: "TASK RESTORED",
        description: "The task is back on the active board.",
      });
      return true;
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "TASK COULD NOT BE RESTORED",
        description: getErrorMessage(error),
      });
      return false;
    }
  };

  const handleExportWorkspace = async () => {
    try {
      const backup = await apiClient.exportWorkspace();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `taskflow-workspace-${authSession?.activeWorkspaceId}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      addToast({
        type: "success",
        title: "WORKSPACE EXPORTED",
        description: `${backup.tasks.length} tasks included in the backup.`,
      });
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "WORKSPACE EXPORT FAILED",
        description: getErrorMessage(error),
      });
    }
  };

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    try {
      setAuthSession(await apiClient.activateWorkspace(workspaceId));
      setIsTaskModalOpen(false);
      setIsDepModalOpen(false);
      setIsRescheduleOpen(false);
      setIsDAGOpen(false);
      setIsArchiveOpen(false);
      setArchivedTasks([]);
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "WORKSPACE SWITCH FAILED",
        description: getErrorMessage(error),
      });
    }
  };

  const handleCreateWorkspace = async () => {
    const name = window.prompt("Workspace name");
    if (!name?.trim()) return;

    try {
      setAuthSession(await apiClient.createWorkspace(name.trim()));
      addToast({
        type: "success",
        title: "WORKSPACE CREATED",
        description: `${name.trim()} is ready.`,
      });
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "WORKSPACE CREATION FAILED",
        description: getErrorMessage(error),
      });
    }
  };

  const handleAddWorkspaceMember = async () => {
    if (!authSession) return;
    const email = window.prompt("Add an existing TaskFlow account by email");
    if (!email?.trim()) return;

    try {
      await apiClient.addWorkspaceMember(
        authSession.activeWorkspaceId,
        email.trim(),
      );
      addToast({
        type: "success",
        title: "MEMBER ADDED",
        description: `${email.trim()} can now access this workspace.`,
      });
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "MEMBER COULD NOT BE ADDED",
        description: getErrorMessage(error),
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await apiClient.logout();
      setAuthSession(null);
      setEditingTask(null);
      setTargetDepTask(null);
      setTargetRescheduleTask(null);
      setIsArchiveOpen(false);
      setArchivedTasks([]);
      setToasts([]);
    } catch (error: unknown) {
      addToast({
        type: "error",
        title: "SIGN OUT FAILED",
        description: getErrorMessage(error),
      });
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#0a0a0c] text-neutral-400 flex items-center justify-center font-mono text-xs">
        RESTORING WORKSPACE SESSION...
      </main>
    );
  }

  if (!authSession) {
    return (
      <AuthScreen
        initialError={authError}
        onAuthenticated={(session) => {
          setAuthError(null);
          setAuthSession(session);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6] flex flex-col selection:bg-white selection:text-black">
      {/* Editorial Top Navigation */}
      <nav className="border-b border-white/10 bg-[#0a0a0c]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Logo / Monogram */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 25 25"
                fill="none"
                className="text-white"
              >
                <path
                  d="M8.32695 20.4662C8.14991 20.5369 7.97443 20.6117 7.80061 20.6903C7.64148 20.764 6.92686 21.1422 6.78165 21.1204C6.70882 21.0066 6.57779 20.6753 6.51236 20.5359L5.73948 18.857L4.51766 16.2276C4.28607 15.7486 4.06234 15.2659 3.84659 14.7795C3.60945 14.2492 3.43242 13.9402 3.31741 13.3412C3.13651 12.3738 3.3397 11.3738 3.88359 10.5547C4.44004 9.70984 5.31653 9.13001 6.3096 8.94981C7.33868 8.75508 8.65909 8.98033 9.57744 9.49041C10.8526 10.1987 11.7806 11.3839 11.8373 12.8808C11.894 14.16 11.3002 15.3808 10.2603 16.1228C9.95102 16.3411 9.6576 16.4729 9.32527 16.6439C8.71862 16.9559 8.09336 17.2401 7.47038 17.5176C7.35845 17.5675 7.15706 17.6165 7.23471 17.7828C7.37931 18.0925 7.52242 18.3958 7.66147 18.708C7.70323 18.8024 7.82869 19.0119 7.84376 19.0964C7.839 19.5455 8.2517 19.9154 8.28514 20.3617C8.28855 20.4074 8.3126 20.4268 8.32695 20.4662ZM7.54722 15.467C7.75464 15.3765 7.96211 15.2865 8.16726 15.1907C8.29934 15.1291 8.4417 15.0359 8.57205 14.9803C11.4466 13.7546 9.65282 10.4451 7.00051 10.6851C6.43194 10.7382 5.90371 10.9081 5.53126 11.3698C5.14158 11.8528 4.88307 12.6093 5.1391 13.2101C5.36255 13.7344 5.6011 14.2569 5.84064 14.7751L6.17951 15.5118C6.22505 15.6106 6.34582 15.9361 6.43626 15.9804C6.57965 15.9322 6.70019 15.8569 6.83511 15.8007C7.08439 15.6967 7.30761 15.5919 7.54722 15.467Z"
                  fill="currentColor"
                ></path>
                <path
                  d="M10.2878 0.0942912C10.326 0.0996538 10.67 0.0978878 10.7214 0.0966356C10.6845 0.0936711 10.6781 0.0947861 10.6424 0.082389C10.7631 0.0833157 10.7449 0.0549289 10.8317 0.0471009C10.8753 0.0431707 10.9997 0.0713046 11.0609 0.0673893C11.2141 0.0584529 11.3762 0.0242569 11.5288 0.0198385C12.3184 -0.00302164 13.1125 -0.0222051 13.8996 0.0587394C13.9893 0.0679663 14.0995 0.0475071 14.1889 0.0544044C14.3171 0.0643105 14.4115 0.0779693 14.5416 0.0670423C14.8097 0.0798765 15.3831 0.233305 15.6517 0.301627C17.9752 0.902231 20.0762 2.16316 21.703 3.93298C23.9617 6.40783 25.1435 9.68472 24.9861 13.0371C24.8512 16.3898 23.376 19.5466 20.8935 21.7944C19.3295 23.2297 17.4253 24.2391 15.3624 24.7264C15.1024 24.7869 14.3746 24.9377 14.128 24.9237C13.9776 24.9042 13.5179 24.9451 13.4178 24.8714C13.3961 24.7964 13.4334 24.6999 13.4216 24.6611C13.3523 24.4329 13.3591 24.3793 13.5882 24.2633C13.5547 24.2536 13.5321 24.2461 13.5 24.2341C13.5647 24.2001 13.5371 24.2425 13.6207 24.1807C16.3906 23.9232 18.9764 22.6767 20.9081 20.6678C23.1133 18.3765 24.291 15.2811 24.1689 12.0978C24.0842 9.32393 23.0234 6.66976 21.1747 4.60602C20.5311 3.89498 19.77 3.21292 18.9723 2.67933C17.2343 1.52321 15.2168 0.860734 13.134 0.762157C12.4481 0.731571 11.708 0.743366 11.0269 0.834626C8.31517 1.18481 5.81015 2.47342 3.9436 4.47835C2.3439 6.22424 1.30349 8.41202 0.957202 10.7582C0.8466 11.5822 0.813626 12.4149 0.858719 13.245C0.893232 14.0234 1.07075 14.9494 1.28286 15.6929C1.82258 17.6085 2.83854 19.3551 4.23537 20.7685C4.38166 20.917 4.59406 21.1014 4.75136 21.2456C6.42109 22.7518 8.49249 23.7362 10.7115 24.078C11.0768 24.1341 11.6718 24.2068 12.0351 24.1902C12.0313 24.4628 12.0397 24.721 12.0328 25C11.5928 24.9836 11.0232 24.9543 10.5871 24.892C8.38214 24.5569 6.30981 23.6254 4.59265 22.1974C1.9899 20.0648 0.353043 16.9698 0.0517329 13.6112C-0.247147 10.318 0.757393 7.03905 2.84819 4.48318C4.43527 2.53609 6.57014 1.11413 8.9744 0.40273C9.2712 0.316214 10.0033 0.121546 10.2878 0.0942912Z"
                  fill="currentColor"
                ></path>
              </svg>
              <a
                href="/"
                className="font-mono font-bold tracking-widest text-sm uppercase text-white no-underline"
              >
                TASKFLOW // PRO
              </a>
            </div>
            <span className="hidden sm:inline-block font-mono text-[10px] text-neutral-500 uppercase tracking-wider px-2 py-0.5 border border-white/10">
              DAG-ENGINE 2026
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="active-workspace" className="sr-only">
              Active workspace
            </label>
            <select
              id="active-workspace"
              value={authSession.activeWorkspaceId}
              onChange={(event) =>
                void handleWorkspaceSwitch(event.target.value)
              }
              className="max-w-48 bg-neutral-950 border border-white/15 px-2.5 py-2 text-xs font-mono text-neutral-200 outline-none"
            >
              {authSession.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleCreateWorkspace()}
              title="Create workspace"
              aria-label="Create workspace"
              className="pk-button-ghost p-2 text-neutral-300 hover:text-white"
            >
              <Plus size={14} />
            </button>
            {authSession.workspaces.find(
              (workspace) => workspace.id === authSession.activeWorkspaceId,
            )?.role === "owner" && (
              <button
                type="button"
                onClick={() => void handleAddWorkspaceMember()}
                title="Add existing account"
                aria-label="Add existing account to workspace"
                className="pk-button-ghost p-2 text-neutral-300 hover:text-white"
              >
                <UserPlus size={14} />
              </button>
            )}
            <span className="hidden lg:inline text-xs font-mono text-neutral-400">
              {authSession.user.displayName}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title="Sign out"
              aria-label="Sign out"
              className="pk-button-ghost p-2 text-neutral-300 hover:text-white"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Editorial Hero Header (Paul Kalkbrenner Style) */}
      <section className="border-b border-white/10 px-6 py-8 md:py-12 relative overflow-hidden bg-noise">
        <div className="max-w-7xl mx-auto">
          {/* Top Sub-header row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="pk-square bg-white" />
                <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
                  WORKSPACE MATRIX // RELEASE 2026
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight text-white leading-none">
                DETERMINISTIC
                <br />
                WORKFLOWS
              </h1>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 font-mono border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
              <div>
                <span className="text-[10px] text-neutral-500 block uppercase">
                  01 / TOTAL DURATION
                </span>
                <span className="text-2xl font-bold text-white tracking-tight">
                  {totalDuration} DAYS
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 block uppercase">
                  02 / CRITICAL PATH
                </span>
                <span className="text-2xl font-bold text-amber-400 tracking-tight flex items-center gap-1">
                  <Flame size={18} /> {criticalPath.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 block uppercase">
                  03 / ACTIVE NODES
                </span>
                <span className="text-2xl font-bold text-white tracking-tight">
                  {tasks.length}
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-white/10 pt-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => openNewTaskModal("Backlog")}
                className="pk-button px-5 py-2.5 flex items-center gap-2 text-xs"
              >
                <Plus size={15} />
                <span>NEW WORK ENTRY</span>
              </button>

              <button
                onClick={() => setIsDAGOpen(true)}
                className="pk-button-ghost px-4 py-2.5 flex items-center gap-2 text-xs"
              >
                <Layers size={15} />
                <span>INSPECT DAG</span>
              </button>
              <button
                onClick={() => void openArchive()}
                className="pk-button-ghost px-4 py-2.5 flex items-center gap-2 text-xs"
              >
                <ArchiveIcon size={14} />
                <span>ARCHIVE</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleExportWorkspace()}
                className="pk-button-ghost p-2.5 text-neutral-400 hover:text-white"
                title="Export workspace backup"
                aria-label="Export workspace backup"
              >
                <Download size={14} />
              </button>
              <button
                onClick={refresh}
                className="pk-button-ghost p-2.5 text-neutral-400 hover:text-white"
                title="Refresh State"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Kanban Board with DnD Context */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="mb-4 flex items-center justify-between font-mono text-xs text-neutral-500">
          <span>BOARD PIPELINE [01 - 04]</span>
          <span>DRAG & DROP TO PROPAGATE</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col, index) => {
              const colTasks = tasks.filter((t) => t.boardStatus === col);

              return (
                <KanbanColumn
                  key={col}
                  id={col}
                  index={index}
                  title={col}
                  tasks={colTasks}
                  allTasks={tasks}
                  onArchive={handleArchiveTask}
                  onEdit={openEditModal}
                  onReschedule={openRescheduleModal}
                  onManageDeps={openDependencyModal}
                  onMove={moveTask}
                  onNewTask={openNewTaskModal}
                />
              );
            })}
          </div>

          {/* Active Drag Overlay */}
          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                allTasks={tasks}
                onArchive={handleArchiveTask}
                onEdit={openEditModal}
                onReschedule={openRescheduleModal}
                onManageDeps={openDependencyModal}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 font-mono text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="pk-square bg-neutral-600" />
            <span>TASKFLOW PRO // CONTATA HACKATHON 2026</span>
          </div>
          <div>
            <span>PURE DAG ENGINE · DETERMINISTIC CPM · ZERO STATE DRIFT</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <TaskModal
        key={`${isTaskModalOpen}-${editingTask?.id ?? initialColumn}`}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        onUpdate={updateTask}
        onAddDependency={addDependency}
        editingTask={editingTask}
        existingTasks={tasks}
        initialStatus={initialColumn}
      />

      <DependencyModal
        isOpen={isDepModalOpen}
        onClose={() => setIsDepModalOpen(false)}
        targetTask={targetDepTask}
        allTasks={tasks}
        onAddDependency={addDependency}
        onRemoveDependency={removeDependency}
      />

      <RescheduleModal
        key={`${isRescheduleOpen}-${targetRescheduleTask?.id ?? "none"}`}
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        task={targetRescheduleTask}
        allTasks={tasks}
        onReschedule={rescheduleTask}
      />

      <DAGView
        isOpen={isDAGOpen}
        onClose={() => setIsDAGOpen(false)}
        tasks={tasks}
        criticalPath={criticalPath}
        totalDurationDays={totalDuration}
      />

      <ArchiveModal
        isOpen={isArchiveOpen}
        isLoading={isArchiveLoading}
        tasks={archivedTasks}
        onClose={() => setIsArchiveOpen(false)}
        onRestore={handleRestoreTask}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
