import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import { siteConfig } from '../config/siteConfig';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SEOHead
        title="Terms & Conditions — Terms of Service"
        description="Read the terms and conditions governing the use of Nexora project workspace and collaboration services."
      />

      <PublicNavbar />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              Terms & Conditions
            </h1>
            <p className="mt-2 text-xs text-slate-400">
              Last Updated: {siteConfig.contact.lastUpdated}
            </p>
          </div>

          <div className="prose prose-invert prose-slate max-w-none text-xs leading-relaxed space-y-6 text-slate-300">
            <section>
              <h2 className="text-base font-bold text-white mb-2">1. Acceptance of Terms</h2>
              <p>
                By registering for, accessing, or utilizing the Nexora platform (&quot;Service&quot;), you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">2. User Accounts & Security</h2>
              <p>
                You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">3. User Content & Ownership</h2>
              <p>
                You retain all intellectual property rights and ownership of the project descriptions, code repositories, task documentation, and discussions uploaded to Nexora. We do not claim ownership of your academic or commercial intellectual property.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">4. Acceptable Use Policy</h2>
              <p>
                You agree not to misuse the platform, including but not limited to transmitting malicious code, attempting unauthorized system access, or harassing team collaborators.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-2">5. Service Availability & Disclaimers</h2>
              <p>
                The Service is provided &quot;as is&quot; and &quot;as available&quot;. While we strive for high uptime and system reliability, we do not guarantee uninterrupted operation or that the service will be error-free.
              </p>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h2 className="text-sm font-bold text-white mb-1">6. Legal Inquiries & Jurisdiction</h2>
              <div className="text-slate-400 space-y-1">
                <p>Project: <span className="text-slate-200">{siteConfig.name}</span></p>
                <p>Legal & Terms Contact: <a href={`mailto:${siteConfig.contact.legalEmail}`} className="text-indigo-400 hover:underline">{siteConfig.contact.legalEmail}</a></p>
                <p>Governing Jurisdiction: <span className="text-slate-300">{siteConfig.contact.jurisdictionPlaceholder}</span></p>
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
