import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  UserPlus,
  TrendingUp,
  FolderPlus,
  GraduationCap,
  HeartPulse,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useTaskStore } from '../store/useTaskStore';
import { getApiUrl, getAuthHeaders } from '../config/api';
import InviteMemberModal from '../components/projects/InviteMemberModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import CreateProjectModal from '../components/projects/CreateProjectModal';
import ContributionReportButton from '../components/projects/ContributionReportButton';
import AcademicDashboardWidget from '../components/projects/AcademicDashboardWidget';
import MeetingScheduler from '../components/scheduling/MeetingScheduler';
import AvailabilityGrid from '../components/scheduling/AvailabilityGrid';
import SEOHead from '../components/common/SEOHead';

export default function DashboardPage() {
  const activeProject = useProjectStore((state) => state.activeProject);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const tasks = useTaskStore((state) => state.tasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProject?.id) {
      fetchTasks(activeProject.id);
    }
  }, [activeProject?.id]);

  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <SEOHead
        title="Project Dashboard"
        description="Overview of your active workspace projects, task progress, and team execution health."
      />
      {/* Create Project Quick Action Bar */}
      <div className="flex items-center justify-between rounded-xl bg-[#0B0F19] border border-slate-800 px-5 py-3 text-white shadow-xs">
        <div className="flex items-center gap-2.5">
          <GraduationCap className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-white">Academic Workspace Mode Active</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateProjectModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition-all"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          <span>New Academic Project</span>
        </button>
      </div>

      {/* Header Banner or Academic Widget */}
      {activeProject ? (
        <AcademicDashboardWidget
          project={activeProject}
          totalTasks={totalTasks}
          completedTasks={doneTasks}
        />
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0B0F19] via-[#0F172A] to-[#1E1B4B] p-6 text-white shadow-sm border border-slate-800">
          <div className="flex items-center gap-4">
            <img
              src="/icons/icon-192x192.png"
              alt="Nexora Symbol"
              className="h-12 w-12 rounded-xl shadow-md border border-slate-700"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to Nexora</h1>
              <p className="mt-0.5 text-sm text-slate-400">Turn Ideas Into Progress. Select or create an academic project to begin.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 shadow-md transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Academic Project
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <Link
          to="/health"
          className="flex items-center gap-1.5 rounded-lg border border-nx-border bg-nx-card px-3.5 py-2 text-xs font-semibold text-nx-primary hover:bg-nx-hover transition-all shadow-xs"
          title="View comprehensive project health & operational risk diagnostics"
        >
          <HeartPulse className="h-4 w-4 text-rose-500" />
          <span>Project Health</span>
        </Link>
        <ContributionReportButton />
        <button
          type="button"
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-nx-elevated px-4 py-2 text-xs font-medium text-nx-primary hover:bg-nx-hover transition-colors border border-nx-border"
        >
          <UserPlus className="h-4 w-4 text-nx-muted" />
          Invite Member
        </button>
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-nx-muted">Total Tasks</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <CheckSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-nx-primary">{totalTasks}</p>
          <p className="mt-1 text-xs text-nx-muted">Tasks in current project</p>
        </div>

        <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-nx-muted">In Progress</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-nx-primary">{inProgressTasks}</p>
          <p className="mt-1 text-xs text-nx-muted">Currently active execution</p>
        </div>

        <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-nx-muted">Blocked</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-nx-primary">{blockedTasks}</p>
          <p className="mt-1 text-xs text-nx-muted">Requires team attention</p>
        </div>

        <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-nx-muted">Completion Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-nx-primary">{completionRate}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-nx-hover overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Priority & Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks Column */}
        <div className="lg:col-span-2 rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-nx-primary">Recent Task Stream</h2>
            <NavLink
              to="/tasks"
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <span>View Kanban Board</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </NavLink>
          </div>

          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-xs text-nx-muted py-4">No tasks found in this project.</p>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-nx-border bg-nx-elevated p-3.5 transition-all hover:bg-nx-hover"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
                        task.status === 'DONE'
                          ? 'bg-emerald-500'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-500'
                          : task.status === 'BLOCKED'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-nx-primary">{task.title}</p>
                      <p className="text-xs text-nx-muted">Priority: {task.priority}</p>
                    </div>
                  </div>

                  <span className="rounded-full bg-nx-card px-2.5 py-1 text-xs font-medium text-nx-secondary border border-nx-border uppercase">
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workspace Quick Actions */}
        <div className="rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-nx-primary">Workspace Quick Actions</h2>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-nx-border p-3 text-left text-xs font-medium text-nx-primary hover:bg-nx-hover hover:border-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-indigo-500" />
                <span>Create New Task</span>
              </div>
              <Plus className="h-4 w-4 text-nx-muted" />
            </button>

            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-nx-border p-3 text-left text-xs font-medium text-nx-primary hover:bg-nx-hover hover:border-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-500" />
                <span>Invite Collaborator</span>
              </div>
              <Plus className="h-4 w-4 text-nx-muted" />
            </button>

            <NavLink
              to="/community"
              className="flex w-full items-center justify-between rounded-lg border border-nx-border p-3 text-left text-xs font-medium text-nx-primary hover:bg-nx-hover hover:border-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <span>Post Announcement</span>
              </div>
              <ArrowRight className="h-4 w-4 text-nx-muted" />
            </NavLink>
          </div>

          <div className="pt-4 border-t border-nx-border">
            <h3 className="text-xs font-semibold text-nx-primary uppercase tracking-wider mb-2">
              Academic Templates
            </h3>
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  if (!activeProject) return;
                  await fetch(getApiUrl(`/analytics/templates/${activeProject.id}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ template_type: 'CAPSTONE' }),
                  });
                  alert('Applied Final Year Capstone Milestones Template!');
                }}
                className="rounded-md bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
              >
                + Capstone Template
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activeProject) return;
                  await fetch(getApiUrl(`/analytics/templates/${activeProject.id}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ template_type: 'HACKATHON' }),
                  });
                  alert('Applied 48h Hackathon Sprint Template!');
                }}
                className="rounded-md bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700 border border-purple-200 hover:bg-purple-100"
              >
                + Hackathon Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Sync & Meeting Scheduling Engine */}
      <div className="space-y-6">
        <MeetingScheduler />
        <AvailabilityGrid />
      </div>


      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />

      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />
    </div>
  );
}
