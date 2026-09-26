/**
 * Centralized API & WebSocket Configuration for Nexora (Stage 4)
 * Uses secure HttpOnly cookie authentication and double-submit CSRF protection.
 */

export const API_BASE_URL: string = (() => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    // In production browser environments, default to current origin (reverse proxy)
    if (import.meta.env.PROD) {
      return window.location.origin;
    }
  }
  return 'http://localhost:8000';
})();

/**
 * Returns full API URL for a given endpoint path.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Dynamically constructs the WebSocket URL based on the API base URL.
 * Handles http -> ws and https -> wss transformation.
 */
export function getWebSocketUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL.replace(/\/$/, '')}${cleanPath}`;
  }
  if (API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL.replace(/^https:\/\//, 'wss://') + cleanPath;
  }
  if (API_BASE_URL.startsWith('http://')) {
    return API_BASE_URL.replace(/^http:\/\//, 'ws://') + cleanPath;
  }

  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return host ? `${protocol}//${host}${cleanPath}` : cleanPath;
}

/**
 * Reads a cookie value by name from document.cookie.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Standard authorization & CSRF headers for state-changing operations.
 * Authentication token is securely managed by the browser in an HttpOnly cookie.
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const csrfToken = getCookie('nexora_csrf');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

// Automatically ensure credentials: 'include' and CSRF header on client fetch
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const customInit: RequestInit = init ? { ...init } : {};
    if (!customInit.credentials) {
      customInit.credentials = 'include';
    }
    const method = (customInit.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = getCookie('nexora_csrf');
      if (csrf) {
        if (customInit.headers instanceof Headers) {
          if (!customInit.headers.has('X-CSRF-Token')) {
            customInit.headers.set('X-CSRF-Token', csrf);
          }
        } else if (Array.isArray(customInit.headers)) {
          const hasCsrf = customInit.headers.some(([k]) => k.toLowerCase() === 'x-csrf-token');
          if (!hasCsrf) {
            customInit.headers.push(['X-CSRF-Token', csrf]);
          }
        } else {
          customInit.headers = {
            'X-CSRF-Token': csrf,
            ...(customInit.headers || {}),
          };
        }
      }
    }
    return originalFetch(input, customInit);
  };
}
