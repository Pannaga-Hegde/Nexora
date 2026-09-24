import { getApiUrl, getAuthHeaders } from '../config/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContribMemberStats {
  tasks_assigned: number;
  tasks_completed: number;
  tasks_overdue: number;
  completed_tasks: { id: string; title: string; priority: string; milestone_id: string | null }[];
  comments: number;
  replies: number;
  milestones: number;
  milestones_list: { id: string; title: string; is_completed: boolean }[];
  files_uploaded: number;
  activity_count: number;
}

export interface ContribMember {
  user: {
    id: string;
    username: string;
    full_name: string;
    email: string;
    role: string;
    joined_at: string | null;
  };
  stats: ContribMemberStats;
}

export interface ProjectContributionsResponse {
  project_id: string;
  project_name: string;
  reporting_period: { start: string | null; end: string | null };
  disclaimer: string;
  members: ContribMember[];
}

export interface TimelineItem {
  id: string;
  activity_type: string;
  label: string;
  icon: string;
  content: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string | null;
  actor?: { id: string; username: string; full_name: string } | null;
  task: { id: string; title: string; status: string; milestone_id?: string | null } | null;
}

export interface TimelineResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: TimelineItem[];
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchProjectContributions(
  projectId: string,
  params: { start_date?: string; end_date?: string; milestone_id?: string } = {}
): Promise<ProjectContributionsResponse> {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  if (params.milestone_id) qs.set('milestone_id', params.milestone_id);

  const res = await fetch(
    getApiUrl(`/projects/${projectId}/contributions?${qs}`),
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error('Failed to fetch contributions');
  return res.json();
}

export async function fetchMemberContribution(
  projectId: string,
  memberId: string,
  params: { start_date?: string; end_date?: string } = {}
): Promise<any> {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);

  const res = await fetch(
    getApiUrl(`/projects/${projectId}/contributions/${memberId}?${qs}`),
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error('Failed to fetch member contribution');
  return res.json();
}

export async function fetchMemberTimeline(
  projectId: string,
  memberId: string,
  params: {
    page?: number;
    limit?: number;
    activity_type?: string;
    start_date?: string;
    end_date?: string;
  } = {}
): Promise<TimelineResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.activity_type) qs.set('activity_type', params.activity_type);
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);

  const res = await fetch(
    getApiUrl(`/projects/${projectId}/contributions/${memberId}/timeline?${qs}`),
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error('Failed to fetch member timeline');
  return res.json();
}

export async function fetchProjectTimeline(
  projectId: string,
  params: {
    page?: number;
    limit?: number;
    user_id?: string;
    activity_type?: string;
    milestone_id?: string;
    start_date?: string;
    end_date?: string;
  } = {}
): Promise<TimelineResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.user_id) qs.set('user_id', params.user_id);
  if (params.activity_type) qs.set('activity_type', params.activity_type);
  if (params.milestone_id) qs.set('milestone_id', params.milestone_id);
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);

  const res = await fetch(
    getApiUrl(`/projects/${projectId}/contributions/activity/project-timeline?${qs}`),
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error('Failed to fetch project timeline');
  return res.json();
}

export async function downloadContributionPDF(projectId: string, projectName: string): Promise<void> {
  const res = await fetch(getApiUrl(`/projects/${projectId}/reports/contribution`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('PDF generation failed');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Contribution_Report_${projectName.replace(/\s+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
