import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ArrowRight } from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../../config/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

/**
 * Validates that a link is a safe, relative internal application route.
 * Prevents protocol-relative URLs ('//evil.com') and dangerous schemes.
 */
function isSafeInternalUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('javascript:') &&
    !trimmed.includes('data:')
  );
}

export default function HeaderNotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch(getApiUrl('/workflow/notifications'), {
          headers: getAuthHeaders(),
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    load();
    const interval = setInterval(load, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await fetch(getApiUrl(`/workflow/notifications/${id}/read`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.is_read) {
      void handleMarkRead(n.id);
    }

    if (isSafeInternalUrl(n.link_url)) {
      setIsOpen(false);
      navigate(n.link_url!.trim());
    }
  };

  return (
    <div ref={containerRef} className="relative z-50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-nx-secondary hover:bg-nx-hover hover:text-nx-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="isolate absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] sm:w-96 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl z-50"
          style={{ backgroundColor: '#ffffff', opacity: 1 }}
        >
          <div className="flex items-center justify-between border-b border-gray-200 bg-white pb-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <span className="text-xs font-medium text-gray-500">{unreadCount} unread</span>
          </div>

          <div className="mt-3 max-h-72 overflow-y-auto space-y-2 bg-white">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 bg-white">No notifications yet.</div>
            ) : (
              notifications.map((n) => {
                const hasDestination = isSafeInternalUrl(n.link_url);

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative rounded-lg p-3 text-xs border transition-all ${
                      hasDestination
                        ? 'cursor-pointer hover:border-indigo-300 hover:shadow-xs'
                        : 'cursor-default'
                    } ${
                      n.is_read
                        ? 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-gray-100/80'
                        : 'bg-indigo-50 border-indigo-200 text-gray-900'
                    }`}
                    style={{
                      backgroundColor: n.is_read ? '#f9fafb' : '#eef2ff',
                      opacity: 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{n.title}</h4>
                        {hasDestination && (
                          <ArrowRight className="h-3 w-3 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMarkRead(n.id);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors shrink-0"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-gray-600 leading-relaxed">{n.message}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

