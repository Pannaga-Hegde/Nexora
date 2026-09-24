/**
 * Project Health API Client
 */
import { getApiUrl, getAuthHeaders } from '../config/api';

export interface HealthTaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  milestone_id?: string | null;
  milestone_title?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  days_overdue?: number;
  days_inactive?: number;
  last_activity_at?: string | null;
  days_left?: number;
  hours_left?: number;
  is_explicit_blocked?: boolean;
  blocked_by?: {
    id: string;
    title: string;
    status: string;
    is_completed: boolean;
  }[];
}

export interface HealthReason {
  id: string;
  type: 'ERROR' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  count: number;
  target_tab: string;
}

export interface WorkloadMember {
  user_id: string;
  username: string;
  full_name: string;
  project_role: string;
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  is_above_average?: boolean;
  deviation_from_avg?: number;
}

export interface MilestoneHealthItem {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  is_completed: boolean;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  progress_percentage: number;
  health_status: 'HEALTHY' | 'AT_RISK' | 'OVERDUE' | 'COMPLETED' | 'NO_TASKS';
}

export interface ProjectHealthResponse {
  project_id: string;
  project_name: string;
  project_status: string;
  project_type: string;
  overall_health: {
    status: 'HEALTHY' | 'NEEDS_ATTENTION' | 'AT_RISK' | 'NO_DATA';
    label: string;
    description: string;
    task_completion_percentage: number;
    total_tasks: number;
    completed_tasks: number;
    active_tasks: number;
    is_empty: boolean;
  };
  breakdown: {
    on_track: number;
    at_risk: number;
    overdue: number;
    blocked: number;
    not_started: number;
    done: number;
  };
  reasons: HealthReason[];
  overdue_tasks: HealthTaskItem[];
  blocked_tasks: HealthTaskItem[];
  stalled_tasks: HealthTaskItem[];
  upcoming_tasks: HealthTaskItem[];
  unassigned_tasks: HealthTaskItem[];
  workload: {
    team_average_active_tasks: number;
    total_active_tasks: number;
    members: WorkloadMember[];
  };
  milestones: MilestoneHealthItem[];
  config: {
    stalled_days_threshold: number;
    upcoming_days_threshold: number;
  };
}

export async function fetchProjectHealth(
  projectId: string,
  params: { stalled_days?: number; upcoming_days?: number } = {}
): Promise<ProjectHealthResponse> {
  const qs = new URLSearchParams();
  if (params.stalled_days) qs.set('stalled_days', String(params.stalled_days));
  if (params.upcoming_days) qs.set('upcoming_days', String(params.upcoming_days));

  const res = await fetch(getApiUrl(`/projects/${projectId}/health?${qs}`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch project health data');
  }

  return res.json();
}
