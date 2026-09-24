import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import {
  useTaskStore,
  type TaskPriority,
  type TaskStatus,
} from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const TITLE_MAX = 120;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Column the user clicked "Add task" from. Falls back to TODO. */
  defaultStatus?: TaskStatus;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  defaultStatus = 'TODO',
}: CreateTaskModalProps) {
  const createTask = useTaskStore((s) => s.createTask);
  const isCreating = useTaskStore((s) => s.isLoading);
  const activeProject = useProjectStore((s) => s.activeProject);
  const members = useProjectStore((s) => s.members);
  const loadingMembers = useProjectStore((s) => s.loadingMembers);
  const fetchMembers = useProjectStore((s) => s.fetchMembers);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);

  // Drives the enter/exit transition.
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && activeProject && members.length === 0) {
      void fetchMembers(activeProject.id);
    }
  }, [isOpen, activeProject, members.length, fetchMembers]);

  // Mount/unmount choreography and form resetting.
  useEffect(() => {
    if (isOpen) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      setIsMounted(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsMounted(false);
      lastFocusedRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Reset form inputs asynchronously when modal opens
  useEffect(() => {
    if (isOpen) {
      const resetTimer = setTimeout(() => {
        setTitle('');
        setDescription('');
        setStatus(defaultStatus);
        setPriority('MEDIUM');
        setAssigneeId('');
        setDueDate('');
        setTitleError(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, defaultStatus]);

  // Autofocus the title once the panel is on screen.
  useEffect(() => {
    if (isVisible) titleInputRef.current?.focus();
  }, [isVisible]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!isMounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMounted]);

  // Escape to close, Tab cycles within the dialog.
  useEffect(() => {
    if (!isMounted) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, textarea, select, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, isCreating, onClose]);

  if (!isMounted) return null;

  async function handleSubmit() {
    const trimmed = title.trim();

    if (!trimmed) {
      setTitleError('Give the task a title so your team knows what it is.');
      titleInputRef.current?.focus();
      return;
    }

    if (!activeProject) {
      setTitleError('Select a project before adding tasks.');
      return;
    }

    try {
      await createTask({
        title: trimmed,
        description: description.trim() || undefined,
        status,
        priority,
        assignee_id: assigneeId || undefined,
        due_date: dueDate ? `${dueDate}T00:00:00` : undefined,
      });
      onClose();
    } catch {
      // Error handled in store
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-heading"
    >
      {/* Backdrop */}
      <div
        onClick={() => !isCreating && onClose()}
        className={[
          'fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      {/* Solid Opaque Panel */}
      <div
        ref={dialogRef}
        className={[
          'isolate relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden',
          'transition-all duration-200 ease-out motion-reduce:transition-none',
          isVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-2 scale-[0.98] opacity-0',
        ].join(' ')}
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2
              id="create-task-heading"
              className="text-base font-bold text-gray-900"
            >
              New task
            </h2>
            {activeProject && (
              <p className="mt-0.5 text-xs text-gray-500">
                Adding to <span className="font-semibold text-gray-700">{activeProject.name}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 bg-white px-6 py-5">
          {/* Title */}
          <div>
            <label
              htmlFor="task-title"
              className="block text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              Title
            </label>
            <input
              id="task-title"
              ref={titleInputRef}
              type="text"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="What needs to get done?"
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? 'task-title-error' : undefined}
              className={[
                'mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all',
                titleError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'focus:border-indigo-500 focus:ring-indigo-100',
              ].join(' ')}
              style={{ backgroundColor: '#ffffff', color: '#111827' }}
            />
            {titleError && (
              <p id="task-title-error" className="mt-1.5 text-xs font-medium text-red-500">
                {titleError}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="task-description"
              className="block text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              Description
            </label>
            <textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context, links, or acceptance criteria."
              className="mt-1.5 w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              style={{ backgroundColor: '#ffffff', color: '#111827' }}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-status"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700"
              >
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="task-priority"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700"
              >
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-assignee"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700"
              >
                Assignee
              </label>
              <select
                id="task-assignee"
                value={assigneeId}
                disabled={loadingMembers}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                <option value="">Unassigned</option>
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
                <label
                  htmlFor="task-due-date"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-700"
                >
                  Due Date
                </label>
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
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 border-t border-gray-200 bg-gray-50/90 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isCreating || title.trim().length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isCreating ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
