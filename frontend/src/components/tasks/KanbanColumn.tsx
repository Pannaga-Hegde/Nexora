import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Task, TaskStatus } from '../../store/useTaskStore';
import type { TaskRiskAssessment } from '../../services/riskApi';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  risks?: Record<string, TaskRiskAssessment>;
  /** Opens the create modal pre-set to this column. */
  onAddTask?: (status: TaskStatus) => void;
  /** Opens task detail modal. */
  onOpenDetail?: (task: Task) => void;
  /** Tailwind class for the small dot next to the column title. */
  accentClassName?: string;
}

export default function KanbanColumn({
  status,
  title,
  tasks,
  risks,
  onAddTask,
  onOpenDetail,
  accentClassName = 'bg-slate-400',
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: 'Column', status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group/column flex w-72 shrink-0 flex-col rounded-xl bg-nx-elevated border transition-all min-h-[420px] ${
        isOver
          ? 'border-indigo-400 ring-2 ring-indigo-400/30 bg-indigo-50/20'
          : 'border-nx-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={`h-2 w-2 rounded-full ${accentClassName}`} />
        <h3 className="text-sm font-semibold text-nx-primary">{title}</h3>
        <span className="rounded bg-nx-card px-1.5 text-[11px] font-medium text-nx-secondary border border-nx-border">
          {tasks.length}
        </span>

        {onAddTask && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${title}`}
            className="ml-auto rounded p-1 text-nx-muted opacity-0 transition-all hover:bg-nx-hover hover:text-nx-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group-hover/column:opacity-100"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Droppable area */}
      <div className="flex flex-1 flex-col gap-2 p-2 min-h-[300px]">
        {tasks.length > 0 ? (
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                risk={risks ? risks[task.id] : undefined}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </SortableContext>
        ) : (
          <div
            className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-8 text-center text-xs transition-colors min-h-[160px] ${
              isOver
                ? 'border-indigo-400 bg-indigo-50/60 text-indigo-700 font-semibold'
                : 'border-nx-border bg-nx-card/40 text-nx-muted'
            }`}
          >
            <span>Drop a task here</span>
            {onAddTask && (
              <button
                type="button"
                onClick={() => onAddTask(status)}
                className="mt-1.5 text-[11px] text-indigo-600 hover:underline font-medium"
              >
                + or add task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
