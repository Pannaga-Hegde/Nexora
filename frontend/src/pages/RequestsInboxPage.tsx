import { useState, useEffect } from 'react';
import { Inbox, CheckCircle2, XCircle } from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../config/api';
import SEOHead from '../components/common/SEOHead';

interface RequestItem {
  id: string;
  requester_name: string;
  request_type: string;
  status: string;
  title: string;
  details: string | null;
  created_at: string;
}

export default function RequestsInboxPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await fetch(getApiUrl('/workflow/requests'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch requests inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (id: string, action: 'ACCEPT' | 'REJECT') => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' } : r))
    );

    try {
      await fetch(getApiUrl(`/workflow/requests/${id}/respond`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ action }),
      });
    } catch (err) {
      console.error('Failed to respond to request:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <SEOHead
        title="Accountability & Requests Inbox"
        description="Review incoming team requests, unblock tasks, and respond to peer nudges."
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-nx-primary">Request Inbox</h1>
          <p className="mt-1 text-sm text-nx-muted">
            Accountability & workflow requests requiring your review and action.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 font-semibold border border-indigo-500/20">
          <Inbox className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-xs text-nx-muted">Loading inbox...</div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-nx-border bg-nx-card p-8 text-center text-xs text-nx-muted">
            Your request inbox is empty. No pending task assignments or invitations.
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between rounded-xl border border-nx-border bg-nx-card p-5 shadow-xs transition-all hover:border-nx-border-strong"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-nx-primary">{req.requester_name}</span>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-500/20">
                    {req.request_type.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-nx-primary">{req.title}</h3>
                {req.details && <p className="text-xs text-nx-secondary">{req.details}</p>}
                <p className="text-[10px] text-nx-muted">
                  Received {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {req.status === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRespond(req.id, 'REJECT')}
                      className="flex items-center gap-1 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespond(req.id, 'ACCEPT')}
                      className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accept
                    </button>
                  </>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${
                      req.status === 'ACCEPTED'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    }`}
                  >
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
