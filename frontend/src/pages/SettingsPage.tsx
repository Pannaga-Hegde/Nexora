import { useState, useEffect } from 'react';
import {
  User,
  Users,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Shield,
  KeyRound,
  LogOut,
  FolderGit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';
import { getApiUrl, getAuthHeaders } from '../config/api';
import InviteMemberModal from '../components/projects/InviteMemberModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import SEOHead from '../components/common/SEOHead';
import { useNavigate } from 'react-router-dom';

interface ProjectMemberItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  project_role: string;
}

export default function SettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const { activeProject, projects, loadProjects, setActiveProject, leaveProject } = useProjectStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'members' | 'danger'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Security Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Project Members State
  const [members, setMembers] = useState<ProjectMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Leave Project State
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveStatus, setLeaveStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Delete Account State
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deleteAccountStatus, setDeleteAccountStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!activeProject) {
      if (projects.length === 0) {
        loadProjects();
      } else if (projects[0]) {
        setActiveProject(projects[0].id);
      }
    }
  }, [activeProject, projects, loadProjects, setActiveProject]);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  const fetchMembers = async () => {
    if (!activeProject) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(getApiUrl(`/projects/${activeProject.id}/members`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch project members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    }
  }, [activeTab, activeProject]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileStatus(null);

    try {
      const token = localStorage.getItem('project_os_token');
      const res = await fetch(getApiUrl('/users/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update profile');
      }

      if (token) {
        setAuth(
          {
            id: data.id,
            username: data.username,
            email: data.email,
            full_name: data.full_name,
            system_role: data.system_role,
          },
          token
        );
      }

      setProfileStatus({ type: 'success', text: 'Profile information updated successfully!' });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProfileStatus({ type: 'error', text: err.message });
      } else {
        setProfileStatus({ type: 'error', text: 'Failed to update profile.' });
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityLoading(true);
    setSecurityStatus(null);

    if (newPassword !== confirmPassword) {
      setSecurityStatus({ type: 'error', text: 'New passwords do not match.' });
      setSecurityLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setSecurityStatus({ type: 'error', text: 'Password must be at least 6 characters long.' });
      setSecurityLoading(false);
      return;
    }

    try {
      const res = await fetch(getApiUrl('/users/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          password: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update password');
      }

      setSecurityStatus({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSecurityStatus({ type: 'error', text: err.message });
      } else {
        setProfileStatus({ type: 'error', text: 'Failed to update password.' });
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleConfirmLeave = async () => {
    if (!activeProject) return;

    setLeaveLoading(true);
    setLeaveError(null);

    try {
      await leaveProject(activeProject.id);
      setIsLeaveModalOpen(false);
      setLeaveStatus({
        type: 'success',
        text: `Successfully left "${activeProject.name}". Redirecting to projects list...`,
      });
      setTimeout(() => {
        navigate('/projects');
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLeaveError(err.message);
      } else {
        setLeaveError('Failed to leave project. Please check permissions or network connection.');
      }
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setDeleteAccountLoading(true);
    setDeleteAccountError(null);

    try {
      const res = await fetch(getApiUrl('/users/me'), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to delete account. Please try again.');
      }

      setIsDeleteAccountModalOpen(false);
      setDeleteAccountStatus({
        type: 'success',
        text: 'Your account has been deleted. Redirecting to home...',
      });

      setTimeout(() => {
        useAuthStore.getState().logout();
        navigate('/', { replace: true });
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteAccountError(err.message);
      } else {
        setDeleteAccountError('Failed to delete account. Please try again.');
      }
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <SEOHead
        title="Settings & Workspace Preferences"
        description="Manage your user profile, security credentials, theme preferences, and project team member roles."
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-nx-primary">Platform Settings</h1>
        <p className="mt-1 text-sm text-nx-muted">
          Manage your personal profile, security credentials, team workspace members, and project permissions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-nx-border">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-nx-secondary hover:text-nx-primary'
          }`}
        >
          <User className="h-4 w-4" />
          Account & Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-nx-secondary hover:text-nx-primary'
          }`}
        >
          <Shield className="h-4 w-4" />
          Security & Password
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-nx-secondary hover:text-nx-primary'
          }`}
        >
          <Users className="h-4 w-4" />
          Project Members & Invites
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'danger'
              ? 'border-red-600 text-red-600 font-semibold'
              : 'border-transparent text-nx-secondary hover:text-nx-primary'
          }`}
        >
          <LogOut className="h-4 w-4 text-red-500" />
          Danger Zone
        </button>
      </div>

      {/* Tab Content: Profile */}
      {activeTab === 'profile' && (
        <div className="rounded-xl border border-nx-border bg-nx-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-nx-primary">Personal Profile Information</h2>
          <p className="text-xs text-nx-muted mt-0.5">Update your account identity and contact details.</p>

          {profileStatus && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs border ${
                profileStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {profileStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{profileStatus.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Platform Role</label>
              <input
                type="text"
                disabled
                value={currentUser?.system_role ? currentUser.system_role.toUpperCase() : 'STUDENT'}
                className="mt-1 w-full rounded-lg border border-nx-border bg-gray-100 px-3 py-2 text-sm text-nx-muted cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {profileLoading ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Tab Content: Security */}
      {activeTab === 'security' && (
        <div className="rounded-xl border border-nx-border bg-nx-card p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-nx-primary">Security & Password</h2>
          </div>
          <p className="text-xs text-nx-muted mt-0.5">
            Update your account password to maintain workspace security.
          </p>

          {securityStatus && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs border ${
                securityStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {securityStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{securityStatus.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-nx-secondary">New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-nx-secondary">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm text-nx-primary focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={securityLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {securityLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* Tab Content: Project Members */}
      {activeTab === 'members' && (
        <div className="rounded-xl border border-nx-border bg-nx-card p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-nx-primary">
                Members of {activeProject?.name || 'Active Workspace'}
              </h2>
              <p className="text-xs text-nx-muted">Collaborators currently assigned to this workspace.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite Member
            </button>
          </div>

          <div className="mt-6 divide-y divide-nx-border">
            {loadingMembers ? (
              <div className="text-xs text-nx-muted py-4">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="text-xs text-nx-muted py-4">No member records found.</div>
            ) : (
              members.map((mem) => (
                <div key={mem.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 border border-indigo-200">
                      {mem.full_name ? mem.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-nx-primary">{mem.full_name}</p>
                      <p className="text-xs text-nx-muted">{mem.email} • @{mem.username}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-nx-elevated px-3 py-1 text-xs font-semibold text-nx-secondary capitalize border border-nx-border">
                    {mem.project_role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Danger Zone */}
      {activeTab === 'danger' && (
        <div className="rounded-xl border border-red-200 bg-red-50/20 p-6 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2 text-red-600 font-bold text-base">
              <AlertTriangle className="h-5 w-5" />
              <h2>Danger Zone</h2>
            </div>
            <p className="text-xs text-nx-muted mt-1">
              Actions here permanently affect your project memberships or your personal account.
            </p>
          </div>

          {deleteAccountStatus && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs border ${
                deleteAccountStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {deleteAccountStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{deleteAccountStatus.text}</span>
            </div>
          )}

          {leaveStatus && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs border ${
                leaveStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {leaveStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{leaveStatus.text}</span>
            </div>
          )}

          {/* Leave Active Project Card */}
          {activeProject ? (
            <div className="rounded-xl border border-red-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">Leave Active Project ({activeProject.name})</h3>
                </div>
                <p className="text-xs text-gray-600 max-w-lg">
                  Removing yourself removes only your membership from this project. The project, its tasks, discussion threads, milestones, and reports remain intact for the other team members.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLeaveError(null);
                  setIsLeaveModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors shadow-sm shrink-0"
              >
                <LogOut className="h-4 w-4" />
                <span>Leave Project</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-xs text-nx-muted">
              No active project selected. Switch to a project to manage membership.
            </div>
          )}

          {/* Permanently Delete Account Card */}
          <div className="rounded-xl border border-red-300 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-bold text-gray-900">Permanently Delete Account</h3>
              </div>
              <p className="text-xs text-gray-600 max-w-lg">
                Permanently delete your personal profile, credentials, and settings from Nexora. Your team projects will remain intact with remaining collaborators.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setDeleteAccountError(null);
                setIsDeleteAccountModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors shadow-sm shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Leave Project */}
      <ConfirmationModal
        isOpen={isLeaveModalOpen}
        title="Leave Project?"
        message={`Are you sure you want to leave "${activeProject?.name}"? You will no longer have access to this workspace. All tasks, milestones, discussions, and files will remain completely intact for remaining members.`}
        confirmLabel="Leave Project"
        cancelLabel="Stay in Project"
        variant="danger"
        isLoading={leaveLoading}
        errorMessage={leaveError}
        onConfirm={handleConfirmLeave}
        onCancel={() => {
          if (!leaveLoading) {
            setIsLeaveModalOpen(false);
            setLeaveError(null);
          }
        }}
      />

      {/* Confirmation Modal for Delete Account */}
      <ConfirmationModal
        isOpen={isDeleteAccountModalOpen}
        title="Permanently Delete Account?"
        message={`Are you sure you want to delete your Nexora account (${currentUser?.username ? `@${currentUser.username}` : currentUser?.email})? This action is permanent and cannot be undone. All your personal profile credentials, notifications, and availability blocks will be deleted.`}
        confirmLabel="Permanently Delete Account"
        cancelLabel="Keep My Account"
        variant="danger"
        isLoading={deleteAccountLoading}
        errorMessage={deleteAccountError}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => {
          if (!deleteAccountLoading) {
            setIsDeleteAccountModalOpen(false);
            setDeleteAccountError(null);
          }
        }}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onMemberInvited={fetchMembers}
      />
    </div>
  );
}
