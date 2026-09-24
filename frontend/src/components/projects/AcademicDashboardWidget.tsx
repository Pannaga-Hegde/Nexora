import { useEffect, useState } from 'react';
import type React from 'react';
import {
  GraduationCap,
  Award,
  FlaskConical,
  Zap,
  Layers,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { Project } from '../../store/useProjectStore';
import { fetchProjectMilestonesAPI } from '../../services/projectApi';

interface AcademicDashboardWidgetProps {
  project: Project;
  totalTasks: number;
  completedTasks: number;
}

const TYPE_CONFIGS: Record<string, { label: string; icon: React.ElementType; text: string; badge: string; gradient: string; bar: string }> = {
  final_year: {
    label: 'Final Year Project',
    icon: GraduationCap,
    text: 'text-indigo-400',
    badge: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200',
    gradient: 'from-[#0B0F19] via-[#0F172A] to-[#1E1B4B]',
    bar: 'from-indigo-500 to-violet-500',
  },
  mini_project: {
    label: 'Mini Project',
    icon: Layers,
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 border-blue-500/30 text-blue-200',
    gradient: 'from-[#0B0F19] via-[#0F172A] to-[#172554]',
    bar: 'from-blue-500 to-sky-400',
  },
  hackathon: {
    label: 'Hackathon Sprint',
    icon: Award,
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 border-amber-500/30 text-amber-200',
    gradient: 'from-[#0B0F19] via-[#0F172A] to-[#2D1A04]',
    bar: 'from-amber-500 to-orange-400',
  },
  research: {
    label: 'Research Project',
    icon: FlaskConical,
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 border-purple-500/30 text-purple-200',
    gradient: 'from-[#0B0F19] via-[#0F172A] to-[#2E1065]',
    bar: 'from-purple-500 to-indigo-400',
  },
  software: {
    label: 'Software Engineering',
    icon: Zap,
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200',
    gradient: 'from-[#0B0F19] via-[#0F172A] to-[#064E3B]',
    bar: 'from-emerald-500 to-teal-400',
  },
  custom: {
    label: 'Custom Project',
    icon: Layers,
    text: 'text-slate-300',
    badge: 'bg-white/10 border-white/15 text-white/90',
    gradient: 'from-[#0B0F19] via-[#0F172A] to-[#1E1B4B]',
    bar: 'from-indigo-500 to-purple-500',
  },
};

export default function AcademicDashboardWidget({ project, totalTasks, completedTasks }: AcademicDashboardWidgetProps) {
  const [milestones, setMilestones] = useState<any[]>([]);

  useEffect(() => {
    if (project?.id) {
      fetchProjectMilestonesAPI(project.id)
        .then((data) => setMilestones(data))
        .catch(() => setMilestones([]));
    }
  }, [project?.id]);

  const pType = project.project_type || 'custom';
  const config = TYPE_CONFIGS[pType] || TYPE_CONFIGS.custom;
  const IconComp = config.icon;

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const completedMilestones = milestones.filter((m) => m.is_completed).length;

  return (
    <div className={`relative rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm bg-gradient-to-r ${config.gradient}`}>
      <div className="p-6 md:p-7 space-y-5">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border backdrop-blur-sm ${config.badge}`}>
                <IconComp className="h-3.5 w-3.5" />
                🎓 ACADEMIC MODE: {config.label.toUpperCase()}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{project.name}</h2>
            <p className="text-xs text-slate-400 line-clamp-2 max-w-lg">{project.description || 'Academic project workspace.'}</p>
          </div>

          {/* Overall Progress Gauge */}
          <div className="flex items-center gap-4 rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-white/10 min-w-[240px] shadow-xs">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
                <span>Overall Progress</span>
                <span className="text-xs font-bold text-white">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className={`h-full bg-gradient-to-r ${config.bar} transition-all duration-700 rounded-full`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 font-mono">
                <span>{completedTasks} done</span>
                <span>{totalTasks} total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Milestones Timeline Checklist */}
        {milestones.length > 0 && (
          <div className="rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className={`h-3.5 w-3.5 ${config.text}`} />
                Academic Milestones &amp; Deliverables ({completedMilestones}/{milestones.length})
              </span>
              <span className="text-[11px] text-slate-400">Target Timeline</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {milestones.slice(0, 4).map((m, idx) => (
                <div
                  key={m.id || idx}
                  className={`flex items-center gap-2.5 rounded-lg p-2.5 text-xs transition-colors ${
                    m.is_completed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/80 text-slate-200 border border-slate-800'
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    m.is_completed ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {m.is_completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate text-white">{m.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {m.due_date ? new Date(m.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No due date'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
