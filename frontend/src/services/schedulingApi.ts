import { getApiUrl, getAuthHeaders } from '../config/api';

export interface AvailabilityBlock {
  id?: string;
  user_id?: string;
  day_of_week: number; // 0 = Monday, 6 = Sunday
  start_time: string;  // "09:00"
  end_time: string;    // "10:30"
  is_recurring: boolean;
}

export interface MeetingSuggestion {
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  formatted_timeslot: string;
  free_member_count: number;
  total_member_count: number;
  free_members: string[];
  score: number;
}

export async function fetchMyAvailability(): Promise<AvailabilityBlock[]> {
  const res = await fetch(getApiUrl('/scheduling/users/me/availability'), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch availability schedule');
  }
  return res.json();
}

export async function updateMyAvailability(blocks: AvailabilityBlock[]): Promise<AvailabilityBlock[]> {
  const res = await fetch(getApiUrl('/scheduling/users/me/availability'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update availability schedule');
  }
  return res.json();
}

export async function fetchProjectMeetingSuggestions(projectId: string): Promise<MeetingSuggestion[]> {
  const res = await fetch(getApiUrl(`/scheduling/projects/${projectId}/suggestions`), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch meeting suggestions');
  }
  return res.json();
}
