import { Link } from 'react-router-dom';
import { CheckCircle2, Home, LayoutDashboard } from 'lucide-react';
import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SEOHead
        title="Thank You — Message Received"
        description="Thank you for reaching out to Nexora. We have received your submission."
      />

      <PublicNavbar />

      <main className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="w-full max-w-md text-center rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-6 shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">
            Thank you!
          </h1>
          
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Your message has been received. Our team will review your inquiry and get back to you shortly.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-all"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Link>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Go to Dashboard</span>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
