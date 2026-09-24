import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { useTaskStore, type Task, type TaskStatus } from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';
import { fetchBatchTaskRisks, type TaskRiskAssessment } from '../../services/riskApi';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailModal from './TaskDetailModal';

const COLUMNS: {
  status: TaskStatus;
  title: string;
  accentClassName: string;
}[] = [
  { status: 'TODO', title: 'To do', accentClassName: 'bg-slate-400' },
  { status: 'IN_PROGRESS', title: 'In progress', accentClassName: 'bg-indigo-500' },
  { status: 'IN_REVIEW', title: 'In review', accentClassName: 'bg-violet-500' },
  { status: 'BLOCKED', title: 'Blocked', accentClassName: 'bg-red-500' },
  { status: 'DONE', title: 'Done', accentClassName: 'bg-emerald-500' },
];

const STATUSES = COLUMNS.map((c) => c.status);

function isStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (STATUSES as string[]).includes(value);
}

export default function KanbanBoard() {
  const tasks = useTaskStore((state) => state.tasks);
  const isLoading = useTaskStore((state) => state.isLoading);
  const error = useTaskStore((state) => state.error);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const clearError = useTaskStore((state) => state.clearError);
  const moveTask = useTaskStore((state) => state.moveTask);
  const activeProject = useProjectStore((state) => state.activeProject);
  const fetchMembers = useProjectStore((state) => state.fetchMembers);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalStatus, setModalStatus] = useState<TaskStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [risks, setRisks] = useState<Record<string, TaskRiskAssessment>>({});

  useEffect(() => {
    void fetchTasks();
    if (activeProject?.id) {
      void fetchMembers(activeProject.id);
    }
  }, [fetchTasks, activeProject?.id, fetchMembers]);

  useEffect(() => {
    if (activeProject?.id) {
      fetchBatchTaskRisks(activeProject.id)
        .then((data) => setRisks(data))
        .catch((err) => console.error('Failed to load batch risks:', err));
    }
  }, [activeProject?.id, tasks]);

  // A small distance constraint means clicks on the card still work —
  // the drag only starts once the pointer has actually moved.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [tasks, searchQuery, priorityFilter]);

  const tasksByStatus = useMemo(() => {
    const grouped = Object.fromEntries(
      STATUSES.map((s) => [s, [] as Task[]]),
    ) as Record<TaskStatus, Task[]>;

    for (const task of filteredTasks) {
      if (grouped[task.status]) grouped[task.status].push(task);
    }
    return grouped;
  }, [filteredTasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }
    return closestCorners(args);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const dragged = tasks.find((t) => t.id === activeId);
    if (!dragged) return;

    // A task that's still being created has no server id yet, so any
    // update would 404. Leave it alone until the POST resolves.
    if (activeId.startsWith('temp_')) return;

    // Determine target status from droppable data or ID
    const overData = over.data?.current;
    let targetStatus: TaskStatus | null = null;

    if (overData?.type === 'Column' && isStatus(overData.status)) {
      targetStatus = overData.status;
    } else if (overData?.type === 'Task' && isStatus(overData.status)) {
      targetStatus = overData.status;
    } else if (isStatus(overId)) {
      targetStatus = overId;
    } else if (overId.startsWith('column-') && isStatus(overId.replace('column-', ''))) {
      targetStatus = overId.replace('column-', '') as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && isStatus(overTask.status)) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus && dragged.status !== targetStatus) {
      void moveTask(activeId, targetStatus);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board header */}
      <header className="flex items-center justify-between gap-4 pb-4">
        <div>
          <h1 className="text-xl font-bold text-nx-primary">Task Board</h1>
          <p className="mt-0.5 text-sm text-nx-secondary">
            Viewing tasks for workspace: <span className="font-semibold text-indigo-600">{activeProject?.name || 'No Project Selected'}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalStatus('TODO')}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Add task
        </button>
      </header>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-md border border-nx-border bg-nx-card px-3 py-1.5 text-sm text-nx-primary placeholder-nx-muted shadow-2xs focus:border-indigo-500 focus:outline-none"
          />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border border-nx-border bg-nx-card px-3 py-1.5 text-sm text-nx-primary shadow-2xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="flex-1 text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss"
            className="rounded p-0.5 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Board */}
      {isLoading && tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading tasks
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.status}
                status={column.status}
                title={column.title}
                tasks={tasksByStatus[column.status]}
                risks={risks}
                onAddTask={setModalStatus}
                onOpenDetail={(task) => setSelectedTask(task)}
                accentClassName={column.accentClassName}
              />
            ))}
          </div>

          <DragOverlay
            dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <CreateTaskModal
        isOpen={modalStatus !== null}
        onClose={() => setModalStatus(null)}
        defaultStatus={modalStatus ?? 'TODO'}
      />

      <TaskDetailModal
        task={selectedTask}
        onClose={() => {
          setSelectedTask(null);
          void fetchTasks();
        }}
      />
    </div>
  );
}
