import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, Send, Tag, Megaphone, Sparkles, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getApiUrl, getAuthHeaders } from '../config/api';
import SEOHead from '../components/common/SEOHead';
import ConfirmationModal from '../components/common/ConfirmationModal';

interface CommunityPost {
  id: string;
  author_id?: string | null;
  author_name: string;
  author_role: string;
  title: string;
  content: string;
  category: string;
  likes_count: number;
  comments_count?: number;
  created_at: string;
}

export default function CommunityPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [postToDelete, setPostToDelete] = useState<CommunityPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      const res = await fetch(getApiUrl('/community/posts'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Failed to fetch community posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/community/posts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          category: newCategory,
        }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewContent('');
        setNewCategory('General');
        fetchPosts();
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p))
    );

    try {
      await fetch(getApiUrl(`/community/posts/${postId}/like`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(getApiUrl(`/community/posts/${postToDelete.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error("You don't have permission to perform this action.");
        } else if (res.status === 404) {
          throw new Error('This post could not be found or has already been removed.');
        } else {
          throw new Error(errData.detail || 'Failed to take down post. Please try again.');
        }
      }

      setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
      setPostToDelete(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'An error occurred while taking down the post.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SEOHead
        title="Community & Technical Feed"
        description="Share architectural discussions, team announcements, and development updates across the project."
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-nx-primary">Community & Tech Feed</h1>
          <p className="mt-1 text-sm text-nx-secondary">
            Share announcements, architectural discussions, and team updates across workspaces.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 border border-amber-500/30">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Active Workspace Feed</span>
        </div>
      </div>

      {/* Post Creation Card */}
      <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-2xs">
        <h2 className="text-sm font-semibold text-nx-primary flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          Start a Discussion or Announcement
        </h2>
        <form onSubmit={handleCreatePost} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Post title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="md:col-span-2 rounded-md border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary placeholder:text-nx-muted focus:border-indigo-400 focus:outline-none"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-md border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-400 focus:outline-none"
            >
              <option value="General">General</option>
              <option value="Announcement">Announcement</option>
              <option value="Tech Discussion">Tech Discussion</option>
              <option value="Design">Design</option>
              <option value="Q&A">Q&A</option>
            </select>
          </div>

          <textarea
            required
            rows={3}
            placeholder="Write your message or post details here..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full rounded-md border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary placeholder:text-nx-muted focus:border-indigo-400 focus:outline-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              {isSubmitting ? 'Posting...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Community Feed Posts */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-sm text-nx-muted">Loading community feed...</div>
        ) : (
          posts.map((post) => {
            const isAuthor =
              (currentUser?.id && post.author_id && currentUser.id === post.author_id) ||
              currentUser?.full_name === post.author_name ||
              currentUser?.username === post.author_name;

            return (
              <div key={post.id} className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-2xs transition-all hover:border-nx-border-strong">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-sm font-bold border border-indigo-500/30">
                      {post.author_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-nx-primary">{post.title}</h3>
                      <p className="text-xs text-nx-muted">
                        Posted by <span className="font-medium text-nx-secondary">{post.author_name}</span> ({post.author_role}) • {post.created_at}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    post.category === 'Announcement'
                      ? 'bg-purple-500/15 text-purple-600 border border-purple-500/30'
                      : post.category === 'Tech Discussion'
                      ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                      : 'bg-nx-elevated text-nx-secondary border border-nx-border'
                  }`}>
                    {post.category === 'Announcement' ? (
                      <Megaphone className="h-3 w-3" />
                    ) : (
                      <Tag className="h-3 w-3" />
                    )}
                    {post.category}
                  </span>
                </div>

                <p className="mt-3 text-sm text-nx-secondary leading-relaxed whitespace-pre-line">
                  {post.content}
                </p>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-nx-border">
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-nx-secondary hover:text-indigo-500 transition-colors"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>{post.likes_count} Likes</span>
                  </button>

                  {isAuthor && (
                    <button
                      type="button"
                      onClick={() => {
                        setPostToDelete(post);
                        setDeleteError(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      title="Take down this post"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Take Down Post</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmationModal
        isOpen={!!postToDelete}
        title="Take Down Post?"
        description={`Are you sure you want to take down "${postToDelete?.title}"?\nThis post will be permanently removed from the community feed.`}
        confirmLabel="Take Down"
        isLoading={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDeletePost}
        onClose={() => !isDeleting && setPostToDelete(null)}
      />
    </div>
  );
}


