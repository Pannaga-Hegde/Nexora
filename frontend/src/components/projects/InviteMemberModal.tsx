import React, { useState } from 'react';
import { UserPlus, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { getApiUrl, getAuthHeaders } from '../../config/api';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberInvited?: () => void;
}

export default function InviteMemberModal({ isOpen, onClose, onMemberInvited }: InviteMemberModalProps) {
  const activeProject = useProjectStore((state) => state.activeProject);
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !activeProject) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(getApiUrl(`/projects/${activeProject.id}/invite`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          email_or_username: identifier.trim(),
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send invite');
      }

      setStatusMessage({ type: 'success', text: data.message || 'Member invited successfully!' });
      setIdentifier('');
      if (onMemberInvited) onMemberInvited();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatusMessage({ type: 'error', text: err.message });
      } else {
        setStatusMessage({ type: 'error', text: 'An error occurred while sending the invite.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
      <div className="isolate w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-nx-border pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-nx-primary">Invite Team Member</h2>
              <p className="text-xs text-nx-muted">Project: {activeProject.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-nx-muted hover:bg-nx-hover hover:text-nx-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-md p-3 text-xs border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleInvite} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-nx-secondary">Username or Email Address</label>
            <input
              type="text"
              required
              placeholder="e.g., madhuri_g or external_colleague@university.edu"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-md border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary placeholder:text-nx-muted focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-nx-muted">
              Invite registered users by username or email, or send an email invitation to any external email address.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-nx-secondary">Project Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-nx-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-nx-secondary hover:bg-nx-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
            >
              {loading ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
