/**
 * Centralized API & WebSocket Configuration for Nexora
 * Uses environment variable VITE_API_URL with safe development fallback.
 */

// Centralized API Base URL
// In development: defaults to http://localhost:8000
// In production: reads VITE_API_URL set during build/deployment
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/$/, '');

/**
 * Returns full API URL for a given endpoint path.
 * @param path Endpoint path (e.g. '/projects' or 'projects')
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Dynamically constructs the WebSocket URL based on the API base URL.
 * Handles http -> ws and https -> wss transformation.
 * @param path WebSocket endpoint path (e.g. '/ws/projects/123')
 */
export function getWebSocketUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL.replace(/^https:\/\//, 'wss://') + cleanPath;
  }
  if (API_BASE_URL.startsWith('http://')) {
    return API_BASE_URL.replace(/^http:\/\//, 'ws://') + cleanPath;
  }

  // Protocol-relative or relative fallback
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return host ? `${protocol}//${host}${cleanPath}` : cleanPath;
}

/**
 * Standard authorization headers retrieved from localStorage.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('project_os_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
