import { create } from 'zustand';
import type { DiscussionComment } from '../services/discussionApi';
import {
  fetchTaskDiscussion,
  createDiscussionComment,
  editDiscussionComment,
  deleteDiscussionComment,
  pinDiscussionComment,
  unpinDiscussionComment,
  convertCommentToTask,
  linkTaskToComment,
} from '../services/discussionApi';

interface DiscussionState {
  comments: DiscussionComment[];
  pinnedComments: DiscussionComment[];
  loading: boolean;
  error: string | null;

  loadDiscussion: (taskId: string) => Promise<void>;
  addComment: (taskId: string, content: string, parentCommentId?: string, attachmentIds?: string[]) => Promise<void>;
  updateComment: (taskId: string, commentId: string, content: string) => Promise<void>;
  removeComment: (taskId: string, commentId: string) => Promise<void>;
  togglePin: (taskId: string, commentId: string, isPinned: boolean) => Promise<void>;
  convertToTask: (
    taskId: string,
    commentId: string,
    title?: string,
    priority?: string,
    assigneeId?: string,
    dueDate?: string
  ) => Promise<void>;
  linkExistingTask: (taskId: string, commentId: string, targetTaskId: string) => Promise<void>;
  handleWebSocketEvent: (eventData: Record<string, unknown>) => void;
  clearError: () => void;
}

export const useDiscussionStore = create<DiscussionState>((set) => ({
  comments: [],
  pinnedComments: [],
  loading: false,
  error: null,

  loadDiscussion: async (taskId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetchTaskDiscussion(taskId);
      set({
        comments: res.comments,
        pinnedComments: res.pinned_comments,
        loading: false,
      });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load task discussion',
        loading: false,
      });
    }
  },

  addComment: async (taskId: string, content: string, parentCommentId?: string, attachmentIds?: string[]) => {
    set({ error: null });
    try {
      await createDiscussionComment(taskId, content, parentCommentId, attachmentIds);
      // Refresh discussion
      const res = await fetchTaskDiscussion(taskId);
      set({ comments: res.comments, pinnedComments: res.pinned_comments });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Error adding comment' });
      throw err;
    }
  },

  updateComment: async (taskId: string, commentId: string, content: string) => {
    set({ error: null });
    try {
      await editDiscussionComment(taskId, commentId, content);
      const res = await fetchTaskDiscussion(taskId);
      set({ comments: res.comments, pinnedComments: res.pinned_comments });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Error updating comment' });
      throw err;
    }
  },

  removeComment: async (taskId: string, commentId: string) => {
    set({ error: null });
    try {
      await deleteDiscussionComment(taskId, commentId);
      const res = await fetchTaskDiscussion(taskId);
      set({ comments: res.comments, pinnedComments: res.pinned_comments });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Error deleting comment' });
      throw err;
    }
  },

  togglePin: async (taskId: string, commentId: string, isPinned: boolean) => {
    set({ error: null });
    try {
      if (isPinned) {
        await unpinDiscussionComment(taskId, commentId);
      } else {
        await pinDiscussionComment(taskId, commentId);
      }
      const res = await fetchTaskDiscussion(taskId);
      set({ comments: res.comments, pinnedComments: res.pinned_comments });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Error toggling pin' });
    }
  },

  convertToTask: async (
    taskId: string,
    commentId: string,
    title?: string,
    priority?: string,
    assigneeId?: string,
    dueDate?: string
  ) => {
    set({ error: null });
    try {
      await convertCommentToTask(taskId, commentId, title, priority, assigneeId, dueDate);
      const res = await fetchTaskDiscussion(taskId);
      set({ comments: res.comments, pinnedComments: res.pinned_comments });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Error converting message to task' });
      throw err;
    }
  },

  linkExistingTask: async (taskId: string, commentId: string, targetTaskId: string) => {
    set({ error: null });
    try {
      await linkTaskToComment(taskId, commentId, targetTaskId);
      const res = await fetchTaskDiscussion(taskId);
      set({ comments: res.comments, pinnedComments: res.pinned_comments });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Error linking task to comment' });
      throw err;
    }
  },

  handleWebSocketEvent: (eventData: Record<string, unknown>) => {
    const eventName = typeof eventData.event === 'string' ? eventData.event : '';
    const taskId = typeof eventData.task_id === 'string' ? eventData.task_id : '';
    if (eventName.startsWith('TASK_COMMENT') || eventName.startsWith('TASK_LINKED') || eventName.startsWith('TASK_CREATED_FROM_COMMENT')) {
      if (taskId) {
        fetchTaskDiscussion(taskId).then((res) => {
          set({ comments: res.comments, pinnedComments: res.pinned_comments });
        }).catch(() => {});
      }
    }
  },

  clearError: () => set({ error: null }),
}));
