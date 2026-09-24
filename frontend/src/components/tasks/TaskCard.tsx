import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, AlertTriangle, Ban, CheckCircle2, ExternalLink } from 'lucide-react';
import { useTaskStore, type Task, type TaskPriority } from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';
import { getApiUrl, getAuthHeaders } from '../../config/api';
import type { TaskRiskAssessment } from '../../services/riskApi';
import ConfirmationModal from '../common/ConfirmationModal';

function getMemberInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    label: string;
    cardBg: string;
    cardBorder: string;
    borderAccent: string;
    badgeClass: string;
  }
> = {
  CRITICAL: {
    label: 'Critical',
    cardBg: 'bg-red-50/50 hover:bg-red-50/80',
    cardBorder: 'border-red-200/90 hover:border-red-300',
    borderAccent: 'border-l-[3.5px] border-l-red-500',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200 font-semibold',
  },
  HIGH: {
    label: 'High',
    cardBg: 'bg-amber-50/50 hover:bg-amber-50/80',
    cardBorder: 'border-amber-200/90 hover:border-amber-300',
    borderAccent: 'border-l-[3.5px] border-l-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200 font-semibold',
  },
  MEDIUM: {
    label: 'Medium',
    cardBg: 'bg-indigo-50/40 hover:bg-indigo-50/70',
    cardBorder: 'border-indigo-200/90 hover:border-indigo-300',
    borderAccent: 'border-l-[3.5px] border-l-indigo-500',
    badgeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold',
  },
  LOW: {
    label: 'Low',
    cardBg: 'bg-slate-50/60 hover:bg-slate-100/70',
    cardBorder: 'border-slate-200/90 hover:border-slate-300',
    borderAccent: 'border-l-[3.5px] border-l-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
  },
};

function formatDueDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isOverdue(iso?: string | null) {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

interface TaskCardProps {
  task: Task;
  risk?: TaskRiskAssessment;
  /** Set when rendered inside DragOverlay — skips the sortable hook. */
  isOverlay?: boolean;
  onOpenDetail?: (task: Task) => void;
}

export default function TaskCard({ task, risk, isOverlay = false, onOpenDetail }: TaskCardProps) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const members = useProjectStore((state) => state.members);

  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Find current assignee details from dynamic project members
  const currentMember = members.find((m) => m.id === task.assignee_id);
  const assigneeDisplayName = currentMember
    ? currentMember.full_name || currentMember.username
    : task.assignee_id
    ? 'Assigned'
    : null;
  const assigneeInitials = currentMember
    ? getMemberInitials(currentMember.full_name || currentMember.username)
    : '👤';

  const handleReassign = (e: React.MouseEvent, newAssigneeId: string) => {
    e.stopPropagation();
    void updateTask(task.id, { assignee_id: newAssigneeId === 'unassigned' ? undefined : newAssigneeId });
    setShowAssignMenu(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteTask(task.id);
      setShowDeleteModal(false);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'Task', status: task.status },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const dueDate = formatDueDate(task.due_date);
  const overdue = isOverdue(task.due_date) && task.status !== 'DONE';

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[110px] rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/40"
      />
    );
  }

  const getRiskDisplay = () => {
    if (!risk) return null;
    if (risk.status === 'BLOCKED') {
      return {
        label: 'Blocked',
        badgeClass: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
        dotClass: 'bg-rose-500',
        Icon: Ban,
        title: risk.primary_reason || 'Blocked by incomplete prerequisites',
      };
    }
    if (risk.status === 'AT_RISK') {
      return {
        label: 'At Risk',
        badgeClass: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
        dotClass: 'bg-amber-500',
        Icon: AlertTriangle,
        title: risk.primary_reason || 'At risk of delay or missing deadline',
      };
    }
    return {
      label: risk.is_completed ? 'Done' : 'On Track',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      dotClass: 'bg-emerald-500',
      Icon: CheckCircle2,
      title: 'Task is on track with no blockers',
    };
  };

  const riskDisplay = getRiskDisplay();

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenDetail?.(task)}
      className={[
        'group relative rounded-lg border p-3.5 shadow-xs',
        priorityConfig.cardBg,
        priorityConfig.cardBorder,
        priorityConfig.borderAccent,
        'cursor-pointer active:cursor-grabbing',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        isOverlay ? 'rotate-2 cursor-grabbing shadow-xl ring-2 ring-indigo-500 bg-white' : '',
      ].join(' ')}
    >
      {/* Top row: Title and Quick Actions */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-nx-primary line-clamp-2 pr-2 group-hover:text-indigo-600 transition-colors">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail?.(task);
            }}
            className="text-nx-muted hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            title="Open task details and risk dossier"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="text-nx-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            title="Delete task"
          >
            ✕
          </button>
        </div>
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-nx-secondary">{task.description}</p>
      )}

      {/* Middle row: Risk Indicator Badge if available */}
      {riskDisplay && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            title={riskDisplay.title}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${riskDisplay.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${riskDisplay.dotClass}`} />
            <riskDisplay.Icon className="h-3 w-3" />
            {riskDisplay.label}
          </span>
          {risk?.primary_reason && (
            <span className="truncate text-[10px] text-nx-muted max-w-[140px]" title={risk.primary_reason}>
              {risk.primary_reason}
            </span>
          )}
        </div>
      )}

      {/* Card Footer: Priority, Due Date, and Assignee / Forward Widget */}
      <div className="mt-3 flex items-center justify-between border-t border-nx-border/70 pt-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className={`uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${priorityConfig.badgeClass}`}>
            {priorityConfig.label}
          </span>
          {dueDate && (
            <span className={`flex items-center gap-1 text-[11px] ${overdue ? 'font-medium text-red-500' : 'text-nx-muted'}`}>
              <CalendarDays className="h-3 w-3" strokeWidth={2} />
              {dueDate}
            </span>
          )}
          {task.assignee_id && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await fetch(getApiUrl('/analytics/nudge'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                  body: JSON.stringify({ target_user_id: task.assignee_id, task_id: task.id, task_title: task.title }),
                });
                alert(`Sent friendly Nudge to teammate! 💬`);
              }}
              className="text-[10px] text-indigo-600 font-semibold hover:underline"
              title="Send friendly peer nudge"
            >
              💬 Nudge
            </button>
          )}
        </div>

        {/* Assignee / Forward Section */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAssignMenu(!showAssignMenu);
            }}
            className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 border border-indigo-200/50 transition-colors"
            title="Forward or Reassign Task"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] text-white font-bold">
              {assigneeInitials}
            </span>
            <span className="max-w-[70px] truncate text-[11px]">
              {assigneeDisplayName ? assigneeDisplayName.split(' ')[0] : 'Assign'}
            </span>
          </button>

          {/* Forward / Assign Dropdown Menu */}
          {showAssignMenu && (
            <div className="absolute right-0 bottom-full mb-2 z-30 w-48 rounded-lg border border-nx-border bg-white py-1 shadow-lg">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-nx-muted uppercase tracking-wider border-b border-nx-border">
                Forward / Assign To
              </div>
              <button
                type="button"
                onClick={(e) => handleReassign(e, 'unassigned')}
                className="w-full text-left px-3 py-1.5 text-xs text-nx-secondary hover:bg-nx-hover"
              >
                Unassigned
              </button>
              {members.length === 0 ? (
                <div className="px-3 py-1.5 text-xs text-nx-muted">No members found</div>
              ) : (
                members.map((member) => {
                  const mName = member.full_name || member.username;
                  return (
                    <button
                      type="button"
                      key={member.id}
                      onClick={(e) => handleReassign(e, member.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-nx-hover ${
                        task.assignee_id === member.id ? 'font-semibold text-indigo-600 bg-indigo-50/50' : 'text-nx-secondary'
                      }`}
                    >
                      <span className="truncate">{mName}</span>
                      {task.assignee_id === member.id && <span className="ml-1 shrink-0">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Task?"
        description={`Are you sure you want to delete "${task.title}"?\nThis will permanently remove the task and its associated activity.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
      />
    </div>
  );
}
