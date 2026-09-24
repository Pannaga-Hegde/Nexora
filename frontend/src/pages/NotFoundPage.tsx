import { Link } from 'react-router-dom';
import { Home, LayoutDashboard } from 'lucide-react';
import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SEOHead
        title="404 — Page Not Found"
        description="The page you are looking for does not exist or has been moved."
      />

      <PublicNavbar />

      <main className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="w-full max-w-lg text-center rounded-2xl border border-slate-800 bg-slate-900/80 p-8 sm:p-12 shadow-2xl backdrop-blur-sm relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

          {/* Brand Emblem */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 shadow-inner">
            <img
              src="/icons/icon-192x192.png"
              alt="Nexora Symbol"
              className="h-10 w-10 rounded-xl"
            />
          </div>

          <span className="inline-block rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-indigo-400 border border-indigo-500/20">
            Error 404
          </span>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            This page went missing.
          </h1>

          <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-400 max-w-sm mx-auto">
            The page you're looking for doesn't exist or may have been moved.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 transition-all active:scale-95"
            >
              <Home className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Go to Dashboard</span>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
