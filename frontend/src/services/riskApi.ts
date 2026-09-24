/**
 * Task Risk Detection API Client
 */
import { getApiUrl, getAuthHeaders } from '../config/api';

export type RiskStatusCode = 'ON_TRACK' | 'AT_RISK' | 'BLOCKED';

export interface RiskReason {
  code: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  meta?: Record<string, any>;
}

export interface TaskRiskAssessment {
  status: RiskStatusCode;
  label: string;
  is_completed: boolean;
  reasons: RiskReason[];
  primary_reason?: string | null;
}

export interface TaskRiskResponse {
  task_id: string;
  task_title: string;
  due_date: string | null;
  assignee_id: string | null;
  status: string;
  risk: TaskRiskAssessment;
}

export async function fetchTaskRisk(
  projectId: string,
  taskId: string
): Promise<TaskRiskAssessment> {
  const res = await fetch(getApiUrl(`/projects/${projectId}/tasks/${taskId}/risk`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch task risk assessment');
  }

  const data: TaskRiskResponse = await res.json();
  return data.risk;
}

export async function fetchBatchTaskRisks(
  projectId: string
): Promise<Record<string, TaskRiskAssessment>> {
  const res = await fetch(getApiUrl(`/projects/${projectId}/tasks/risks/batch`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch task risks batch');
  }

  return res.json();
}
