import React from 'react';
import { CheckSquare, MessageSquare, RotateCcw, Plus, User, Flag, Paperclip, Edit, RefreshCw } from 'lucide-react';
import type { TimelineItem } from '../../services/contributionApi';

interface Props {
  items: TimelineItem[];
  loading?: boolean;
  showActor?: boolean;
}

function groupByDate(items: TimelineItem[]) {
  const groups: Record<string, TimelineItem[]> = {};
  for (const item of items) {
    const date = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unknown';
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  }
  return groups;
}

function ActivityIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4';
  const icons: Record<string, React.ReactNode> = {
    TASK_COMPLETED: <CheckSquare className={cls} />,
    TASK_CREATED: <Plus className={cls} />,
    TASK_REOPENED: <RotateCcw className={cls} />,
    TASK_ASSIGNED: <User className={cls} />,
    COMMENT_CREATED: <MessageSquare className={cls} />,
    REPLY_CREATED: <MessageSquare className={cls} />,
    STATUS_CHANGE: <Edit className={cls} />,
    MILESTONE_COMPLETED: <Flag className={cls} />,
    FILE_UPLOADED: <Paperclip className={cls} />,
    COMMENT: <MessageSquare className={cls} />,
    ASSIGNMENT: <User className={cls} />,
    ATTACHMENT_ADDED: <Paperclip className={cls} />,
  };
  return <>{icons[type] ?? <RefreshCw className={cls} />}</>;
}

function dotColor(type: string): string {
  const map: Record<string, string> = {
    TASK_COMPLETED: 'bg-emerald-500',
    TASK_CREATED: 'bg-indigo-500',
    TASK_REOPENED: 'bg-amber-500',
    TASK_ASSIGNED: 'bg-violet-500',
    COMMENT_CREATED: 'bg-sky-500',
    REPLY_CREATED: 'bg-sky-400',
    STATUS_CHANGE: 'bg-slate-400',
    MILESTONE_COMPLETED: 'bg-fuchsia-500',
    FILE_UPLOADED: 'bg-teal-500',
    COMMENT: 'bg-sky-500',
    ASSIGNMENT: 'bg-violet-500',
    ATTACHMENT_ADDED: 'bg-teal-500',
  };
  return map[type] ?? 'bg-slate-400';
}

function timeStr(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function ContributionTimeline({ items, loading, showActor }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-nx-elevated shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-nx-elevated rounded w-48" />
              <div className="h-3 bg-nx-elevated rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-10 text-center">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-nx-muted text-sm">No activity recorded for this period.</p>
      </div>
    );
  }

  const groups = groupByDate(items);

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([date, dayItems]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-nx-muted uppercase tracking-wide">{date}</span>
            <div className="flex-1 h-px bg-nx-border" />
          </div>

          <div className="space-y-2">
            {dayItems.map(item => {
              const atype = item.activity_type;
              const dot = dotColor(atype);
              const t = timeStr(item.created_at);
              const detail = item.content || item.task?.title || '';
              const actor = item.actor;

              return (
                <div key={item.id} className="flex gap-3 group">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <div className={`w-7 h-7 rounded-full ${dot} flex items-center justify-center text-white shadow-2xs`}>
                      <ActivityIcon type={atype} />
                    </div>
                    <div className="w-px flex-1 bg-nx-border mt-1" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      {showActor && actor && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[9px] font-bold flex items-center justify-center">
                            {getInitials(actor.full_name)}
                          </div>
                          <span className="text-xs font-semibold text-nx-primary">{actor.full_name}</span>
                        </div>
                      )}
                      <span className={`text-xs font-medium ${showActor && actor ? 'text-nx-muted' : 'text-nx-primary'}`}>
                        {item.label}
                      </span>
                    </div>

                    {detail && (
                      <p className="text-xs text-nx-secondary mt-0.5 leading-relaxed line-clamp-2">
                        {item.task ? (
                          <span className="font-medium text-nx-primary">"{detail}"</span>
                        ) : detail}
                      </p>
                    )}

                    {t && <span className="text-[10px] text-nx-muted mt-0.5 block">{t}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
