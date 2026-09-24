import { create } from 'zustand';
import { getApiUrl, getAuthHeaders } from '../../config/api';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_name?: string;
  due_date?: string;
}

/** What the modal submits. The server assigns the id. */
export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;

  fetchTasks: () => Promise<void>;
  createTask: (projectId: string, taskData: CreateTaskInput) => Promise<boolean>;
  moveTask: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  reorderTask: (
    activeId: string,
    overId: string,
    newStatus: TaskStatus,
  ) => Promise<void>;
  clearError: () => void;
}

/**
 * FastAPI returns problems as `detail`, which is either a string or a list
 * of validation error objects. Flatten both into something displayable.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;

    if (typeof detail === 'string') return detail;

    if (Array.isArray(detail)) {
      return detail
        .map((d: { msg?: string; loc?: (string | number)[] }) => {
          const field = Array.isArray(d.loc) ? d.loc.at(-1) : undefined;
          return field ? `${field}: ${d.msg ?? 'invalid'}` : (d.msg ?? 'invalid');
        })
        .join(', ');
    }
  } catch {
    // Body wasn't JSON — fall through to the status line.
  }

  return `Request failed (${response.status} ${response.statusText})`;
}

/** Sends the status change to the backend. Throws on any non-2xx response. */
async function putTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const response = await fetch(getApiUrl(`/tasks/${taskId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  isCreating: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchTasks: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(getApiUrl('/tasks/'), {
        headers: { Accept: 'application/json', ...getAuthHeaders() },
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const data: Task[] = await response.json();
      set({ tasks: data, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : 'Could not load tasks. Check that the API is running.',
      });
    }
  },

  createTask: async (projectId, taskData) => {
    const tempId = `temp_${crypto.randomUUID()}`;
    const optimisticTask: Task = { id: tempId, ...taskData };

    set((state) => ({
      tasks: [...state.tasks, optimisticTask],
      isCreating: true,
      error: null,
    }));

    try {
      const response = await fetch(
        getApiUrl(`/projects/${projectId}/tasks`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(taskData),
        },
      );

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const created: Task = await response.json();

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === tempId ? created : t)),
        isCreating: false,
      }));

      return true;
    } catch (err) {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== tempId),
        isCreating: false,
        error:
          err instanceof Error
            ? `Couldn't create the task: ${err.message}`
            : "Couldn't create the task. Try again.",
      }));

      return false;
    }
  },

  moveTask: async (taskId, newStatus) => {
    const previousTask = get().tasks.find((t) => t.id === taskId);
    if (!previousTask || previousTask.status === newStatus) return;

    const previousStatus = previousTask.status;

    set((state) => {
      const rest = state.tasks.filter((t) => t.id !== taskId);
      return {
        tasks: [...rest, { ...previousTask, status: newStatus }],
        error: null,
      };
    });

    try {
      await putTaskStatus(taskId, newStatus);
    } catch (err) {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: previousStatus } : t,
        ),
        error:
          err instanceof Error
            ? `Couldn't move "${previousTask.title}": ${err.message}`
            : `Couldn't move "${previousTask.title}". Try again.`,
      }));
    }
  },

  reorderTask: async (activeId, overId, newStatus) => {
    const { tasks } = get();
    const activeTask = tasks.find((t) => t.id === activeId);
    const activeIndex = tasks.findIndex((t) => t.id === activeId);
    const overIndex = tasks.findIndex((t) => t.id === overId);
    if (!activeTask || activeIndex === -1 || overIndex === -1) return;

    const previousStatus = activeTask.status;
    const statusChanged = previousStatus !== newStatus;

    const next = [...tasks];
    const [moved] = next.splice(activeIndex, 1);
    next.splice(overIndex, 0, { ...moved, status: newStatus });
    set({ tasks: next, error: null });

    if (!statusChanged) return;

    try {
      await putTaskStatus(activeId, newStatus);
    } catch (err) {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === activeId ? { ...t, status: previousStatus } : t,
        ),
        error:
          err instanceof Error
            ? `Couldn't move "${activeTask.title}": ${err.message}`
            : `Couldn't move "${activeTask.title}". Try again.`,
      }));
    }
  },
}));
