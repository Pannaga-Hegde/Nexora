import React, { useEffect, useState, useRef } from 'react';
import {
  MessageSquare,
  Pin,
  CornerDownRight,
  Paperclip,
  Send,
  MoreVertical,
  CheckCircle2,
  Loader2,
  Trash2,
  Edit2,
  ExternalLink,
  PlusCircle,
  Link as LinkIcon,
  X,
  FileText,
  Sparkles,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { useDiscussionStore } from '../../store/useDiscussionStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  uploadDiscussionAttachment,
  extractAiTaskDetails,
} from '../../services/discussionApi';
import type {
  DiscussionComment,
  DiscussionAttachment,
  ExtractedTaskInfo,
} from '../../services/discussionApi';
import ConfirmationModal from '../common/ConfirmationModal';

interface TaskDiscussionSectionProps {
  taskId: string;
  projectId: string;
}

export default function TaskDiscussionSection({ taskId, projectId: _projectId }: TaskDiscussionSectionProps) {
  const currentUser = useAuthStore((state) => state.user);
  const {
    comments,
    pinnedComments,
    loading,
    loadDiscussion,
    addComment,
    updateComment,
    removeComment,
    togglePin,
    convertToTask,
    linkExistingTask,
  } = useDiscussionStore();

  const allTasks = useTaskStore((state) => state.tasks);

  const [inputContent, setInputContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<DiscussionComment | null>(null);
  const [editingComment, setEditingComment] = useState<DiscussionComment | null>(null);
  const [editContent, setEditContent] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<DiscussionAttachment[]>([]);

  const [activeMenuCommentId, setActiveMenuCommentId] = useState<string | null>(null);
  const [linkTaskModalComment, setLinkTaskModalComment] = useState<DiscussionComment | null>(null);
  const [selectedTargetTaskId, setSelectedTargetTaskId] = useState<string>('');

  const [convertModalComment, setConvertModalComment] = useState<DiscussionComment | null>(null);
  const [convertTaskTitle, setConvertTaskTitle] = useState('');
  const [convertTaskPriority, setConvertTaskPriority] = useState('MEDIUM');
  const [convertTaskDueDate, setConvertTaskDueDate] = useState('');
  const [convertTaskAssigneeId, setConvertTaskAssigneeId] = useState('');

  const [aiExtracting, setAiExtracting] = useState(false);

  // Delete comment confirmation state
  const [commentToDelete, setCommentToDelete] = useState<DiscussionComment | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null);
  const [aiExtractedData, setAiExtractedData] = useState<ExtractedTaskInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (taskId) {
      loadDiscussion(taskId);
    }
  }, [taskId, loadDiscussion]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim() && pendingAttachments.length === 0) return;

    try {
      await addComment(
        taskId,
        inputContent.trim(),
        replyingTo ? replyingTo.id : undefined,
        pendingAttachments.map((a) => a.id)
      );
      setInputContent('');
      setReplyingTo(null);
      setPendingAttachments([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      const uploaded = await uploadDiscussionAttachment(taskId, file);
      setPendingAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      await updateComment(taskId, commentId, editContent.trim());
      setEditingComment(null);
      setEditContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenConvertModal = async (comment: DiscussionComment) => {
    setConvertModalComment(comment);
    setConvertTaskTitle(comment.content.slice(0, 60));
    setConvertTaskPriority('MEDIUM');
    setConvertTaskDueDate('');
    setConvertTaskAssigneeId('');
    setAiExtractedData(null);
    setAiExtracting(true);

    try {
      const extracted = await extractAiTaskDetails(taskId, comment.id);
      setAiExtractedData(extracted);
      if (extracted.extracted_title) setConvertTaskTitle(extracted.extracted_title);
      if (extracted.extracted_priority) setConvertTaskPriority(extracted.extracted_priority);
      if (extracted.extracted_due_date) {
        setConvertTaskDueDate(extracted.extracted_due_date.split('T')[0]);
      }
      if (extracted.extracted_assignee?.id) {
        setConvertTaskAssigneeId(extracted.extracted_assignee.id);
      }
    } catch (err) {
      console.warn('AI NLP extraction fallback:', err);
    } finally {
      setAiExtracting(false);
    }
  };

  const handleConfirmConvert = async () => {
    if (!convertModalComment) return;
    try {
      await convertToTask(
        taskId,
        convertModalComment.id,
        convertTaskTitle,
        convertTaskPriority,
        convertTaskAssigneeId || undefined,
        convertTaskDueDate || undefined
      );
      setConvertModalComment(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to convert message to task');
    }
  };

  const handleConfirmLink = async () => {
    if (!linkTaskModalComment || !selectedTargetTaskId) return;
    try {
      await linkExistingTask(taskId, linkTaskModalComment.id, selectedTargetTaskId);
      setLinkTaskModalComment(null);
      setSelectedTargetTaskId('');
    } catch (err) {
      console.error('Failed to link task:', err);
    }
  };

  const handleConfirmDeleteComment = async () => {
    if (!commentToDelete) return;

    setIsDeletingComment(true);
    setDeleteCommentError(null);

    try {
      await removeComment(taskId, commentToDelete.id);
      setCommentToDelete(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteCommentError(err.message);
      } else {
        setDeleteCommentError('Failed to delete comment. Please try again.');
      }
    } finally {
      setIsDeletingComment(false);
    }
  };

  const renderMessageContent = (content: string, mentions: any[]) => {
    const mentionUsernames = new Set(mentions.map((m) => m.username));
    const words = content.split(/(\s+)/);

    return (
      <span className="whitespace-pre-wrap">
        {words.map((word, i) => {
          if (word.startsWith('@')) {
            const cleanName = word.substring(1).replace(/[^a-zA-Z0-9_\-\.]/g, '');
            if (mentionUsernames.has(cleanName)) {
              return (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-800 border border-indigo-200 mx-0.5"
                >
                  {word}
                </span>
              );
            }
          }
          return word;
        })}
      </span>
    );
  };

  const renderCommentItem = (comment: DiscussionComment, isReply = false) => {
    const isEditing = editingComment?.id === comment.id;
    const isAuthor =
      (currentUser?.id && comment.author?.id && currentUser.id === comment.author.id) ||
      currentUser?.full_name === comment.author?.full_name ||
      currentUser?.username === comment.author?.username;

    return (
      <div
        key={comment.id}
        className={`group relative flex gap-3 rounded-xl border p-3.5 transition-all ${
          isReply
            ? 'ml-6 bg-nx-elevated/70 border-nx-border'
            : comment.is_pinned
            ? 'bg-amber-500/10 border-amber-500/30 shadow-2xs'
            : 'bg-nx-card border-nx-border hover:border-nx-border-strong'
        }`}
      >
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 font-bold text-xs text-white shadow-2xs">
          {comment.author?.full_name ? comment.author.full_name[0].toUpperCase() : 'U'}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-nx-primary">
                {comment.author?.full_name || comment.author?.username || 'Unknown'}
              </span>
              <span className="text-[11px] text-nx-muted">
                {comment.created_at ? new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
              {comment.updated_at && comment.updated_at !== comment.created_at && (
                <span className="text-[10px] text-nx-muted italic">(edited)</span>
              )}
            </div>

            {/* Menu Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenuCommentId(activeMenuCommentId === comment.id ? null : comment.id)}
                className="rounded p-1 text-nx-muted opacity-0 group-hover:opacity-100 hover:bg-nx-hover hover:text-nx-primary transition-all"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {activeMenuCommentId === comment.id && (
                <div className="absolute right-0 top-6 z-20 w-52 rounded-lg bg-nx-card p-1 shadow-lg border border-nx-border text-xs space-y-0.5">
                  <button
                    onClick={() => {
                      setReplyingTo(comment);
                      setActiveMenuCommentId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium text-nx-secondary hover:bg-nx-hover hover:text-nx-primary"
                  >
                    <CornerDownRight className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Reply</span>
                  </button>

                  <button
                    onClick={() => {
                      togglePin(taskId, comment.id, comment.is_pinned);
                      setActiveMenuCommentId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium text-nx-secondary hover:bg-nx-hover hover:text-nx-primary"
                  >
                    <Pin className="h-3.5 w-3.5 text-amber-500" />
                    <span>{comment.is_pinned ? 'Unpin Message' : 'Pin Message'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveMenuCommentId(null);
                      handleOpenConvertModal(comment);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium text-emerald-600 hover:bg-nx-hover"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                    <span>Turn Into Task (AI)</span>
                  </button>

                  <button
                    onClick={() => {
                      setLinkTaskModalComment(comment);
                      setActiveMenuCommentId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium text-blue-600 hover:bg-nx-hover"
                  >
                    <LinkIcon className="h-3.5 w-3.5 text-blue-500" />
                    <span>Link Existing Task</span>
                  </button>

                  {isAuthor && (
                    <>
                      <button
                        onClick={() => {
                          setEditingComment(comment);
                          setEditContent(comment.content);
                          setActiveMenuCommentId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium text-nx-secondary hover:bg-nx-hover hover:text-nx-primary"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-nx-muted" />
                        <span>Edit Message</span>
                      </button>

                      <button
                        onClick={() => {
                          setCommentToDelete(comment);
                          setDeleteCommentError(null);
                          setActiveMenuCommentId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium text-red-600 hover:bg-nx-hover"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Edit Box or Content Text */}
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg border border-nx-border bg-nx-elevated p-2 text-xs text-nx-primary placeholder:text-nx-muted focus:border-indigo-400 focus:outline-none"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingComment(null)}
                  className="rounded px-2.5 py-1 text-xs text-nx-secondary hover:bg-nx-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(comment.id)}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-nx-secondary leading-relaxed">
              {renderMessageContent(comment.content, comment.mentions || [])}
            </div>
          )}

          {/* Attachments Chips */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {comment.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-nx-border bg-nx-elevated px-2.5 py-1 text-[11px] text-indigo-500 hover:bg-nx-hover transition-colors"
                >
                  <FileText className="h-3 w-3 text-indigo-500" />
                  <span className="font-medium truncate max-w-[150px] text-nx-primary">{att.file_name}</span>
                  <ExternalLink className="h-2.5 w-2.5 text-nx-muted" />
                </a>
              ))}
            </div>
          )}

          {/* Task Link Badges */}
          {comment.converted_task && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              <PlusCircle className="h-3 w-3 text-emerald-500" />
              <span>Converted Task: <strong>{comment.converted_task.title}</strong></span>
            </div>
          )}

          {comment.linked_task && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
              <LinkIcon className="h-3 w-3 text-blue-500" />
              <span>Linked Task: <strong>{comment.linked_task.title}</strong></span>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-2">
              {comment.replies.map((reply) => renderCommentItem(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-nx-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500 border border-indigo-500/20">
            <MessageSquare className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-nx-primary">Task Contextual Discussion</h3>
        </div>
        <span className="text-xs font-semibold text-nx-muted">{comments.length} comments</span>
      </div>

      {/* Pinned Messages Banner */}
      {pinnedComments && pinnedComments.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-700">
            <Pin className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>PINNED DISCUSSION HIGHLIGHTS</span>
          </div>
          <div className="space-y-1">
            {pinnedComments.map((pc) => (
              <div key={pc.id} className="flex items-center justify-between text-amber-800 font-medium">
                <span className="truncate">"{pc.content}" — <span className="text-amber-600">{pc.author?.full_name}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment Stream */}
      {loading ? (
        <div className="py-8 text-center text-nx-muted flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs">Loading task conversation...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-nx-border py-8 text-center text-nx-muted text-xs">
          No discussion on this task yet. Start the conversation below!
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {comments.map((comment) => renderCommentItem(comment))}
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 text-xs text-indigo-700">
          <div className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5 text-indigo-500" />
            <span>Replying to <strong>{replyingTo.author?.full_name || 'comment'}</strong>: "{replyingTo.content.slice(0, 40)}..."</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-nx-muted hover:text-nx-primary">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Pending Attachments */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {pendingAttachments.map((att) => (
            <div key={att.id} className="flex items-center gap-1.5 rounded-md bg-nx-elevated border border-nx-border px-2 py-1 text-[11px] text-nx-primary">
              <FileText className="h-3 w-3 text-nx-muted" />
              <span className="truncate max-w-[120px]">{att.file_name}</span>
              <button onClick={() => setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))}>
                <X className="h-3 w-3 text-nx-muted hover:text-nx-primary" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="space-y-2 pt-2 border-t border-nx-border">
        <div className="relative">
          <textarea
            rows={2}
            placeholder="Write a comment... (Use @username to mention team members, Cmd+Enter to send)"
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-nx-border bg-nx-elevated p-3 pr-10 text-xs text-nx-primary placeholder:text-nx-muted focus:border-indigo-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 rounded-lg border border-nx-border bg-nx-elevated px-2.5 py-1.5 text-xs font-medium text-nx-secondary hover:bg-nx-hover disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5 text-nx-muted" />}
              <span>{uploading ? 'Uploading...' : 'Attach File'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputContent.trim() && pendingAttachments.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send Comment</span>
          </button>
        </div>
      </form>

      {/* Convert to Task Modal with AI Auto-Extraction */}
      {convertModalComment && (
        <div className="fixed inset-0 z-[60]">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <div className="isolate w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-nx-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-nx-primary">Turn Conversation Into Task</h4>
                  <p className="text-[11px] text-nx-muted">AI auto-extracted task details from message</p>
                </div>
              </div>
              <button onClick={() => setConvertModalComment(null)}>
                <X className="h-4 w-4 text-nx-muted hover:text-nx-primary" />
              </button>
            </div>

            {/* Source Message Callout */}
            <div className="rounded-xl border border-nx-border bg-nx-elevated p-3 text-xs italic text-nx-secondary">
              "{convertModalComment.content}"
            </div>

            {/* AI Extraction Banner */}
            {aiExtracting ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-semibold text-emerald-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span>AI analyzing discussion context & calculating deadlines...</span>
              </div>
            ) : aiExtractedData ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs space-y-1.5 text-emerald-700">
                <div className="flex items-center justify-between font-bold text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    AI Extracted Metadata
                  </span>
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-md">Smart Match</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-nx-secondary pt-1">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Assignee: <strong className="text-nx-primary">{aiExtractedData.extracted_assignee ? aiExtractedData.extracted_assignee.full_name : 'Author (' + (convertModalComment.author?.full_name || 'User') + ')'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    <span>Deadline: <strong className="text-nx-primary">{aiExtractedData.extracted_due_date ? new Date(aiExtractedData.extracted_due_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'No deadline set'}</strong></span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Editable Form Inputs */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-nx-secondary">Task Title</label>
                <input
                  type="text"
                  value={convertTaskTitle}
                  onChange={(e) => setConvertTaskTitle(e.target.value)}
                  placeholder="e.g. Fix authentication bug"
                  className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated p-2 text-xs font-medium text-nx-primary placeholder:text-nx-muted focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-nx-secondary">Priority</label>
                  <select
                    value={convertTaskPriority}
                    onChange={(e) => setConvertTaskPriority(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated p-2 text-xs font-medium text-nx-primary focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-nx-secondary">Deadline (Due Date)</label>
                  <input
                    type="date"
                    value={convertTaskDueDate}
                    onChange={(e) => setConvertTaskDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated p-2 text-xs font-medium text-nx-primary focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-nx-border">
              <button
                onClick={() => setConvertModalComment(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-nx-secondary hover:bg-nx-hover hover:text-nx-primary rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConvert}
                disabled={aiExtracting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Create Task</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Link Existing Task Modal */}
      {linkTaskModalComment && (
        <div className="fixed inset-0 z-[60]">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <div className="isolate w-full max-w-md rounded-xl bg-white p-5 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-nx-border pb-3">
              <h4 className="text-sm font-bold text-nx-primary">Link Existing Task to Discussion Message</h4>
              <button onClick={() => setLinkTaskModalComment(null)}><X className="h-4 w-4 text-nx-muted hover:text-nx-primary" /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Select Project Task</label>
              <select
                value={selectedTargetTaskId}
                onChange={(e) => setSelectedTargetTaskId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated p-2 text-xs text-nx-primary focus:border-indigo-400 focus:outline-none"
              >
                <option value="">-- Choose a task to link --</option>
                {allTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-nx-border">
              <button onClick={() => setLinkTaskModalComment(null)} className="px-3 py-1.5 text-xs text-nx-secondary hover:bg-nx-hover hover:text-nx-primary rounded-md">Cancel</button>
              <button onClick={handleConfirmLink} disabled={!selectedTargetTaskId} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md">Link Task</button>
            </div>
          </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!commentToDelete}
        title="Delete Comment?"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={isDeletingComment}
        error={deleteCommentError}
        onConfirm={handleConfirmDeleteComment}
        onClose={() => !isDeletingComment && setCommentToDelete(null)}
      />
    </div>
  );
}
