import { getApiUrl, getAuthHeaders } from '../config/api';

export interface ProjectTemplateTask {
  title: string;
  description?: string;
  priority?: string;
  relative_week?: number;
}

export interface ProjectTemplatePhase {
  name: string;
  description?: string;
  relative_week?: number;
  tasks: ProjectTemplateTask[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: string;
  badge_icon: string;
  description: string;
  intended_use: string;
  phases_count: number;
  tasks_count: number;
  phases: ProjectTemplatePhase[];
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  status?: string;
  template_id?: string;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  initial_member_emails?: string[];
  custom_phases?: ProjectTemplatePhase[];
}

export async function fetchProjectTemplates(): Promise<ProjectTemplate[]> {
  const res = await fetch(getApiUrl('/projects/templates'), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch project templates');
  }
  return res.json();
}

export async function fetchMyProjectsAPI(): Promise<any[]> {
  const res = await fetch(getApiUrl('/projects'), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch projects');
  }
  return res.json();
}

export async function createProjectAPI(payload: ProjectCreatePayload): Promise<any> {
  const res = await fetch(getApiUrl('/projects'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create project from template');
  }
  return res.json();
}

export async function fetchProjectMilestonesAPI(projectId: string): Promise<any[]> {
  const res = await fetch(getApiUrl(`/analytics/milestones/${projectId}`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function leaveProjectAPI(projectId: string): Promise<any> {
  const res = await fetch(getApiUrl(`/projects/${projectId}/leave`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to leave project');
  }
  return res.json();
}

export interface ProjectMember {
  id: string;
  username: string;
  email: string;
  full_name: string;
  project_role: string;
  joined_at?: string | null;
}

export async function fetchProjectMembersAPI(projectId: string): Promise<ProjectMember[]> {
  const res = await fetch(getApiUrl(`/projects/${projectId}/members`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch project members');
  }
  return res.json();
}


