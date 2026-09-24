import { useState, useEffect, useCallback } from 'react';
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  PauseCircle,
  UserX,
  Users,
  Flag,
  RefreshCw,
  SlidersHorizontal,
  FolderKanban,
  ChevronRight,
  Info,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import type { Task, TaskStatus, TaskPriority } from '../store/useTaskStore';
import {
  fetchProjectHealth,
  type ProjectHealthResponse,
  type HealthTaskItem,
} from '../services/healthApi';
import SEOHead from '../components/common/SEOHead';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';

type TabType = 'all' | 'overdue' | 'blocked' | 'stalled' | 'upcoming' | 'unassigned' | 'workload' | 'milestones';

const PRIORITY_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  HIGH: { label: 'High', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  MEDIUM: { label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  LOW: { label: 'Low', color: 'text-nx-secondary', bg: 'bg-nx-hover', border: 'border-nx-border' },
};

export default function ProjectHealthPage() {
  const { projects, activeProject, setActiveProject, loadProjects } = useProjectStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject?.id || '');

  const [healthData, setHealthData] = useState<ProjectHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [stalledDays, setStalledDays] = useState(5);
  const [upcomingDays, setUpcomingDays] = useState(3);
  const [showConfig, setShowConfig] = useState(false);

  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(activeProject?.id || projects[0].id);
    }
  }, [projects, activeProject, selectedProjectId]);

  const loadHealth = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectHealth(selectedProjectId, {
        stalled_days: stalledDays,
        upcoming_days: upcomingDays,
      });
      setHealthData(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load project health');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, stalledDays, upcomingDays]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleOpenTask = (item: HealthTaskItem) => {
    const taskObj: Task = {
      id: item.id,
      project_id: selectedProjectId,
      title: item.title,
      description: item.description || '',
      status: (item.status as TaskStatus) || 'TODO',
      priority: (item.priority as TaskPriority) || 'MEDIUM',
      assignee_id: item.assignee_id || undefined,
      assignee_name: item.assignee_name || undefined,
      due_date: item.due_date || undefined,
      created_at: item.created_at || undefined,
      updated_at: item.updated_at || undefined,
    };
    setSelectedTaskForModal(taskObj);
  };

  const handleCloseTaskModal = () => {
    setSelectedTaskForModal(null);
    loadHealth();
  };

  const getHealthPill = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          bg: 'bg-emerald-500',
          text: 'text-emerald-600',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
          icon: CheckCircle2,
          label: 'Healthy',
        };
      case 'NEEDS_ATTENTION':
        return {
          bg: 'bg-amber-500',
          text: 'text-amber-600',
          badgeBg: 'bg-amber-500/10 border-amber-500/20',
          icon: AlertTriangle,
          label: 'Needs Attention',
        };
      case 'AT_RISK':
        return {
          bg: 'bg-rose-500',
          text: 'text-rose-600',
          badgeBg: 'bg-rose-500/10 border-rose-500/20',
          icon: Ban,
          label: 'At Risk',
        };
      default:
        return {
          bg: 'bg-nx-muted',
          text: 'text-nx-secondary',
          badgeBg: 'bg-nx-elevated border-nx-border',
          icon: Info,
          label: 'No Data',
        };
    }
  };

  return (
    <div className="space-y-6">
      <SEOHead
        title="Project Health & Risk Diagnostics"
        description="Real-time operational health matrix, task blockers, overdue items, workload distribution, and milestone tracking."
      />
      {/* ── Top Header & Project Switcher ──────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-nx-primary tracking-tight">Project Health Dashboard</h1>
              <p className="text-xs text-nx-muted">
                Deterministic, explainable health diagnostics traceable to active tasks & activity records
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setActiveProject(e.target.value);
              }}
              className="appearance-none rounded-lg border border-nx-border bg-nx-card py-2 pl-3 pr-8 text-xs font-semibold text-nx-primary shadow-xs focus:border-indigo-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <FolderKanban className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-nx-muted" />
          </div>

          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all shadow-xs ${
              showConfig ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600' : 'bg-nx-card border-nx-border text-nx-primary hover:bg-nx-hover'
            }`}
            title="Configure health thresholds"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Thresholds</span>
          </button>

          <button
            type="button"
            onClick={loadHealth}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-nx-border bg-nx-card px-3 py-2 text-xs font-medium text-nx-primary hover:bg-nx-hover disabled:opacity-50 transition-all shadow-xs"
            title="Refresh health data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Thresholds Config Tray (collapsible) ────────────────────────── */}
      {showConfig && (
        <div className="rounded-xl border border-nx-border bg-nx-elevated p-4 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-bold text-nx-primary">Diagnostic Thresholds</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-nx-secondary">
              <div className="flex items-center gap-2">
                <label className="font-medium text-nx-secondary">Flag as Stalled after:</label>
                <select
                  value={stalledDays}
                  onChange={(e) => setStalledDays(Number(e.target.value))}
                  className="rounded-md border border-nx-border bg-nx-card px-2 py-1 text-xs font-semibold text-nx-primary focus:outline-none focus:border-indigo-500"
                >
                  <option value={3}>3 days of inactivity</option>
                  <option value={5}>5 days of inactivity (default)</option>
                  <option value={7}>7 days of inactivity</option>
                  <option value={14}>14 days of inactivity</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-medium text-nx-secondary">Approaching Deadlines window:</label>
                <select
                  value={upcomingDays}
                  onChange={(e) => setUpcomingDays(Number(e.target.value))}
                  className="rounded-md border border-nx-border bg-nx-card px-2 py-1 text-xs font-semibold text-nx-primary focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>Due within 24 hours</option>
                  <option value={3}>Due within 3 days (default)</option>
                  <option value={7}>Due within 7 days</option>
                  <option value={14}>Due within 14 days</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Banner ───────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <div className="flex-1">
            <p className="font-semibold">Unable to evaluate health</p>
            <p className="opacity-90">{error}</p>
          </div>
          <button
            onClick={loadHealth}
            className="rounded-md bg-rose-500/20 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {healthData?.overall_health.is_empty ? (
        <div className="rounded-2xl border border-dashed border-nx-border bg-nx-card p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-nx-elevated text-nx-muted">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-nx-primary">No Task Data Yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-nx-muted">
            Create tasks to begin tracking project completion, workload distribution, and real-time operational risks.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Task</span>
            </button>
          </div>
        </div>
      ) : healthData ? (
        <>
          {/* ── Section 1: Overall Progress & Health Classification ────── */}
          <div className="rounded-2xl border border-nx-border bg-nx-card p-6 shadow-xs">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Overall Health Badge & Summary */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-nx-muted">
                    Project Operational Status
                  </span>
                  {(() => {
                    const pill = getHealthPill(healthData.overall_health.status);
                    const PillIcon = pill.icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${pill.badgeBg} ${pill.text}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${pill.bg}`} />
                        <PillIcon className="h-3.5 w-3.5" />
                        {pill.label}
                      </span>
                    );
                  })()}
                </div>

                <h2 className="text-2xl font-bold text-nx-primary tracking-tight">
                  {healthData.project_name}
                </h2>

                <p className="text-xs text-nx-secondary max-w-2xl">
                  {healthData.overall_health.description}
                </p>
              </div>

              {/* Right: Explicit Progress Metrics */}
              <div className="rounded-xl border border-nx-border bg-nx-elevated p-5 lg:w-80">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-nx-primary">Task Completion</span>
                  <span className="text-2xl font-extrabold text-indigo-600">
                    {healthData.overall_health.task_completion_percentage}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-nx-hover border border-nx-border">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, healthData.overall_health.task_completion_percentage)}%` }}
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-nx-muted">
                  <span>{healthData.overall_health.completed_tasks} completed</span>
                  <span>{healthData.overall_health.total_tasks} total tasks</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Task Health Breakdown Matrix ────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-xl border p-4 text-left transition-all ${
                activeTab === 'all'
                  ? 'border-indigo-500/50 bg-indigo-500/10 shadow-xs'
                  : 'border-nx-border bg-nx-card hover:border-nx-border-strong hover:bg-nx-hover'
              }`}
            >
              <div className="flex items-center justify-between text-nx-muted">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-nx-muted">On Track</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-nx-primary">{healthData.breakdown.on_track}</p>
              <p className="text-[11px] text-nx-muted">On schedule</p>
            </button>

            <button
              onClick={() => setActiveTab('stalled')}
              className={`rounded-xl border p-4 text-left transition-all ${
                activeTab === 'stalled'
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                  : 'border-nx-border bg-nx-card hover:border-nx-border-strong hover:bg-nx-hover'
              }`}
            >
              <div className="flex items-center justify-between text-nx-muted">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-nx-muted">At Risk</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-600">{healthData.breakdown.at_risk}</p>
              <p className="text-[11px] text-nx-muted">Stalled or urgent</p>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              className={`rounded-xl border p-4 text-left transition-all ${
                activeTab === 'overdue'
                  ? 'border-rose-500/50 bg-rose-500/10 shadow-xs'
                  : 'border-nx-border bg-nx-card hover:border-nx-border-strong hover:bg-nx-hover'
              }`}
            >
              <div className="flex items-center justify-between text-nx-muted">
                <Clock className="h-4 w-4 text-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-nx-muted">Overdue</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-600">{healthData.breakdown.overdue}</p>
              <p className="text-[11px] text-nx-muted">Past deadline</p>
            </button>

            <button
              onClick={() => setActiveTab('blocked')}
              className={`rounded-xl border p-4 text-left transition-all ${
                activeTab === 'blocked'
                  ? 'border-rose-500/50 bg-rose-500/10 shadow-xs'
                  : 'border-nx-border bg-nx-card hover:border-nx-border-strong hover:bg-nx-hover'
              }`}
            >
              <div className="flex items-center justify-between text-nx-muted">
                <Ban className="h-4 w-4 text-rose-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-nx-muted">Blocked</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-600">{healthData.breakdown.blocked}</p>
              <p className="text-[11px] text-nx-muted">Dependencies</p>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className="rounded-xl border border-nx-border bg-nx-card p-4 text-left hover:border-nx-border-strong hover:bg-nx-hover transition-all"
            >
              <div className="flex items-center justify-between text-nx-muted">
                <PauseCircle className="h-4 w-4 text-nx-muted" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-nx-muted">Not Started</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-nx-primary">{healthData.breakdown.not_started}</p>
              <p className="text-[11px] text-nx-muted">In To-Do state</p>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className="rounded-xl border border-nx-border bg-nx-card p-4 text-left hover:border-nx-border-strong hover:bg-nx-hover transition-all"
            >
              <div className="flex items-center justify-between text-nx-muted">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-nx-muted">Done</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{healthData.breakdown.done}</p>
              <p className="text-[11px] text-nx-muted">Completed tasks</p>
            </button>
          </div>

          {/* ── Section 3: Why Attention Is Needed (Direct Drivers) ────── */}
          {healthData.reasons.length > 0 && (
            <div className="rounded-2xl border border-nx-border bg-nx-card p-6 shadow-xs">
              <div className="flex items-center gap-2 border-b border-nx-border pb-4">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-nx-primary">Why Attention Is Needed</h3>
                <span className="ml-auto text-[11px] text-nx-muted">Click any issue to filter relevant items</span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {healthData.reasons.map((reason) => {
                  const isErr = reason.type === 'ERROR';
                  const isWarn = reason.type === 'WARNING';
                  return (
                    <button
                      key={reason.id}
                      onClick={() => setActiveTab(reason.target_tab as TabType)}
                      className={`group flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        isErr
                          ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                          : isWarn
                          ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                          : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isErr
                            ? 'bg-rose-500/20 text-rose-600'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-600'
                            : 'bg-blue-500/20 text-blue-600'
                        }`}
                      >
                        {isErr ? (
                          <Ban className="h-4 w-4" />
                        ) : isWarn ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Info className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-nx-primary">{reason.title}</p>
                          <ChevronRight className="h-3.5 w-3.5 text-nx-muted group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="mt-1 text-[11px] text-nx-secondary line-clamp-2">{reason.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section 4: Detailed Drill-Down Tabs & Lists ─────────────── */}
          <div className="rounded-2xl border border-nx-border bg-nx-card shadow-xs overflow-hidden">
            {/* Tab navigation bar */}
            <div className="flex border-b border-nx-border bg-nx-elevated px-4 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'all'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('overdue')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'overdue'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Overdue Tasks</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/20">
                  {healthData.overdue_tasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('blocked')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'blocked'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Blocked & Dependencies</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/20">
                  {healthData.blocked_tasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('stalled')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'stalled'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Stalled Tasks</span>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                  {healthData.stalled_tasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'upcoming'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Upcoming Deadlines</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 border border-indigo-500/20">
                  {healthData.upcoming_tasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'unassigned'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Unassigned Work</span>
                <span className="rounded-full bg-nx-hover px-2 py-0.5 text-[10px] font-bold text-nx-secondary border border-nx-border">
                  {healthData.unassigned_tasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('workload')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'workload'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Team Workload</span>
                <span className="rounded-full bg-nx-hover px-2 py-0.5 text-[10px] font-bold text-nx-secondary border border-nx-border">
                  {healthData.workload.members.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('milestones')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'milestones'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-nx-muted hover:text-nx-primary'
                }`}
              >
                <span>Milestone Health</span>
                <span className="rounded-full bg-nx-hover px-2 py-0.5 text-[10px] font-bold text-nx-secondary border border-nx-border">
                  {healthData.milestones.length}
                </span>
              </button>
            </div>

            {/* Tab content body */}
            <div className="p-6">
              {/* ── TAB: OVERVIEW (ALL ATTENTION ITEMS) ────────────────── */}
              {activeTab === 'all' && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Left: Upcoming Deadlines mini list */}
                  <div className="rounded-xl border border-nx-border bg-nx-card p-5">
                    <div className="flex items-center justify-between border-b border-nx-border pb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-nx-primary uppercase tracking-wider">
                          Approaching Deadlines
                        </h4>
                      </div>
                      <button
                        onClick={() => setActiveTab('upcoming')}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        View All ({healthData.upcoming_tasks.length})
                      </button>
                    </div>

                    <div className="mt-3 divide-y divide-nx-border">
                      {healthData.upcoming_tasks.slice(0, 4).map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="flex items-center justify-between py-3 cursor-pointer hover:bg-nx-hover -mx-2 px-2 rounded-lg transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="text-xs font-bold text-nx-primary truncate">{task.title}</p>
                            <p className="text-[11px] text-nx-muted mt-0.5">
                              Assigned to: {task.assignee_name || 'Unassigned'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                              {task.days_left === 0 ? 'Due Today' : `In ${task.days_left}d`}
                            </span>
                          </div>
                        </div>
                      ))}
                      {healthData.upcoming_tasks.length === 0 && (
                        <p className="py-6 text-center text-xs text-nx-muted">
                          No tasks due in the next {upcomingDays} days.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Team Workload preview */}
                  <div className="rounded-xl border border-nx-border bg-nx-card p-5">
                    <div className="flex items-center justify-between border-b border-nx-border pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-nx-primary uppercase tracking-wider">
                          Team Workload Distribution
                        </h4>
                      </div>
                      <button
                        onClick={() => setActiveTab('workload')}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        View Details
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {healthData.workload.members.slice(0, 4).map((member) => (
                        <div key={member.user_id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-nx-primary">{member.full_name}</span>
                            <span className="text-[11px] text-nx-muted">
                              {member.active_tasks} active / {member.completed_tasks} done
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-nx-hover border border-nx-border">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (member.active_tasks / Math.max(1, healthData.workload.total_active_tasks)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      {healthData.workload.members.length === 0 && (
                        <p className="py-6 text-center text-xs text-nx-muted">No team members joined yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: OVERDUE TASKS ─────────────────────────────────── */}
              {activeTab === 'overdue' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-nx-muted">
                      Tasks past their deadline and not yet completed. Click any task to inspect or edit.
                    </p>
                  </div>

                  {healthData.overdue_tasks.length > 0 ? (
                    <div className="divide-y divide-nx-border border border-nx-border rounded-xl bg-nx-card overflow-hidden">
                      {healthData.overdue_tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-nx-hover cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              <h4 className="text-sm font-bold text-nx-primary truncate">{task.title}</h4>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                                  PRIORITY_BADGES[task.priority]?.bg || 'bg-nx-hover'
                                } ${PRIORITY_BADGES[task.priority]?.color || 'text-nx-secondary'} ${
                                  PRIORITY_BADGES[task.priority]?.border || 'border-nx-border'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nx-muted">
                              <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                              {task.milestone_title && <span>Milestone: {task.milestone_title}</span>}
                              <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-bold text-rose-600">
                              {task.days_overdue}d overdue
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTask(task);
                              }}
                              className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-1.5 text-xs font-semibold text-nx-primary hover:bg-nx-hover transition-colors"
                            >
                              Open Task
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center text-emerald-600">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-bold">No Overdue Tasks!</p>
                      <p className="text-xs opacity-90">All scheduled tasks are on or ahead of time.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: BLOCKED TASKS ─────────────────────────────────── */}
              {activeTab === 'blocked' && (
                <div className="space-y-3">
                  <p className="text-xs text-nx-muted">
                    Tasks explicitly marked as blocked or waiting on unresolved prerequisite tasks.
                  </p>

                  {healthData.blocked_tasks.length > 0 ? (
                    <div className="divide-y divide-nx-border border border-nx-border rounded-xl bg-nx-card overflow-hidden">
                      {healthData.blocked_tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="p-4 hover:bg-nx-hover cursor-pointer transition-colors space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Ban className="h-4 w-4 text-rose-500" />
                              <h4 className="text-sm font-bold text-nx-primary">{task.title}</h4>
                              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/20">
                                {task.is_explicit_blocked ? 'Status: BLOCKED' : 'Dependency Blocked'}
                              </span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTask(task);
                              }}
                              className="self-end sm:self-center rounded-lg border border-nx-border bg-nx-elevated px-3 py-1.5 text-xs font-semibold text-nx-primary hover:bg-nx-hover transition-colors"
                            >
                              Resolve Blocker
                            </button>
                          </div>

                          <div className="text-xs text-nx-muted">
                            <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                          </div>

                          {task.blocked_by && task.blocked_by.length > 0 && (
                            <div className="rounded-lg bg-nx-elevated p-2.5 text-xs border border-nx-border">
                              <p className="font-semibold text-nx-primary">Prerequisite Tasks:</p>
                              <div className="mt-1 space-y-1">
                                {task.blocked_by.map((dep) => (
                                  <div key={dep.id} className="flex items-center justify-between text-nx-secondary">
                                    <span className="truncate">• {dep.title}</span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        dep.is_completed ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                      }`}
                                    >
                                      {dep.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center text-emerald-600">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-bold">No Blocked Tasks</p>
                      <p className="text-xs opacity-90">There are no blocking dependency bottlenecks.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: STALLED TASKS ─────────────────────────────────── */}
              {activeTab === 'stalled' && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600">
                    <p className="font-semibold">Note on Activity Inactivity</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Flagged when an in-progress task has no recorded status updates or discussion replies in the platform for &gt;{stalledDays} days. This highlights tasks that may need follow-up.
                    </p>
                  </div>

                  {healthData.stalled_tasks.length > 0 ? (
                    <div className="divide-y divide-nx-border border border-nx-border rounded-xl bg-nx-card overflow-hidden">
                      {healthData.stalled_tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-nx-hover cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <PauseCircle className="h-4 w-4 text-amber-500" />
                              <h4 className="text-sm font-bold text-nx-primary truncate">{task.title}</h4>
                              <span className="rounded bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 text-[10px] font-bold border border-indigo-500/20">
                                {task.status}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nx-muted">
                              <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                              <span>
                                Last activity:{' '}
                                {task.last_activity_at
                                  ? new Date(task.last_activity_at).toLocaleDateString()
                                  : 'No activity recorded'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600">
                              No update for {task.days_inactive}d
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTask(task);
                              }}
                              className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-1.5 text-xs font-semibold text-nx-primary hover:bg-nx-hover transition-colors"
                            >
                              Follow Up
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center text-emerald-600">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-bold">No Stalled Tasks</p>
                      <p className="text-xs opacity-90">All active tasks have recent recorded progress.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: UPCOMING DEADLINES ────────────────────────────── */}
              {activeTab === 'upcoming' && (
                <div className="space-y-3">
                  <p className="text-xs text-nx-muted">
                    Tasks approaching deadlines within the next {upcomingDays} days, sorted by urgency and priority.
                  </p>

                  {healthData.upcoming_tasks.length > 0 ? (
                    <div className="divide-y divide-nx-border border border-nx-border rounded-xl bg-nx-card overflow-hidden">
                      {healthData.upcoming_tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-nx-hover cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-indigo-500" />
                              <h4 className="text-sm font-bold text-nx-primary truncate">{task.title}</h4>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                                  PRIORITY_BADGES[task.priority]?.bg || 'bg-nx-hover'
                                } ${PRIORITY_BADGES[task.priority]?.color || 'text-nx-secondary'} ${
                                  PRIORITY_BADGES[task.priority]?.border || 'border-nx-border'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nx-muted">
                              <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                              <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-600">
                              {task.days_left === 0 ? 'Due Today' : `Due in ${task.days_left} day${task.days_left === 1 ? '' : 's'}`}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTask(task);
                              }}
                              className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-1.5 text-xs font-semibold text-nx-primary hover:bg-nx-hover transition-colors"
                            >
                              Open Task
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-nx-border bg-nx-elevated p-8 text-center text-nx-secondary">
                      <Clock className="mx-auto h-8 w-8 text-nx-muted" />
                      <p className="mt-2 text-sm font-bold text-nx-primary">No Upcoming Deadlines</p>
                      <p className="text-xs text-nx-muted">There are no deadlines scheduled in the next {upcomingDays} days.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: UNASSIGNED WORK ───────────────────────────────── */}
              {activeTab === 'unassigned' && (
                <div className="space-y-3">
                  <p className="text-xs text-nx-muted">
                    Active tasks without an assigned team member. Click a task to assign it.
                  </p>

                  {healthData.unassigned_tasks.length > 0 ? (
                    <div className="divide-y divide-nx-border border border-nx-border rounded-xl bg-nx-card overflow-hidden">
                      {healthData.unassigned_tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-nx-hover cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <UserX className="h-4 w-4 text-nx-muted" />
                              <h4 className="text-sm font-bold text-nx-primary truncate">{task.title}</h4>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                                  PRIORITY_BADGES[task.priority]?.bg || 'bg-nx-hover'
                                } ${PRIORITY_BADGES[task.priority]?.color || 'text-nx-secondary'} ${
                                  PRIORITY_BADGES[task.priority]?.border || 'border-nx-border'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nx-muted">
                              <span>Status: {task.status}</span>
                              {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTask(task);
                            }}
                            className="self-end sm:self-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
                          >
                            Assign Task
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center text-emerald-600">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-bold">All Tasks Assigned</p>
                      <p className="text-xs opacity-90">Every active task has an assigned owner.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: TEAM WORKLOAD ─────────────────────────────────── */}
              {activeTab === 'workload' && (
                <div className="space-y-6">
                  {/* Workload summary banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-nx-border bg-nx-elevated p-4 text-xs">
                    <div>
                      <span className="font-bold text-nx-primary">Team Average: </span>
                      <span className="text-indigo-600 font-extrabold text-sm">
                        {healthData.workload.team_average_active_tasks}
                      </span>{' '}
                      <span className="text-nx-muted">active tasks per member</span>
                    </div>
                    <div className="text-nx-muted">
                      Total Active Work: <span className="font-bold text-nx-primary">{healthData.workload.total_active_tasks} tasks</span>
                    </div>
                  </div>

                  {/* Workload list */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {healthData.workload.members.map((member) => (
                      <div
                        key={member.user_id}
                        className={`rounded-xl border p-4 bg-nx-card transition-all ${
                          member.is_above_average ? 'border-amber-500/30 shadow-xs' : 'border-nx-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-nx-primary">{member.full_name}</h4>
                            <p className="text-xs text-nx-muted">Role: {member.project_role}</p>
                          </div>
                          {member.is_above_average && (
                            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                              Higher task count
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-nx-elevated p-2 border border-nx-border">
                            <p className="text-lg font-extrabold text-nx-primary">{member.active_tasks}</p>
                            <p className="text-[10px] font-semibold text-nx-muted uppercase">Active</p>
                          </div>
                          <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/20">
                            <p className="text-lg font-extrabold text-emerald-600">{member.completed_tasks}</p>
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase">Done</p>
                          </div>
                          <div className="rounded-lg bg-rose-500/10 p-2 border border-rose-500/20">
                            <p className="text-lg font-extrabold text-rose-600">{member.overdue_tasks}</p>
                            <p className="text-[10px] font-semibold text-rose-600 uppercase">Overdue</p>
                          </div>
                        </div>

                        {member.is_above_average && (
                          <p className="mt-3 text-[11px] text-amber-600">
                            Has {member.active_tasks} active tasks ({member.deviation_from_avg && member.deviation_from_avg > 0 ? `+${member.deviation_from_avg}` : ''} above team average of {healthData.workload.team_average_active_tasks}).
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB: MILESTONE HEALTH ──────────────────────────────── */}
              {activeTab === 'milestones' && (
                <div className="space-y-4">
                  <p className="text-xs text-nx-muted">
                    Status, task completion rates, and deadline tracking for project milestones.
                  </p>

                  {healthData.milestones.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {healthData.milestones.map((m) => {
                        const isDone = m.health_status === 'COMPLETED';
                        const isOverdue = m.health_status === 'OVERDUE';
                        const isAtRisk = m.health_status === 'AT_RISK';

                        return (
                          <div
                            key={m.id}
                            className={`rounded-xl border p-5 bg-nx-card transition-all ${
                              isOverdue
                                ? 'border-rose-500/30'
                                : isAtRisk
                                ? 'border-amber-500/30'
                                : isDone
                                ? 'border-emerald-500/30'
                                : 'border-nx-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Flag
                                    className={`h-4 w-4 ${
                                      isDone
                                        ? 'text-emerald-500'
                                        : isOverdue
                                        ? 'text-rose-500'
                                        : isAtRisk
                                        ? 'text-amber-500'
                                        : 'text-indigo-500'
                                    }`}
                                  />
                                  <h4 className="text-sm font-bold text-nx-primary">{m.title}</h4>
                                </div>
                                {m.description && <p className="mt-1 text-xs text-nx-muted line-clamp-2">{m.description}</p>}
                              </div>

                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                                  isDone
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                    : isOverdue
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                                    : isAtRisk
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                                    : 'bg-nx-elevated border-nx-border text-nx-secondary'
                                }`}
                              >
                                {m.health_status}
                              </span>
                            </div>

                            <div className="mt-4 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-nx-secondary">Progress</span>
                                <span className="text-nx-primary">{m.progress_percentage}%</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-nx-hover border border-nx-border">
                                <div
                                  className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-indigo-600'}`}
                                  style={{ width: `${m.progress_percentage}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-xs text-nx-muted border-t border-nx-border pt-3">
                              <span>
                                {m.completed_tasks} / {m.total_tasks} tasks done
                              </span>
                              {m.due_date && (
                                <span>Due: {new Date(m.due_date).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-nx-border bg-nx-elevated p-8 text-center text-nx-muted">
                      <Flag className="mx-auto h-8 w-8 text-nx-muted" />
                      <p className="mt-2 text-sm font-bold text-nx-primary">No Milestones Configured</p>
                      <p className="text-xs text-nx-muted">Milestones help track phase completion and high-level health.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-nx-border bg-nx-card p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
          <p className="mt-2 text-xs text-nx-muted">Loading project health evaluation...</p>
        </div>
      )}

      {/* ── Task Detail Modal ──────────────────────────────────────────── */}
      {selectedTaskForModal && (
        <TaskDetailModal task={selectedTaskForModal} onClose={handleCloseTaskModal} />
      )}

      {/* ── Create Task Modal (for empty states or direct addition) ────── */}
      {isCreateTaskModalOpen && (
        <CreateTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          defaultStatus="TODO"
        />
      )}
    </div>
  );
}
