import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import { siteConfig } from '../config/siteConfig';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SEOHead
        title="Privacy Policy — How We Protect Your Data"
        description="Learn how Nexora collects, processes, and protects your project data, user activity logs, and account privacy."
      />

      <PublicNavbar />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-xs text-slate-400">
              Last Updated: {siteConfig.contact.lastUpdated}
            </p>
          </div>

          <div className="prose prose-invert prose-slate max-w-none text-xs leading-relaxed space-y-6 text-slate-300">
            <section>
              <h2 className="text-base font-bold text-white mb-2">1. Overview</h2>
              <p>
                This Privacy Policy explains how {siteConfig.name} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and safeguards information when you access our project management workspace and collaborative application.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">2. Information We Collect</h2>
              <p>We collect information necessary to provide and secure your collaborative workspace:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
                <li><strong>Account Data:</strong> Username, email address, and hashed authentication credentials.</li>
                <li><strong>Project & Task Data:</strong> Task titles, descriptions, due dates, milestones, comments, and member assignments.</li>
                <li><strong>Activity Logs:</strong> Timestamped records of project events (task completions, discussions, file attachments) used to generate verifiable contribution proofs.</li>
                <li><strong>Availability Schedules:</strong> User-configured weekly study/meeting blocks used for team scheduling.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">3. Cookies & Telemetry</h2>
              <p>
                We use strictly necessary cookies to maintain your authenticated login session. We may use privacy-respecting analytics to analyze anonymous page traffic and improve user experience, subject to your cookie preferences.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">4. Data Storage & Security</h2>
              <p>
                All data is stored in secured databases with encrypted network transmission (TLS/HTTPS). We do not sell, rent, or monetize your project data or student records to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">5. Your Rights</h2>
              <p>
                You may request access to, export of, or permanent deletion of your account and project records at any time by contacting our support team at <a href={`mailto:${siteConfig.contact.email}`} className="text-indigo-400 font-medium hover:underline">{siteConfig.contact.email}</a>.
              </p>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h2 className="text-sm font-bold text-white mb-1">6. Contact & Legal Inquiries</h2>
              <div className="text-slate-400 space-y-1">
                <p>Project: <span className="text-slate-200">{siteConfig.name}</span></p>
                <p>General Support: <a href={`mailto:${siteConfig.contact.email}`} className="text-indigo-400 hover:underline">{siteConfig.contact.email}</a></p>
                <p>Privacy & Data Requests: <a href={`mailto:${siteConfig.contact.legalEmail}`} className="text-indigo-400 hover:underline">{siteConfig.contact.legalEmail}</a></p>
                {siteConfig.contact.legalEntityName && (
                  <p>Legal Entity: <span className="text-slate-200">{siteConfig.contact.legalEntityName}</span></p>
                )}
                {siteConfig.contact.address && (
                  <p>Address: <span className="text-slate-200">{siteConfig.contact.address}</span></p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
