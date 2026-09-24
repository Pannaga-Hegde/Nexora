/**
 * Theme store — light-only stub.
 * Dark mode has been removed. This file is kept to avoid breaking any
 * imports that still reference useThemeStore or ThemeMode.
 */
import { create } from 'zustand';

export type ThemeMode = 'light';
export type ResolvedTheme = 'light';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initializeTheme: () => () => void;
}

// Ensure the document is always in light mode
if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
  document.documentElement.style.colorScheme = 'light';
  try {
    localStorage.removeItem('nexora-theme');
  } catch {
    // localStorage may be unavailable in some sandboxed environments
  }
}

export const useThemeStore = create<ThemeState>(() => ({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  initializeTheme: () => () => {},
}));
