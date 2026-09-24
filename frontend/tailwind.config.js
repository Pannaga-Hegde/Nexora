/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nx: {
          app: 'var(--app-bg)',
          workspace: 'var(--workspace-bg)',
          sidebar: 'var(--sidebar-bg)',
          header: 'var(--header-bg)',
          card: 'var(--card-bg)',
          elevated: 'var(--surface-elevated)',
          hover: 'var(--hover-bg)',
          border: 'var(--border)',
          'border-strong': 'var(--border-strong)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'var(--primary)',
          'accent-fg': 'var(--primary-foreground)',
        },
      },
    },
  },
  plugins: [],
}