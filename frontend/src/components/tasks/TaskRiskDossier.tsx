import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
  PauseCircle,
  UserX,
  Flag,
  Loader2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { fetchTaskRisk, type TaskRiskAssessment } from '../../services/riskApi';

interface TaskRiskDossierProps {
  taskId: string;
  projectId: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  CRITICAL: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-600',
    border: 'border-rose-500/30',
    iconBg: 'bg-rose-500/20 text-rose-500',
  },
  HIGH: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20 text-amber-500',
  },
  MEDIUM: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20 text-amber-500',
  },
  LOW: {
    bg: 'bg-nx-elevated',
    text: 'text-nx-primary',
    border: 'border-nx-border',
    iconBg: 'bg-nx-card text-nx-muted',
  },
};

export default function TaskRiskDossier({ taskId, projectId }: TaskRiskDossierProps) {
  const [assessment, setAssessment] = useState<TaskRiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !projectId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchTaskRisk(projectId, taskId)
      .then((data) => {
        if (isMounted) setAssessment(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Unable to assess risk');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [taskId, projectId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-nx-border bg-nx-elevated p-3 text-xs text-nx-muted">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        <span>Evaluating deterministic task risk...</span>
      </div>
    );
  }

  if (error || !assessment) {
    return null;
  }

  const getStatusBadge = () => {
    switch (assessment.status) {
      case 'ON_TRACK':
        return {
          label: assessment.is_completed ? 'Completed' : 'On Track',
          badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
          dotBg: 'bg-emerald-500',
          icon: CheckCircle2,
          containerBorder: 'border-emerald-500/30 bg-emerald-500/5',
        };
      case 'AT_RISK':
        return {
          label: 'At Risk',
          badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
          dotBg: 'bg-amber-500',
          icon: AlertTriangle,
          containerBorder: 'border-amber-500/30 bg-amber-500/5',
        };
      case 'BLOCKED':
        return {
          label: 'Blocked',
          badgeBg: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
          dotBg: 'bg-rose-500',
          icon: Ban,
          containerBorder: 'border-rose-500/30 bg-rose-500/5',
        };
    }
  };

  const badge = getStatusBadge();
  const Icon = badge.icon;

  return (
    <div className={`rounded-xl border p-4 transition-all ${badge.containerBorder}`}>
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-nx-muted" />
          <span className="text-xs font-bold uppercase tracking-wider text-nx-muted">
            Task Operational Health
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.badgeBg}`}
        >
          <span className={`h-2 w-2 rounded-full ${badge.dotBg}`} />
          <Icon className="h-3.5 w-3.5" />
          {badge.label}
        </span>
      </div>

      {/* Reasons Breakdown (Why?) */}
      {assessment.reasons.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-nx-muted">
            Why is attention required?
          </p>

          <div className="space-y-1.5">
            {assessment.reasons.map((reason, idx) => {
              const style = SEVERITY_STYLES[reason.severity] || SEVERITY_STYLES.LOW;
              return (
                <div
                  key={idx}
                  className={`flex flex-col gap-1 rounded-lg border p-2.5 text-xs ${style.bg} ${style.border} ${style.text}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${style.iconBg}`}>
                      {reason.code.includes('blocked') || reason.code.includes('dependency') ? (
                        <Ban className="h-3 w-3" />
                      ) : reason.code.includes('overdue') || reason.code.includes('deadline') ? (
                        <Clock className="h-3 w-3" />
                      ) : reason.code.includes('stale') ? (
                        <PauseCircle className="h-3 w-3" />
                      ) : reason.code.includes('unassigned') ? (
                        <UserX className="h-3 w-3" />
                      ) : reason.code.includes('milestone') ? (
                        <Flag className="h-3 w-3" />
                      ) : (
                        <Info className="h-3 w-3" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{reason.title}</p>
                      <p className="text-[11px] opacity-90">{reason.detail}</p>
                    </div>
                  </div>

                  {/* Dependency detail if available */}
                  {reason.meta?.blocked_by && Array.isArray(reason.meta.blocked_by) && (
                    <div className="mt-1 ml-7 rounded border border-rose-500/30 bg-nx-elevated p-2 text-[11px]">
                      <p className="font-semibold text-rose-600">Incomplete Prerequisites:</p>
                      <ul className="mt-1 list-disc list-inside space-y-0.5 text-rose-700">
                        {reason.meta.blocked_by.map((dep: any) => (
                          <li key={dep.id} className="truncate">
                            <span className="font-medium">{dep.title}</span> ({dep.status})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>
            {assessment.is_completed
              ? 'Task is completed with all requirements fulfilled.'
              : 'Task is on schedule with no active blockers, overdue deadlines, or stale activity.'}
          </span>
        </div>
      )}
    </div>
  );
}
