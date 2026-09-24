import React, { useState } from 'react';
import { FileText, Loader2, Download, Mail, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { downloadContributionReport, emailContributionReport } from '../../services/reportApi';

export default function ContributionReportButton() {
  const activeProject = useProjectStore((state) => state.activeProject);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  
  const [recipientEmail, setRecipientEmail] = useState('');
  const [note, setNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!activeProject) return null;

  const handleDownload = async () => {
    setLoadingDownload(true);
    try {
      await downloadContributionReport(activeProject.id, activeProject.name);
    } catch (err) {
      console.error(err);
      alert('Failed to generate report. Please ensure tasks and members exist in this project.');
    } finally {
      setLoadingDownload(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    setSendingEmail(true);
    setStatusMessage(null);
    try {
      const res = await emailContributionReport(activeProject.id, recipientEmail.trim(), note.trim());
      setStatusMessage({ type: 'success', text: res.message || 'Report sent successfully!' });
      setRecipientEmail('');
      setNote('');
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setStatusMessage(null);
      }, 2500);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send email. Check recipient address.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={loadingDownload}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-all border border-emerald-500"
          title="Download clean academic contribution PDF report"
        >
          {loadingDownload ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 text-white" />
              <span>Export Contribution PDF</span>
              <Download className="h-3.5 w-3.5 text-emerald-200" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsEmailModalOpen(true);
            setStatusMessage(null);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-nx-elevated px-3 py-2 text-xs font-semibold text-emerald-500 hover:bg-nx-hover transition-all border border-nx-border shadow-2xs"
          title="Email PDF report directly to any professor, evaluator, or external email recipient"
        >
          <Mail className="h-3.5 w-3.5 text-emerald-500" />
          <span>Email to Evaluator</span>
        </button>
      </div>

      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="isolate w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 text-gray-900"
            style={{ backgroundColor: '#ffffff' }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Email Gradesaver Report</h3>
                  <p className="text-xs text-gray-500">Send PDF to any recipient (including non-users)</p>
                </div>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {statusMessage && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs border ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSendEmail} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Recipient Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g., professor@university.edu or client@external.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  style={{ backgroundColor: '#ffffff' }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Works for any email address, even if they are not registered on Nexora.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Optional Cover Note</label>
                <textarea
                  rows={3}
                  placeholder="e.g., Dear Professor Smith, here is our final sprint team contribution PDF for evaluation."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ backgroundColor: '#ffffff' }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 text-white" />
                      <span>Send PDF Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
