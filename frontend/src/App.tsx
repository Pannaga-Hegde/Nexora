import { useState } from 'react';
import { Navigate, Route, BrowserRouter, Routes, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import HeaderNotificationCenter from './components/layout/HeaderNotificationCenter';
import GlobalSearchBar from './components/layout/GlobalSearchBar';
import { useAuthStore } from './store/useAuthStore';
import AuthPage from './pages/AuthPage';
import KanbanBoard from './components/tasks/KanbanBoard';
import ProjectsPage from './pages/ProjectsPage';
import DashboardPage from './pages/DashboardPage';
import ProjectChatPage from './pages/ProjectChatPage';
import RequestsInboxPage from './pages/RequestsInboxPage';
import CalendarViewPage from './pages/CalendarViewPage';
import CommunityPage from './pages/CommunityPage';
import SettingsPage from './pages/SettingsPage';
import ContributionPage from './pages/ContributionPage';
import ProjectHealthPage from './pages/ProjectHealthPage';

// Public Marketing, Legal & Utility Pages
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import ContactPage from './pages/ContactPage';
import ThankYouPage from './pages/ThankYouPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';
import CookieBanner from './components/common/CookieBanner';
import SEOHead from './components/common/SEOHead';

/**
 * Wraps every authenticated route. Redirects to /login when there's no
 * active session, otherwise renders the persistent Sidebar alongside
 * whichever page matched (via <Outlet />).
 */
function ProtectedLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className="flex h-screen text-nx-primary transition-colors"
      style={{
        backgroundColor: 'var(--app-bg)',
        backgroundImage: 'url(/image/nexora-workspace-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header
          className="relative z-30 flex h-16 items-center justify-between border-b border-nx-border px-4 sm:px-8 gap-3 sm:gap-4 transition-colors"
          style={{
            backgroundColor: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden rounded-lg p-1.5 text-nx-secondary hover:bg-nx-hover focus:outline-none"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <GlobalSearchBar />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <HeaderNotificationCenter />
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function TasksPage() {
  return (
    <div>
      <SEOHead
        title="My Tasks — Kanban Board"
        description="View and manage your tasks, progress stages, and deterministic risk indicators."
      />
      <h1 className="mb-6 text-2xl font-bold text-nx-primary">My Tasks</h1>
      <KanbanBoard />
    </div>
  );
}

export default function App() {

  return (
    <BrowserRouter>
      <CookieBanner />
      <Routes>
        {/* Public Marketing & Informational Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/404" element={<NotFoundPage />} />

        {/* Authentication */}
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />

        {/* Authenticated Workspace Application Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/health" element={<ProjectHealthPage />} />
          <Route path="/chat" element={<ProjectChatPage />} />
          <Route path="/requests" element={<RequestsInboxPage />} />
          <Route path="/calendar" element={<CalendarViewPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/contribution" element={<ContributionPage />} />
        </Route>

        {/* Catch-all 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}