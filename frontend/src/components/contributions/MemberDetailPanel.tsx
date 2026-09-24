import { useState, useEffect } from 'react';
import { X, CheckSquare, MessageSquare, Flag, Paperclip, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ContribMember } from '../../services/contributionApi';
import { fetchMemberTimeline } from '../../services/contributionApi';
import ContributionTimeline from './ContributionTimeline';

interface Props {
  member: ContribMember;
  projectId: string;
  onClose: () => void;
  dateRange: { start: string; end: string };
}

function getInitials(name: string): string {
  return name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

const ACTIVITY_TYPES = [
  { value: '', label: 'All Activity' },
  { value: 'TASK_COMPLETED', label: 'Completions' },
  { value: 'TASK_CREATED', label: 'Tasks Created' },
  { value: 'COMMENT_CREATED', label: 'Comments' },
  { value: 'REPLY_CREATED', label: 'Replies' },
  { value: 'STATUS_CHANGE', label: 'Status Changes' },
  { value: 'TASK_ASSIGNED', label: 'Assignments' },
];

export default function MemberDetailPanel({ member, projectId, onClose, dateRange }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlPage, setTlPage] = useState(1);
  const [tlTotal, setTlTotal] = useState(0);
  const [tlPages, setTlPages] = useState(0);
  const [activityFilter, setActivityFilter] = useState('');

  const { user, stats } = member;
  const LIMIT = 15;

  async function loadTimeline(page = 1, atype = activityFilter) {
    setTlLoading(true);
    try {
      const data = await fetchMemberTimeline(projectId, user.id, {
        page,
        limit: LIMIT,
        activity_type: atype || undefined,
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
      });
      setTimeline(data.items);
      setTlTotal(data.total);
      setTlPages(data.pages);
      setTlPage(data.page);
    } catch (e) {
      console.error(e);
    } finally {
      setTlLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'timeline') {
      loadTimeline(1, activityFilter);
    }
  }, [activeTab, activityFilter]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: `Timeline (${stats.activity_count})` },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-nx-card border-l border-nx-border shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="bg-nx-elevated border-b border-nx-border px-6 py-5 text-nx-primary shrink-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-nx-muted">Contribution Record</span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-nx-muted hover:text-nx-primary hover:bg-nx-hover transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
              {getInitials(user.full_name)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-nx-primary">{user.full_name}</h2>
              <p className="text-nx-secondary text-sm">{user.email}</p>
              <span className="mt-1 inline-block text-xs font-medium bg-nx-card border border-nx-border px-2 py-0.5 rounded-full capitalize text-nx-secondary">
                {user.role}
              </span>
            </div>
          </div>

          {/* Quick stats bar */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { label: 'Completed', value: stats.tasks_completed },
              { label: 'Comments', value: stats.comments + stats.replies },
              { label: 'Milestones', value: stats.milestones },
              { label: 'Events', value: stats.activity_count },
            ].map(s => (
              <div key={s.label} className="bg-nx-card border border-nx-border rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-nx-primary">{s.value}</p>
                <p className="text-[10px] text-nx-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-nx-border shrink-0 bg-nx-elevated">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                  : 'text-nx-secondary hover:text-nx-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-nx-card">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Disclaimer */}
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Note:</span> These counts reflect recorded project actions only — 
                  not a measure of effort, quality, or individual ownership.
                </p>
              </div>

              {/* Tasks */}
              <section>
                <h3 className="text-sm font-semibold text-nx-primary mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-500" /> Tasks
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-nx-elevated border border-nx-border p-3">
                    <p className="text-2xl font-bold text-emerald-500">{stats.tasks_completed}</p>
                    <p className="text-xs text-nx-muted font-medium">Completed</p>
                  </div>
                  <div className="rounded-xl bg-nx-elevated border border-nx-border p-3">
                    <p className="text-2xl font-bold text-nx-primary">{stats.tasks_assigned}</p>
                    <p className="text-xs text-nx-muted font-medium">Assigned Total</p>
                  </div>
                  {stats.tasks_overdue > 0 && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                      <p className="text-2xl font-bold text-red-500">{stats.tasks_overdue}</p>
                      <p className="text-xs text-red-500 font-medium">Overdue</p>
                    </div>
                  )}
                </div>

                {stats.completed_tasks.length > 0 && (
                  <div className="mt-3 rounded-lg border border-nx-border overflow-hidden">
                    <div className="px-3 py-2 bg-nx-elevated border-b border-nx-border">
                      <p className="text-xs font-semibold text-nx-muted uppercase tracking-wide">
                        Completed Tasks ({stats.completed_tasks.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-nx-border max-h-48 overflow-y-auto">
                      {stats.completed_tasks.map(t => (
                        <li key={t.id} className="px-3 py-2 flex items-center gap-2 bg-nx-card">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-xs text-nx-primary flex-1 truncate">{t.title}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                            t.priority === 'CRITICAL' ? 'bg-red-500/15 text-red-500 border border-red-500/30' :
                            t.priority === 'HIGH' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                            t.priority === 'MEDIUM' ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30' :
                            'bg-nx-elevated text-nx-muted border border-nx-border'
                          }`}>{t.priority}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Discussions */}
              <section>
                <h3 className="text-sm font-semibold text-nx-primary mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-sky-500" /> Discussions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-nx-elevated border border-nx-border p-3">
                    <p className="text-2xl font-bold text-sky-500">{stats.comments}</p>
                    <p className="text-xs text-nx-muted font-medium">Comments</p>
                  </div>
                  <div className="rounded-xl bg-nx-elevated border border-nx-border p-3">
                    <p className="text-2xl font-bold text-nx-primary">{stats.replies}</p>
                    <p className="text-xs text-nx-muted font-medium">Replies</p>
                  </div>
                </div>
              </section>

              {/* Milestones */}
              {stats.milestones > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-nx-primary mb-3 flex items-center gap-2">
                    <Flag className="h-4 w-4 text-fuchsia-500" /> Milestones Contributed To
                  </h3>
                  <div className="space-y-2">
                    {stats.milestones_list.map(m => (
                      <div key={m.id} className="flex items-center gap-2 rounded-lg border border-nx-border bg-nx-elevated px-3 py-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${m.is_completed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className="text-xs text-nx-primary flex-1">{m.title}</span>
                        <span className={`text-[9px] font-semibold ${m.is_completed ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {m.is_completed ? 'DONE' : 'IN PROGRESS'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Files */}
              {stats.files_uploaded > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-nx-primary mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-teal-500" /> Files
                  </h3>
                  <div className="rounded-xl bg-nx-elevated border border-nx-border p-3">
                    <p className="text-2xl font-bold text-teal-500">{stats.files_uploaded}</p>
                    <p className="text-xs text-nx-muted font-medium">Files uploaded</p>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {/* Activity type filter */}
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setActivityFilter(t.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activityFilter === t.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-nx-elevated border border-nx-border text-nx-secondary hover:bg-nx-hover hover:text-nx-primary'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tlTotal > 0 && (
                <p className="text-xs text-nx-muted">{tlTotal} recorded events</p>
              )}

              <ContributionTimeline items={timeline} loading={tlLoading} />

              {/* Pagination */}
              {tlPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-nx-border">
                  <button
                    disabled={tlPage <= 1}
                    onClick={() => loadTimeline(tlPage - 1)}
                    className="flex items-center gap-1 text-xs text-nx-secondary disabled:opacity-40 hover:text-indigo-500 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="text-xs text-nx-muted">Page {tlPage} of {tlPages}</span>
                  <button
                    disabled={tlPage >= tlPages}
                    onClick={() => loadTimeline(tlPage + 1)}
                    className="flex items-center gap-1 text-xs text-nx-secondary disabled:opacity-40 hover:text-indigo-500 transition-colors"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
