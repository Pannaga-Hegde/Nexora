import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MessageSquare, Send, AlertCircle, Loader2 } from 'lucide-react';
import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import { siteConfig } from '../config/siteConfig';
import { trackFormSubmit } from '../services/analytics';

export default function ContactPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!subject.trim()) {
      errs.subject = 'Subject is required.';
    }

    if (!message.trim()) {
      errs.message = 'Message is required.';
    } else if (message.trim().length < 20) {
      errs.message = 'Message must be at least 20 characters long.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Track submission
      trackFormSubmit('Contact Form');

      // Emulate/Send to backend endpoint if available or resolve gracefully
      await new Promise((resolve) => setTimeout(resolve, 800));

      navigate('/thank-you');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setServerError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SEOHead
        title="Contact Us — Get in Touch with Nexora"
        description="Have questions about Nexora academic workspaces, team onboarding, or enterprise course tiers? Reach out to our team."
      />

      <PublicNavbar />

      <main className="flex-1 py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              Get in touch
            </h1>
            <p className="mt-3 text-sm text-slate-400">
              We would love to hear from you. Send us a message and our team will get back to you shortly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Contact Info Sidebar */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Direct Channels</h3>
              
              <div className="flex items-start gap-3 text-xs">
                <Mail className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200">Email Support</p>
                  <p className="text-slate-400 mt-0.5">{siteConfig.contact.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <MessageSquare className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200">Academic Inquiries</p>
                  <p className="text-slate-400 mt-0.5">{siteConfig.contact.supportEmail}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                Campus departments & professors can request guided workshops and automated grading integration.
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl">
              {serverError && (
                <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="fullName" className="block text-xs font-semibold text-slate-300">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors({ ...errors, fullName: '' });
                    }}
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                    className={`mt-1 w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
                      errors.fullName ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="e.g. Alex Morgan"
                  />
                  {errors.fullName && (
                    <p id="fullName-error" className="mt-1 text-[11px] font-medium text-red-400">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-300">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={`mt-1 w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
                      errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="alex@university.edu"
                  />
                  {errors.email && (
                    <p id="email-error" className="mt-1 text-[11px] font-medium text-red-400">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-xs font-semibold text-slate-300">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      if (errors.subject) setErrors({ ...errors, subject: '' });
                    }}
                    aria-invalid={Boolean(errors.subject)}
                    aria-describedby={errors.subject ? 'subject-error' : undefined}
                    className={`mt-1 w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
                      errors.subject ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="e.g. Question about Capstone Template"
                  />
                  {errors.subject && (
                    <p id="subject-error" className="mt-1 text-[11px] font-medium text-red-400">
                      {errors.subject}
                    </p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-xs font-semibold text-slate-300">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (errors.message) setErrors({ ...errors, message: '' });
                    }}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    className={`mt-1 w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
                      errors.message ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="Write your message here (min. 20 characters)..."
                  />
                  {errors.message && (
                    <p id="message-error" className="mt-1 text-[11px] font-medium text-red-400">
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending message...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <Send className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
