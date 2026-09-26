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
 * (Note: May return null in cross-origin environments)
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Standard authorization headers helper.
 * CSRF token injection is now handled automatically and asynchronously 
 * by the global fetch interceptor below to support cross-origin setups.
 */
export function getAuthHeaders(): Record<string, string> {
  return {};
}

// Automatically ensure credentials: 'include' and CSRF header on client fetch
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  
  let cachedCsrfToken: string | null = null;
  let csrfFetchPromise: Promise<string | null> | null = null;

  const fetchCsrfToken = async (): Promise<string | null> => {
    if (cachedCsrfToken) return cachedCsrfToken;
    if (csrfFetchPromise) return csrfFetchPromise;

    csrfFetchPromise = (async () => {
      try {
        const url = getApiUrl('/auth/csrf-token');
        const response = await originalFetch(url, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          cachedCsrfToken = data.csrf_token || null;
        } else {
          cachedCsrfToken = null;
        }
      } catch (e) {
        cachedCsrfToken = null;
      } finally {
        csrfFetchPromise = null;
      }
      return cachedCsrfToken;
    })();

    return csrfFetchPromise;
  };

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const customInit: RequestInit = init ? { ...init } : {};
    if (!customInit.credentials) {
      customInit.credentials = 'include';
    }
    
    let method = 'GET';
    if (customInit.method) {
      method = customInit.method.toUpperCase();
    } else if (input instanceof Request) {
      method = input.method.toUpperCase();
    }
    
    // Prevent infinite loop if fetching the token itself
    const urlString = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    const isCsrfEndpoint = urlString.includes('/auth/csrf-token');

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isCsrfEndpoint) {
      const csrf = await fetchCsrfToken();
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
    
    const response = await originalFetch(input, customInit);
    
    // Invalidate CSRF cache on auth state changes or on 403 (to recover from invalid tokens)
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && 
      (urlString.includes('/auth/login') || urlString.includes('/auth/register') || urlString.includes('/auth/logout'))
    ) {
      cachedCsrfToken = null;
    } else if (response.status === 403 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      cachedCsrfToken = null;
    }
    
    return response;
  };
}
