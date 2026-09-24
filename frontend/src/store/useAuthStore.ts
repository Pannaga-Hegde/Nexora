import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  system_role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

const SAVED_TOKEN = localStorage.getItem('project_os_token');
const SAVED_USER = localStorage.getItem('project_os_user');

let initialUser: User | null = null;
if (SAVED_USER) {
  try {
    initialUser = JSON.parse(SAVED_USER);
  } catch {
    initialUser = null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: SAVED_TOKEN,
  isAuthenticated: !!(SAVED_TOKEN && initialUser),

  setAuth: (user: User, token: string) => {
    localStorage.setItem('project_os_token', token);
    localStorage.setItem('project_os_user', JSON.stringify(user));
    set({
      user,
      token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('project_os_token');
    localStorage.removeItem('project_os_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
}));

