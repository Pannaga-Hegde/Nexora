import { useState, useEffect } from 'react';
import { useTaskStore, type Task, type TaskPriority, type TaskStatus } from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';
import TaskDiscussionSection from './TaskDiscussionSection';
import TaskRiskDossier from './TaskRiskDossier';
import ConfirmationModal from '../common/ConfirmationModal';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

function TaskDetailModalContent({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const activeProject = useProjectStore((state) => state.activeProject);
  const members = useProjectStore((state) => state.members);
  const loadingMembers = useProjectStore((state) => state.loadingMembers);
  const fetchMembers = useProjectStore((state) => state.fetchMembers);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');

  useEffect(() => {
    if (activeProject && members.length === 0) {
      void fetchMembers(activeProject.id);
    }
  }, [activeProject, members.length, fetchMembers]);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteTask(task.id);
      setShowDeleteModal(false);
      onClose();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTask(task.id, {
      title,
      description,
      priority,
      status,
      assignee_id: assigneeId || undefined,
      due_date: dueDate ? `${dueDate}T00:00:00` : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Dark backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      {/* Modal panel — fully opaque, isolated from backdrop blur */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
      <div className="isolate w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl border border-gray-200 my-8">
        <div className="flex items-center justify-between border-b border-nx-border pb-4">
          <h2 className="text-lg font-bold text-nx-primary">Task Details & Health</h2>
          <button
            onClick={onClose}
            className="text-nx-muted hover:text-nx-primary font-bold text-sm rounded p-1 hover:bg-nx-hover transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Real-time Task Risk & Health Dossier */}
        <div className="mt-4">
          <TaskRiskDossier taskId={task.id} projectId={activeProject?.id || task.project_id} />
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-nx-secondary">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-nx-secondary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-nx-secondary">Assignee</label>
            <select
              value={assigneeId}
              disabled={loadingMembers}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none disabled:opacity-60"
            >
              <option value="">Unassigned</option>
              {/* If task has an existing assignee not currently in the project member list, preserve display */}
              {task.assignee_id && !members.some((m) => m.id === task.assignee_id) && (
                <option value={task.assignee_id}>
                  Current Assignee ({task.assignee_id.slice(0, 8)}...)
                </option>
              )}
              {loadingMembers ? (
                <option value="" disabled>Loading project members...</option>
              ) : members.length === 0 ? (
                <option value="" disabled>No project members found</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ? `${m.full_name} (${m.project_role || 'member'})` : `${m.username} (${m.project_role || 'member'})`}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-nx-secondary">Due Date</label>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-nx-border">
            <button
              type="button"
              onClick={handleDeleteClick}
              className="rounded-lg bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition-colors"
            >
              Delete Task
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-nx-secondary hover:bg-nx-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>

        {/* Embedded Task Contextual Discussion Area */}
        <div className="mt-6 pt-6 border-t border-nx-border">
          <TaskDiscussionSection taskId={task.id} projectId={activeProject?.id || ''} />
        </div>
      </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Task?"
        description={`Are you sure you want to delete "${task.title}"?\nThis will permanently remove the task and all associated activities.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
      />
    </div>
  );
}

export default function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  if (!task) return null;
  return <TaskDetailModalContent task={task} onClose={onClose} />;
}
