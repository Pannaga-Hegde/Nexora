import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';
import { getApiUrl, getAuthHeaders } from '../config/api';
import SEOHead from '../components/common/SEOHead';
import ConfirmationModal from '../components/common/ConfirmationModal';

interface CalendarEventItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string | null;
  creator_id?: string | null;
  creator_name?: string | null;
}

export default function CalendarViewPage() {
  const { activeProject, projects, loadProjects, setActiveProject } = useProjectStore();
  const currentUser = useAuthStore((state) => state.user);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState('MEETING');

  // Cancel Meeting modal state
  const [meetingToCancel, setMeetingToCancel] = useState<CalendarEventItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) {
      if (projects.length === 0) {
        loadProjects();
      } else if (projects[0]) {
        setActiveProject(projects[0].id);
      }
    }
  }, [activeProject, projects, loadProjects, setActiveProject]);

  const fetchEvents = async () => {
    if (!activeProject) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/workflow/calendar/events/${activeProject.id}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [activeProject]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newTitle.trim() || !newDate) return;

    try {
      const res = await fetch(getApiUrl(`/workflow/calendar/events/${activeProject.id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          start_time: new Date(newDate).toISOString(),
          event_type: newType,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewDate('');
        fetchEvents();
      }
    } catch (err) {
      console.error('Failed to create calendar event:', err);
    }
  };

  const handleConfirmCancelMeeting = async () => {
    if (!meetingToCancel) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(getApiUrl(`/workflow/calendar/events/${meetingToCancel.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error("You don't have permission to cancel this meeting. Only the scheduler can cancel it.");
        } else if (res.status === 404) {
          throw new Error('This meeting could not be found or has already been cancelled.');
        } else {
          throw new Error(errData.detail || 'Failed to cancel meeting. Please try again.');
        }
      }

      setEvents((prev) => prev.filter((e) => e.id !== meetingToCancel.id));
      setMeetingToCancel(null);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'An error occurred while cancelling the meeting.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <SEOHead
        title="Project Calendar & Deadlines"
        description="View and schedule upcoming project deadlines, sprint reviews, and team sync meetings."
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-nx-primary">Project Calendar & Deadlines</h1>
          <p className="mt-1 text-sm text-nx-muted">
            Map project milestones, deadlines, and team sync meetings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Schedule Event
        </button>
      </div>

      {/* Events Grid View */}
      <div className="rounded-xl border border-nx-border bg-nx-card p-6 shadow-xs transition-colors">
        <h2 className="text-base font-semibold text-nx-primary mb-4 flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-indigo-500" />
          Scheduled Workspace Deadlines & Events
        </h2>

        {loading ? (
          <div className="text-xs text-nx-muted">Loading calendar...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-nx-muted">
            No deadlines or events scheduled for this workspace yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((evt) => {
              const isScheduler =
                (currentUser?.id && evt.creator_id && currentUser.id === evt.creator_id) ||
                (currentUser?.full_name && evt.creator_name && currentUser.full_name === evt.creator_name);
              const isCustomMeeting = !evt.id.startsWith('task-');

              return (
                <div
                  key={evt.id}
                  className="group rounded-xl border border-nx-border bg-nx-elevated p-4 shadow-2xs transition-all hover:border-nx-border-strong flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          evt.event_type === 'DEADLINE'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : evt.event_type === 'MILESTONE'
                            ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}
                      >
                        {evt.event_type}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-nx-muted font-medium">
                        <Clock className="h-3.5 w-3.5 text-nx-muted" />
                        <span>{new Date(evt.start_time).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-nx-primary">{evt.title}</h3>
                    {evt.description && (
                      <p className="mt-1 text-xs text-nx-secondary line-clamp-2">{evt.description}</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-nx-border flex items-center justify-between text-xs">
                    {evt.creator_name ? (
                      <span className="text-[11px] text-nx-muted flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-indigo-500" />
                        By {evt.creator_name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-nx-muted">System Generated</span>
                    )}

                    {isCustomMeeting && isScheduler && (
                      <button
                        type="button"
                        onClick={() => {
                          setMeetingToCancel(evt);
                          setCancelError(null);
                        }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                        title="Cancel this meeting (Participants will be notified)"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Cancel Meeting</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!meetingToCancel}
        title="Cancel Meeting?"
        message={`Are you sure you want to cancel "${meetingToCancel?.title || 'this meeting'}"? Workspace participants will be notified and this event will be removed from the calendar.`}
        confirmLabel="Cancel Meeting"
        cancelLabel="Keep Meeting"
        variant="danger"
        isLoading={isCancelling}
        errorMessage={cancelError}
        onConfirm={handleConfirmCancelMeeting}
        onCancel={() => {
          if (!isCancelling) {
            setMeetingToCancel(null);
            setCancelError(null);
          }
        }}
      />

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="isolate w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 text-gray-900"
            style={{ backgroundColor: '#ffffff' }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-base font-bold text-gray-900">Schedule Calendar Event / Meeting</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="Sprint Review Meeting"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ backgroundColor: '#ffffff' }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Event Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  style={{ backgroundColor: '#ffffff' }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="MEETING">Sync / Meeting</option>
                  <option value="DEADLINE">Deadline</option>
                  <option value="MILESTONE">Milestone</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ backgroundColor: '#ffffff' }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Agenda and notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ backgroundColor: '#ffffff' }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

