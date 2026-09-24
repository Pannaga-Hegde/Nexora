import { create } from 'zustand';
import { useProjectStore } from './useProjectStore';
import { getApiUrl, getAuthHeaders } from '../config/api';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: (projectId?: string) => Promise<void>;
  createTask: (taskData: {
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date?: string | null;
    assignee_id?: string;
  }) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  clearError: () => void;
}

async function extractErrorMessage(response: Response, defaultMsg: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((err: { msg?: string }) => err.msg || JSON.stringify(err))
        .join(', ');
    }
    return JSON.stringify(data);
  } catch {
    return defaultMsg;
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchTasks: async (overrideProjectId?: string) => {
    const activeProject = useProjectStore.getState().activeProject;
    const targetProjectId = overrideProjectId || activeProject?.id;

    if (!targetProjectId) {
      set({ tasks: [], isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(getApiUrl(`/projects/${targetProjectId}/tasks`), {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      
      if (!response.ok) {
        const errorMsg = await extractErrorMessage(response, 'Failed to fetch tasks');
        throw new Error(errorMsg);
      }

      const data: Task[] = await response.json();
      set({ tasks: data, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error while fetching tasks';
      set({ error: message, isLoading: false });
    }
  },

  createTask: async (taskData) => {
    const activeProject = useProjectStore.getState().activeProject;
    if (!activeProject) return;

    set({ error: null });

    try {
      const response = await fetch(
        getApiUrl(`/projects/${activeProject.id}/tasks`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(taskData),
        }
      );

      if (!response.ok) {
        const errorMsg = await extractErrorMessage(response, 'Failed to create task');
        throw new Error(errorMsg);
      }

      const newTask: Task = await response.json();
      set({
        tasks: [newTask, ...get().tasks],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      set({ error: message });
      throw err;
    }
  },

  moveTask: async (taskId: string, newStatus: TaskStatus) => {
    const activeProject = useProjectStore.getState().activeProject;
    if (!activeProject) return;

    const currentTasks = get().tasks;
    const targetTask = currentTasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.status === newStatus) return;

    const previousStatus = targetTask.status;

    set({
      tasks: currentTasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      error: null,
    });

    try {
      const response = await fetch(
        getApiUrl(`/projects/${activeProject.id}/tasks/${taskId}`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const errorMsg = await extractErrorMessage(response, `Couldn't move "${targetTask.title}"`);
        throw new Error(errorMsg);
      }

      const updatedTask: Task = await response.json();
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? updatedTask : t)),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task status';
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)),
        error: message,
      });
    }
  },

  updateTask: async (taskId, updates) => {
    const activeProject = useProjectStore.getState().activeProject;
    if (!activeProject) return;

    const currentTasks = get().tasks;
    const targetTask = currentTasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const previousTask = { ...targetTask };

    set({
      tasks: currentTasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      error: null,
    });

    try {
      const response = await fetch(
        getApiUrl(`/projects/${activeProject.id}/tasks/${taskId}`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorMsg = await extractErrorMessage(response, 'Failed to update task');
        throw new Error(errorMsg);
      }

      const updatedTask: Task = await response.json();
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? updatedTask : t)),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? previousTask : t)),
        error: message,
      });
    }
  },

  deleteTask: async (taskId: string) => {
    const activeProject = useProjectStore.getState().activeProject;
    if (!activeProject) return;

    const previousTasks = get().tasks;

    // Optimistic removal
    set({
      tasks: previousTasks.filter((t) => t.id !== taskId),
      error: null,
    });

    try {
      const response = await fetch(
        getApiUrl(`/projects/${activeProject.id}/tasks/${taskId}`),
        {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
    } catch (err: unknown) {
      // Rollback on failure
      const message = err instanceof Error ? err.message : 'Failed to delete task';
      set({
        tasks: previousTasks,
        error: message,
      });
    }
  },
}));