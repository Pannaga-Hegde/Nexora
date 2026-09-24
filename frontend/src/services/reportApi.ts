import { getApiUrl, getAuthHeaders } from '../config/api';

/**
 * Fetches the Gradesaver Contribution Report PDF from FastAPI backend
 * and triggers a programmatic browser download.
 */
export async function downloadContributionReport(projectId: string, projectName: string): Promise<void> {
  const response = await fetch(getApiUrl(`/projects/${projectId}/reports/contribution`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to generate contribution report PDF.');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `Gradesaver_Contribution_Report_${sanitizedName}.pdf`);
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Emails the Gradesaver Contribution Report PDF to any target recipient email address
 * (including professors, TAs, or external non-registered stakeholders).
 */
export async function emailContributionReport(
  projectId: string,
  recipientEmail: string,
  note?: string
): Promise<{ message: string; recipient: string }> {
  const response = await fetch(getApiUrl(`/projects/${projectId}/reports/email`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      recipient_email: recipientEmail,
      note: note || undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to send contribution report email.');
  }

  return data;
}
