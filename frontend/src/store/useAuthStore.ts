import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  system_role: string;
  mfa_enabled?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token?: string) => void;
  logout: () => void;
}

const SAVED_USER = typeof localStorage !== 'undefined' ? localStorage.getItem('project_os_user') : null;

let initialUser: User | null = null;
if (SAVED_USER) {
  try {
    initialUser = JSON.parse(SAVED_USER);
  } catch {
    initialUser = null;
  }
}

// Clean up any legacy localStorage token
if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('project_os_token');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: null,
  isAuthenticated: !!initialUser,
  isLoading: false,

  setAuth: (user: User, _token?: string) => {
    // In Stage 4, authentication is strictly managed via secure HttpOnly cookies.
    // We no longer persist or expose raw access JWTs in browser localStorage.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('project_os_token');
      localStorage.setItem('project_os_user', JSON.stringify(user));
    }
    set({
      user,
      token: null,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('project_os_token');
      localStorage.removeItem('project_os_user');
    }
    // Asynchronously notify backend to clear HttpOnly auth & csrf cookies
    if (typeof window !== 'undefined') {
      fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));

