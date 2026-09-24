import { getApiUrl, getAuthHeaders } from '../config/api';

export interface DiscussionAuthor {
  id: string | null;
  username: string;
  full_name: string;
  email: string;
}

export interface DiscussionAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size_bytes?: number;
  mime_type?: string;
}

export interface DiscussionMention {
  user_id: string;
  username: string;
  full_name: string;
}

export interface LinkedTaskRef {
  id: string;
  title: string;
  status: string;
}

export interface DiscussionComment {
  id: string;
  task_id: string;
  parent_comment_id?: string | null;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
  author: DiscussionAuthor | null;
  attachments: DiscussionAttachment[];
  mentions: DiscussionMention[];
  converted_task?: LinkedTaskRef | null;
  linked_task?: LinkedTaskRef | null;
  replies?: DiscussionComment[];
}

export interface TaskDiscussionResponse {
  task_id: string;
  project_id: string;
  pinned_comments: DiscussionComment[];
  comments: DiscussionComment[];
}

export async function fetchTaskDiscussion(taskId: string): Promise<TaskDiscussionResponse> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to load task discussion');
  }
  return res.json();
}

export async function createDiscussionComment(
  taskId: string,
  content: string,
  parentCommentId?: string,
  attachmentIds?: string[]
): Promise<DiscussionComment> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      content,
      parent_comment_id: parentCommentId || undefined,
      attachment_ids: attachmentIds || undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to post comment');
  }
  return res.json();
}

export async function editDiscussionComment(
  taskId: string,
  commentId: string,
  content: string
): Promise<DiscussionComment> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to edit comment');
  }
  return res.json();
}

export async function deleteDiscussionComment(taskId: string, commentId: string): Promise<void> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}`), {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to delete comment');
  }
}

export async function pinDiscussionComment(taskId: string, commentId: string): Promise<DiscussionComment> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}/pin`), {
    method: 'POST',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error('Failed to pin comment');
  }
  return res.json();
}

export async function unpinDiscussionComment(taskId: string, commentId: string): Promise<DiscussionComment> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}/pin`), {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error('Failed to unpin comment');
  }
  return res.json();
}

export interface ExtractedTaskInfo {
  extracted_title: string;
  extracted_priority: string;
  extracted_due_date: string | null;
  extracted_assignee: {
    id: string;
    full_name: string;
    username: string;
  } | null;
  source_content: string;
}

export async function extractAiTaskDetails(
  taskId: string,
  commentId: string
): Promise<ExtractedTaskInfo> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}/extract-task-info`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to extract AI task details');
  }
  return res.json();
}

export async function convertCommentToTask(
  taskId: string,
  commentId: string,
  title?: string,
  priority?: string,
  assigneeId?: string,
  dueDate?: string
): Promise<{ message: string; task: LinkedTaskRef; comment: DiscussionComment }> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}/convert-to-task`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      title,
      priority,
      assignee_id: assigneeId || undefined,
      due_date: dueDate || undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to convert comment to task');
  }
  return res.json();
}

export async function linkTaskToComment(
  taskId: string,
  commentId: string,
  targetTaskId: string
): Promise<{ message: string; linked_task: LinkedTaskRef; comment: DiscussionComment }> {
  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/${commentId}/link-task`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ target_task_id: targetTaskId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to link task to comment');
  }
  return res.json();
}

export async function uploadDiscussionAttachment(taskId: string, file: File): Promise<DiscussionAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(getApiUrl(`/tasks/${taskId}/discussion/attachments`), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to upload attachment');
  }
  return res.json();
}
