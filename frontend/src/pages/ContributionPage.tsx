import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Download, RefreshCw, Users, Filter,
  Activity, Clock, AlertCircle,
} from 'lucide-react';
import {
  fetchProjectContributions,
  fetchProjectTimeline,
  downloadContributionPDF,
  type ContribMember,
  type TimelineItem,
  type ProjectContributionsResponse,
} from '../services/contributionApi';
import MemberContributionCard from '../components/contributions/MemberContributionCard';
import MemberDetailPanel from '../components/contributions/MemberDetailPanel';
import ContributionTimeline from '../components/contributions/ContributionTimeline';
import SEOHead from '../components/common/SEOHead';

import { useProjectStore } from '../store/useProjectStore';
import { getApiUrl, getAuthHeaders } from '../config/api';

function useMilestones(projectId: string) {
  const [milestones, setMilestones] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (!projectId) return;
    fetch(getApiUrl(`/analytics/milestones/${projectId}`), { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMilestones(data); })
      .catch(() => {});
  }, [projectId]);
  return milestones;
}

// Period presets
const PERIODS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Custom', value: 'custom' },
];

function periodDates(period: string): { start: string; end: string } {
  const now = new Date();
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  if (period === 'month') {
    const start = new Date(now);
    start.setDate(1);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  return { start: '', end: '' };
}

type Tab = 'members' | 'timeline';

export default function ContributionPage() {
  const { projects, activeProject, loadProjects } = useProjectStore();

  const [selectedProject, setSelectedProject] = useState(activeProject?.id || '');
  const [period, setPeriod] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const [data, setData] = useState<ProjectContributionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tlItems, setTlItems] = useState<TimelineItem[]>([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlPage, setTlPage] = useState(1);
  const [tlTotal, setTlTotal] = useState(0);
  const [tlPages, setTlPages] = useState(0);

  const [selectedMember, setSelectedMember] = useState<ContribMember | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const milestones = useMilestones(selectedProject);

  useEffect(() => {
    loadProjects();
  }, []);

  // Auto-select first project if none selected
  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      setSelectedProject(activeProject?.id || projects[0].id);
    }
  }, [projects, activeProject, selectedProject]);

  const dateRange = period === 'custom'
    ? { start: customStart, end: customEnd }
    : periodDates(period);

  const loadContributions = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectContributions(selectedProject, {
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
        milestone_id: milestoneFilter || undefined,
      });
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, period, customStart, customEnd, milestoneFilter]);

  const loadTimeline = useCallback(async (page = 1) => {
    if (!selectedProject) return;
    setTlLoading(true);
    try {
      const res = await fetchProjectTimeline(selectedProject, {
        page,
        limit: 25,
        user_id: memberFilter || undefined,
        activity_type: activityTypeFilter || undefined,
        milestone_id: milestoneFilter || undefined,
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
      });
      setTlItems(res.items);
      setTlTotal(res.total);
      setTlPages(res.pages);
      setTlPage(res.page);
    } catch (e) {
      console.error(e);
    } finally {
      setTlLoading(false);
    }
  }, [selectedProject, memberFilter, activityTypeFilter, milestoneFilter, period, customStart, customEnd]);

  useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  useEffect(() => {
    if (activeTab === 'timeline') loadTimeline(1);
  }, [activeTab, loadTimeline]);

  const handlePdfExport = async () => {
    if (!selectedProject || !data) return;
    setPdfLoading(true);
    try {
      await downloadContributionPDF(selectedProject, data.project_name);
    } catch (e: any) {
      alert('PDF export failed: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const filteredMembers = (data?.members ?? []).filter(m =>
    !memberFilter || m.user.id === memberFilter
  );

  const ACTIVITY_TYPES = [
    { value: '', label: 'All Activity' },
    { value: 'TASK_COMPLETED', label: 'Task Completions' },
    { value: 'TASK_CREATED', label: 'Task Created' },
    { value: 'COMMENT_CREATED', label: 'Comments' },
    { value: 'REPLY_CREATED', label: 'Replies' },
    { value: 'STATUS_CHANGE', label: 'Status Changes' },
    { value: 'TASK_ASSIGNED', label: 'Assignments' },
  ];

  return (
    <div className="space-y-6">
      <SEOHead
        title="Team Contribution & Activity Records"
        description="Evidence-based audit trail of team member contributions, completed tasks, discussions, and milestone achievements."
      />
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-nx-primary">Contribution</h1>
          </div>
          <p className="text-sm text-nx-secondary">
            A transparent record of each team member's verified project activity.{' '}
            <span className="font-medium text-nx-primary">Not a performance ranking.</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadContributions}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-nx-border bg-nx-card text-xs font-medium text-nx-secondary hover:bg-nx-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handlePdfExport}
            disabled={!data || pdfLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            <Download className={`h-3.5 w-3.5 ${pdfLoading ? 'animate-bounce' : ''}`} />
            {pdfLoading ? 'Generating...' : 'Export PDF Report'}
          </button>
        </div>
      </div>

      {/* ── Disclaimer banner ────────────────────────────────── */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex gap-3">
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-semibold">Recorded Activity Only:</span> This dashboard shows verified actions from the project database.
          Counts reflect recorded events, not a measure of effort, quality, difficulty, or individual ownership.
          No contribution score or ranking is calculated.
        </p>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="bg-nx-card rounded-2xl border border-nx-border shadow-2xs p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-nx-muted" />
          <span className="text-sm font-semibold text-nx-primary">Filters</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Project */}
          <div>
            <label className="block text-xs font-medium text-nx-secondary mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={e => { setSelectedProject(e.target.value); setMilestoneFilter(''); setMemberFilter(''); }}
              className="w-full rounded-lg border border-nx-border text-xs py-2 px-3 bg-nx-elevated text-nx-primary focus:outline-none focus:border-indigo-400"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-xs font-medium text-nx-secondary mb-1">Period</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full rounded-lg border border-nx-border text-xs py-2 px-3 bg-nx-elevated text-nx-primary focus:outline-none focus:border-indigo-400"
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Member */}
          <div>
            <label className="block text-xs font-medium text-nx-secondary mb-1">Member</label>
            <select
              value={memberFilter}
              onChange={e => setMemberFilter(e.target.value)}
              className="w-full rounded-lg border border-nx-border text-xs py-2 px-3 bg-nx-elevated text-nx-primary focus:outline-none focus:border-indigo-400"
            >
              <option value="">All Members</option>
              {data?.members.map(m => (
                <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>
              ))}
            </select>
          </div>

          {/* Milestone */}
          <div>
            <label className="block text-xs font-medium text-nx-secondary mb-1">Milestone</label>
            <select
              value={milestoneFilter}
              onChange={e => setMilestoneFilter(e.target.value)}
              className="w-full rounded-lg border border-nx-border text-xs py-2 px-3 bg-nx-elevated text-nx-primary focus:outline-none focus:border-indigo-400"
            >
              <option value="">All Milestones</option>
              {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-nx-secondary mb-1">Start Date</label>
              <input
                type="date"
                value={customStart.split('T')[0] || ''}
                onChange={e => setCustomStart(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full rounded-lg border border-nx-border text-xs py-2 px-3 bg-nx-elevated text-nx-primary focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-nx-secondary mb-1">End Date</label>
              <input
                type="date"
                value={customEnd.split('T')[0] || ''}
                onChange={e => setCustomEnd(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full rounded-lg border border-nx-border text-xs py-2 px-3 bg-nx-elevated text-nx-primary focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Summary bar ──────────────────────────────────────── */}
      {data && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Team Members',
              value: data.members.length,
              icon: <Users className="h-5 w-5 text-indigo-500" />,
              border: 'border-nx-border',
            },
            {
              label: 'Total Tasks Completed',
              value: data.members.reduce((s, m) => s + m.stats.tasks_completed, 0),
              icon: <BarChart2 className="h-5 w-5 text-emerald-500" />,
              border: 'border-nx-border',
            },
            {
              label: 'Discussion Activity',
              value: data.members.reduce((s, m) => s + m.stats.comments + m.stats.replies, 0),
              icon: <Activity className="h-5 w-5 text-sky-500" />,
              border: 'border-nx-border',
            },
            {
              label: 'Recorded Events',
              value: data.members.reduce((s, m) => s + m.stats.activity_count, 0),
              icon: <Clock className="h-5 w-5 text-violet-500" />,
              border: 'border-nx-border',
            },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border p-4 flex items-center gap-3 bg-nx-card ${stat.border}`}>
              {stat.icon}
              <div>
                <p className="text-xl font-bold text-nx-primary">{stat.value}</p>
                <p className="text-xs text-nx-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-nx-elevated border border-nx-border p-1 rounded-xl w-fit">
        {([
          { id: 'members', label: 'Team Members', icon: <Users className="h-3.5 w-3.5" /> },
          { id: 'timeline', label: 'Activity Timeline', icon: <Activity className="h-3.5 w-3.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-nx-card text-indigo-600 shadow-2xs'
                : 'text-nx-secondary hover:text-nx-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Members tab ──────────────────────────────────────── */}
      {activeTab === 'members' && (
        <>
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-nx-card rounded-2xl border border-nx-border p-5 animate-pulse">
                  <div className="flex gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-nx-elevated" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3.5 bg-nx-elevated rounded w-32" />
                      <div className="h-3 bg-nx-elevated rounded w-24" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(j => <div key={j} className="h-14 bg-nx-elevated rounded-xl" />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredMembers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map(m => (
                <MemberContributionCard
                  key={m.user.id}
                  member={m}
                  onViewDetail={setSelectedMember}
                />
              ))}
            </div>
          )}

          {!loading && !error && filteredMembers.length === 0 && data && (
            <div className="py-16 text-center bg-nx-card rounded-2xl border border-nx-border">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-nx-muted text-sm">No team members found.</p>
            </div>
          )}
        </>
      )}

      {/* ── Timeline tab ─────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="bg-nx-card rounded-2xl border border-nx-border shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-nx-primary">Project Activity Timeline</span>
              {tlTotal > 0 && (
                <span className="text-xs text-nx-muted">({tlTotal} events)</span>
              )}
            </div>

            {/* Activity type filter */}
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setActivityTypeFilter(t.value); loadTimeline(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activityTypeFilter === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-nx-elevated border border-nx-border text-nx-secondary hover:bg-nx-hover hover:text-nx-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ContributionTimeline items={tlItems} loading={tlLoading} showActor={true} />

          {/* Pagination */}
          {tlPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-nx-border">
              <button
                disabled={tlPage <= 1}
                onClick={() => loadTimeline(tlPage - 1)}
                className="text-xs text-nx-secondary disabled:opacity-40 hover:text-indigo-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-nx-hover"
              >
                ← Previous
              </button>
              <span className="text-xs text-nx-muted">Page {tlPage} of {tlPages}</span>
              <button
                disabled={tlPage >= tlPages}
                onClick={() => loadTimeline(tlPage + 1)}
                className="text-xs text-nx-secondary disabled:opacity-40 hover:text-indigo-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-nx-hover"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Member detail panel ──────────────────────────────── */}
      {selectedMember && (
        <MemberDetailPanel
          member={selectedMember}
          projectId={selectedProject}
          onClose={() => setSelectedMember(null)}
          dateRange={dateRange}
        />
      )}
    </div>
  );
}
