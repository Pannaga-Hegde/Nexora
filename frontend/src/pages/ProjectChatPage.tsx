import { useState, useEffect, useRef } from 'react';
import { Send, Hash, Trash2 } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';
import { getApiUrl, getWebSocketUrl, getAuthHeaders } from '../config/api';
import SEOHead from '../components/common/SEOHead';
import ConfirmationModal from '../components/common/ConfirmationModal';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_name: string;
  content: string;
  created_at: string;
}

/**
 * Utility function to render text with @mentions highlighted as UI badges
 */
export function renderWithMentions(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_\s]+?\b)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={index}
          className="inline-flex items-center rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-xs font-semibold text-indigo-600 border border-indigo-500/30"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function ProjectChatPage() {
  const currentUser = useAuthStore((state) => state.user);
  const activeProject = useProjectStore((state) => state.activeProject);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Delete message confirmation state
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial REST chat messages
  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);

    fetch(getApiUrl(`/projects/${activeProject.id}/chat/messages`), {
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch((err) => console.error('Failed to load chat history:', err))
      .finally(() => setLoading(false));
  }, [activeProject]);

  // Connect WebSocket for real-time live messaging
  useEffect(() => {
    if (!activeProject) return;

    const wsUrl = getWebSocketUrl(`/ws/projects/${activeProject.id}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'new_message' && payload.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.data.id)) return prev;
            return [...prev, payload.data];
          });
        } else if (payload.event === 'message_deleted' && payload.data) {
          setMessages((prev) => prev.filter((m) => m.id !== payload.data.message_id));
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [activeProject]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeProject) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      await fetch(getApiUrl(`/projects/${activeProject.id}/chat/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ content: textToSend }),
      });
    } catch (err) {
      console.error('Failed to send chat message:', err);
    }
  };

  const handleConfirmDeleteMessage = async () => {
    if (!messageToDelete || !activeProject) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(getApiUrl(`/projects/${activeProject.id}/chat/messages/${messageToDelete.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error("You don't have permission to delete this message.");
        } else if (res.status === 404) {
          throw new Error('This message could not be found or has already been deleted.');
        } else {
          throw new Error(err.detail || 'Failed to delete message. Please try again.');
        }
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
      setMessageToDelete(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'An error occurred while deleting the message.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded-xl border border-nx-border bg-nx-card shadow-xs overflow-hidden transition-colors">
      <SEOHead
        title="Project Chat & Collaboration"
        description="Real-time contextual chat, teammate mentions, and thread discussions for your active workspace."
      />
      {/* Channel Header */}
      <div className="flex items-center justify-between border-b border-nx-border px-6 py-4 bg-nx-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-nx-primary">
              {activeProject ? `${activeProject.name} — General Channel` : 'Project Chat Room'}
            </h1>
            <p className="text-xs text-nx-muted">Real-time WebSocket contextual team communication</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>WebSocket Live</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-nx-card">
        {loading ? (
          <div className="text-xs text-nx-muted">Connecting to channel...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-nx-muted py-12">
            No messages sent in this channel yet. Type a message or mention a teammate with @Name!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              (currentUser?.id && msg.sender_id && currentUser.id === msg.sender_id) ||
              currentUser?.full_name === msg.sender_name ||
              currentUser?.username === msg.sender_name;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-nx-secondary">{msg.sender_name}</span>
                  <span className="text-[10px] text-nx-muted">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessageToDelete(msg);
                        setDeleteError(null);
                      }}
                      title="Delete your message"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div
                  className={`max-w-md rounded-xl px-4 py-2.5 text-sm ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                      : 'bg-nx-elevated text-nx-primary rounded-bl-none border border-nx-border'
                  }`}
                >
                  {renderWithMentions(msg.content)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSendMessage} className="border-t border-nx-border p-4 bg-nx-elevated flex gap-3">
        <input
          type="text"
          placeholder="Type a message or use @username to mention a teammate..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 rounded-lg border border-nx-border bg-nx-card px-4 py-2 text-sm text-nx-primary placeholder:text-nx-muted focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-xs"
        >
          <Send className="h-4 w-4" />
          <span>Send</span>
        </button>
      </form>

      <ConfirmationModal
        isOpen={!!messageToDelete}
        title="Delete Message?"
        description="Are you sure you want to delete this message? It will be permanently removed for all members in the project channel."
        confirmLabel="Delete"
        isLoading={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDeleteMessage}
        onClose={() => !isDeleting && setMessageToDelete(null)}
      />
    </div>
  );
}


