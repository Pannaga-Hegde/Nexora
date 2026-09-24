import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { getConsentStatus, setConsentStatus } from '../../services/analytics';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(() => {
    return getConsentStatus() === 'undecided';
  });

  const handleAcceptAll = () => {
    setConsentStatus('accepted');
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    setConsentStatus('essential_only');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed text-slate-300">
            <p className="font-semibold text-white">We value your privacy</p>
            <p className="mt-0.5">
              Nexora uses essential cookies to authenticate your workspace and optional analytics to improve features. Read our{' '}
              <Link to="/privacy" className="text-indigo-400 underline hover:text-indigo-300">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleEssentialOnly}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
