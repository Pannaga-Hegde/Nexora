import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  MessageSquare,
  Inbox,
  Calendar,
  Users,
  Settings,
  LogOut,
  BarChart2,
  HeartPulse,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/health', label: 'Project Health', icon: HeartPulse },
  { to: '/chat', label: 'Project Chat', icon: MessageSquare },
  { to: '/requests', label: 'Requests Inbox', icon: Inbox },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/community', label: 'Community Feed', icon: Users },
  { to: '/contribution', label: 'Contribution', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function getInitials(fullName: string) {
  const parts = fullName.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        style={{
          backgroundColor: 'rgba(242,242,240,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-nx-border transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Nexora Brand Logo */}
        <div className="flex h-16 items-center justify-between border-b border-nx-border px-5">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192x192.png"
              alt="Nexora Symbol"
              className="h-9 w-9 rounded-lg shadow-sm object-cover"
            />
            <div className="flex flex-col">
              <span className="text-[16px] font-bold tracking-tight text-nx-primary leading-tight">
                Nexora
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 tracking-wider uppercase">
                Workspace OS
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-nx-muted hover:bg-nx-hover hover:text-nx-primary md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-nx-secondary hover:bg-nx-hover hover:text-nx-primary',
              ].join(' ')
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User profile badge */}
      <div className="border-t border-nx-border p-3">
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {getInitials(user.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-nx-primary">
                  {user.full_name}
                </p>
                <p className="truncate text-xs text-nx-muted">
                  {user.system_role}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out"
              className="rounded-lg p-1.5 text-nx-muted hover:bg-nx-hover hover:text-red-500 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="px-2 py-2 text-sm text-nx-muted">Not signed in</div>
        )}
      </div>
    </aside>
    </>
  );
}
