import React from 'react';
import { CheckSquare, MessageSquare, Flag, BarChart2, ArrowRight } from 'lucide-react';
import type { ContribMember } from '../../services/contributionApi';

interface Props {
  member: ContribMember;
  onViewDetail: (member: ContribMember) => void;
}

function getInitials(name: string): string {
  return name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(name: string): string {
  const colors = [
    'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30',
    'bg-violet-500/15 text-violet-600 border border-violet-500/30',
    'bg-sky-500/15 text-sky-600 border border-sky-500/30',
    'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
    'bg-fuchsia-500/15 text-fuchsia-600 border border-fuchsia-500/30',
    'bg-amber-500/15 text-amber-600 border border-amber-500/30',
  ];
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function Metric({ icon, label, value, subValue, color }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-nx-elevated border border-nx-border">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-nx-muted font-medium">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-nx-primary">{value}</span>
          {subValue && <span className="text-xs text-nx-muted">/ {subValue}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MemberContributionCard({ member, onViewDetail }: Props) {
  const { user, stats } = member;
  const initials = getInitials(user.full_name);
  const avatarCls = avatarColor(user.full_name);

  const completionPct = stats.tasks_assigned > 0
    ? Math.round((stats.tasks_completed / stats.tasks_assigned) * 100)
    : 0;

  return (
    <div className="bg-nx-card rounded-2xl border border-nx-border shadow-2xs hover:border-nx-border-strong transition-all duration-200 group overflow-hidden">
      {/* Progress bar strip at top */}
      <div className="h-1 bg-nx-elevated">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      <div className="p-5">
        {/* Member identity */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${avatarCls}`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-nx-primary text-sm truncate">{user.full_name}</p>
            <p className="text-xs text-nx-secondary truncate">{user.email}</p>
          </div>
          <span className="shrink-0 text-[10px] font-semibold bg-nx-elevated text-nx-secondary px-2 py-0.5 rounded-full border border-nx-border capitalize">
            {user.role}
          </span>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Metric
            icon={<CheckSquare className="h-4 w-4 text-emerald-500" />}
            label="Tasks"
            value={stats.tasks_completed}
            subValue={String(stats.tasks_assigned)}
            color="bg-emerald-500/10 text-emerald-500"
          />
          <Metric
            icon={<MessageSquare className="h-4 w-4 text-sky-500" />}
            label="Discussions"
            value={stats.comments + stats.replies}
            color="bg-sky-500/10 text-sky-500"
          />
          <Metric
            icon={<Flag className="h-4 w-4 text-fuchsia-500" />}
            label="Milestones"
            value={stats.milestones}
            color="bg-fuchsia-500/10 text-fuchsia-500"
          />
          <Metric
            icon={<BarChart2 className="h-4 w-4 text-indigo-500" />}
            label="Activity"
            value={stats.activity_count}
            color="bg-indigo-500/10 text-indigo-500"
          />
        </div>

        {/* Completion indicator */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-nx-muted font-medium">Task completion</span>
            <span className="text-[10px] font-semibold text-nx-primary">{completionPct}%</span>
          </div>
          <div className="h-1.5 bg-nx-elevated rounded-full overflow-hidden border border-nx-border">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* View detail */}
        <button
          onClick={() => onViewDetail(member)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-nx-primary bg-nx-elevated hover:bg-nx-hover border border-nx-border rounded-xl transition-colors"
        >
          View Activity Record
          <ArrowRight className="h-3.5 w-3.5 text-nx-muted" />
        </button>
      </div>
    </div>
  );
}
