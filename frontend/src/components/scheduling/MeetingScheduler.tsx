import { useEffect, useState } from 'react';
import { Users, Sparkles, RefreshCw, CheckCircle2, Clock, Video } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSchedulingStore } from '../../store/useSchedulingStore';
import { getApiUrl, getAuthHeaders } from '../../config/api';

export default function MeetingScheduler() {
  const activeProject = useProjectStore((state) => state.activeProject);
  const { suggestions, loadMeetingSuggestions, loadingSuggestions } = useSchedulingStore();
  const [scheduledSlot, setScheduledSlot] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject?.id) {
      loadMeetingSuggestions(activeProject.id);
    }
  }, [activeProject?.id, loadMeetingSuggestions]);

  if (!activeProject) {
    return (
      <div className="rounded-xl border border-nx-border bg-nx-card p-6 text-center text-nx-muted text-sm">
        Please select an active project to view team availability and optimal meeting times.
      </div>
    );
  }

  const handleSchedule = async (slot: any) => {
    if (!activeProject) return;
    try {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      const res = await fetch(getApiUrl(`/workflow/calendar/events/${activeProject.id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: `Team Sync: ${slot.formatted_timeslot}`,
          description: `Scheduled meeting with ${slot.free_member_count}/${slot.total_member_count} members available (${slot.free_members.join(', ')}).`,
          event_type: 'MEETING',
          start_time: tomorrow.toISOString(),
        }),
      });
      if (res.ok) {
        setScheduledSlot(slot.formatted_timeslot);
        setTimeout(() => setScheduledSlot(null), 4000);
      }
    } catch (err) {
      console.error('Failed to schedule meeting event:', err);
    }
  };


  return (
    <div className="rounded-xl border border-nx-border bg-nx-card p-6 shadow-xs flex flex-col gap-5 transition-colors">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-nx-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-nx-primary">Optimal Team Meeting Suggestions</h2>
          </div>
          <p className="mt-1 text-xs text-nx-muted">
            Automatically computed overlapping free time windows for project <span className="font-semibold text-nx-primary">{activeProject.name}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => activeProject?.id && loadMeetingSuggestions(activeProject.id)}
          disabled={loadingSuggestions}
          className="flex items-center gap-1.5 rounded-lg border border-nx-border bg-nx-elevated px-3 py-1.5 text-xs font-semibold text-nx-primary hover:bg-nx-hover disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-nx-muted ${loadingSuggestions ? 'animate-spin' : ''}`} />
          <span>Recalculate Free Slots</span>
        </button>
      </div>

      {scheduledSlot && (
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Meeting successfully scheduled for <strong>{scheduledSlot}</strong>! Event synced to project calendar.</span>
        </div>
      )}

      {loadingSuggestions ? (
        <div className="py-12 text-center text-nx-muted flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
          <span className="text-xs font-medium">Running time-intersection algorithm across team schedules...</span>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-nx-border p-8 text-center text-nx-muted text-xs">
          No 100% overlapping free slots found for the upcoming week. Ask team members to update their Class & Unavailability schedules.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((slot, index) => {
            const isFullAttendance = slot.free_member_count === slot.total_member_count;

            return (
              <div
                key={index}
                className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all hover:shadow-sm ${
                  isFullAttendance
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-nx-border bg-nx-elevated'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${
                        isFullAttendance
                          ? 'bg-emerald-600 text-white'
                          : 'bg-nx-hover text-nx-primary'
                      }`}
                    >
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-nx-primary">{slot.formatted_timeslot}</h4>
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-nx-muted">
                        <Clock className="h-3 w-3" />
                        <span>Duration: {slot.start_time} - {slot.end_time}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                      isFullAttendance
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    {slot.free_member_count}/{slot.total_member_count} Free
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-nx-border flex items-center justify-between gap-2">
                  <div className="text-[11px] text-nx-secondary truncate max-w-[200px]" title={slot.free_members.join(', ')}>
                    <span className="font-semibold text-nx-primary">Available: </span>
                    {slot.free_members.join(', ')}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSchedule(slot)}
                    className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 shadow-xs transition-all shrink-0"
                  >
                    <Video className="h-3 w-3" />
                    <span>Schedule</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
