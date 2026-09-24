import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  User as UserIcon,
  Mail,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getApiUrl } from '../config/api';
import SEOHead from '../components/common/SEOHead';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export default function AuthPage({ initialMode }: AuthPageProps) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine mode from prop or current pathname
  const isRegisterRoute = initialMode === 'register' || location.pathname === '/register';
  const [isRegister, setIsRegister] = useState(isRegisterRoute);

  useEffect(() => {
    setIsRegister(initialMode === 'register' || location.pathname === '/register');
  }, [initialMode, location.pathname]);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Validation
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (isRegister) {
      if (!fullName.trim()) {
        errors.fullName = 'Full name is required';
      }
      if (!username.trim()) {
        errors.username = 'Username is required';
      } else if (username.trim().length < 3) {
        errors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
        errors.username = 'Username can only contain letters, numbers, underscores, and dashes';
      }
      if (!email.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
      if (!password) {
        errors.password = 'Password is required';
      } else if (password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else {
      if (!username.trim()) {
        errors.username = 'Username or email is required';
      }
      if (!password) {
        errors.password = 'Password is required';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        let res: Response;
        try {
          res = await fetch(getApiUrl('/auth/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: username.trim().toLowerCase(),
              email: email.trim().toLowerCase(),
              password,
              full_name: fullName.trim() || username.trim(),
            }),
          });
        } catch {
          throw new Error("Unable to connect to Nexora's server. Please try again.");
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 400 || res.status === 422) {
            let detail = data.detail;
            if (Array.isArray(detail)) {
              detail = detail.map((e: { msg?: string; message?: string }) => e.msg || e.message || 'Validation error').join(', ');
            }
            if (typeof detail === 'string') {
              const lower = detail.toLowerCase();
              if (lower.includes('email already')) {
                throw new Error('An account with this email already exists.');
              }
              if (lower.includes('username already')) {
                throw new Error('That username is already taken.');
              }
              if (lower.includes('valid email')) {
                throw new Error('Please enter a valid email address.');
              }
              throw new Error(detail);
            }
          }
          if (res.status >= 500) {
            throw new Error('Something went wrong on the server. Please try again.');
          }
          throw new Error(data.detail || 'Registration failed. Please try a different username or email.');
        }

        setAuth(data.user, data.access_token);
        navigate('/dashboard', { replace: true });
      } else {
        const formData = new URLSearchParams();
        formData.append('username', username.trim());
        formData.append('password', password);

        let res: Response;
        try {
          res = await fetch(getApiUrl('/auth/token'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          });
        } catch {
          throw new Error("Unable to connect to Nexora's server. Please try again.");
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Incorrect username, email, or password.');
          }
          if (res.status === 400 || res.status === 422) {
            let detail = data.detail;
            if (Array.isArray(detail)) {
              detail = detail.map((e: { msg?: string; message?: string }) => e.msg || e.message || 'Validation error').join(', ');
            }
            throw new Error(detail || 'Invalid login request.');
          }
          if (res.status >= 500) {
            throw new Error('Something went wrong on the server. Please try again.');
          }
          throw new Error(data.detail || 'Authentication failed. Please verify your credentials.');
        }

        setAuth(data.user, data.access_token);
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to connect to Nexora's server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 bg-[#eef3ec]">
      {/* Painterly watercolor background image */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/image/login-bg.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        {/* Soft atmospheric overlay for readability & depth */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.2) 0%, rgba(235, 242, 235, 0.45) 75%, rgba(220, 232, 222, 0.65) 100%)`,
          }}
        />
      </div>

      <SEOHead
        title={isRegister ? 'Create Account' : 'Sign In'}
        description={
          isRegister
            ? 'Create your Nexora workspace account to manage connected tasks, milestones, and project activity.'
            : 'Sign in to your Nexora workspace.'
        }
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Logo & Header */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl p-1"
          >
            <img
              src="/icons/icon-192x192.png"
              alt="Nexora N-X Brand Logo"
              className="h-10 w-10 rounded-xl transition-transform group-hover:scale-105"
              style={{
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            />
            <div className="text-left">
              <span
                className="text-xl font-extrabold tracking-tight block leading-none"
                style={{ color: '#181818' }}
              >
                Nexora
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 block"
                style={{ color: '#4f46e5' }}
              >
                Connected Work
              </span>
            </div>
          </Link>

          <h1
            className="mt-6 text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: '#181818' }}
          >
            {isRegister ? 'Start your workspace' : 'Welcome back'}
          </h1>
          <p
            className="mt-2 text-xs sm:text-sm max-w-sm mx-auto"
            style={{ color: '#5F5F5F' }}
          >
            {isRegister
              ? 'Turn conversations into structured, trackable deliverables.'
              : 'Continue your work where you left off.'}
          </p>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div
          className="mt-6 flex rounded-xl p-1"
          style={{
            backgroundColor: '#EAE7E1',
            border: '1px solid #DDD9D2',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError(null);
              setFieldErrors({});
            }}
            className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
            style={{
              backgroundColor: !isRegister ? '#FFFFFF' : 'transparent',
              color: !isRegister ? '#181818' : '#858585',
              boxShadow: !isRegister ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError(null);
              setFieldErrors({});
            }}
            className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
            style={{
              backgroundColor: isRegister ? '#FFFFFF' : 'transparent',
              color: isRegister ? '#181818' : '#858585',
              boxShadow: isRegister ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Main Form Card */}
        <div
          className="mt-4 rounded-2xl p-6 sm:p-8 backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(253, 252, 250, 0.94)',
            border: '1px solid rgba(226, 226, 223, 0.9)',
            boxShadow: '0 10px 30px -5px rgba(25, 45, 30, 0.08), 0 2px 8px -2px rgba(25, 45, 30, 0.04)',
          }}
        >
          {/* Main Error Alert */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl p-3.5 flex items-start gap-2.5 text-xs"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name (Register Only) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#3A3A3A' }}>
                  Full Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-4 w-4" style={{ color: '#858585' }} />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                      }
                    }}
                    placeholder="e.g. Alex Morgan"
                    className="w-full rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: fieldErrors.fullName ? '1px solid #EF4444' : '1px solid #E2E2DF',
                      color: '#181818',
                    }}
                  />
                </div>
                {fieldErrors.fullName && (
                  <p className="mt-1 text-[11px]" style={{ color: '#DC2626' }}>{fieldErrors.fullName}</p>
                )}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#3A3A3A' }}>
                {isRegister ? 'Username' : 'Username or Email'}{' '}
                <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-4 w-4" style={{ color: '#858585' }} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) {
                      setFieldErrors((prev) => ({ ...prev, username: '' }));
                    }
                  }}
                  placeholder={isRegister ? 'e.g. alex_morgan' : 'username or email address'}
                  autoComplete={isRegister ? 'username' : 'username email'}
                  className="w-full rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: fieldErrors.username ? '1px solid #EF4444' : '1px solid #E2E2DF',
                    color: '#181818',
                  }}
                />
              </div>
              {fieldErrors.username && (
                <p className="mt-1 text-[11px]" style={{ color: '#DC2626' }}>{fieldErrors.username}</p>
              )}
            </div>

            {/* Email Address (Register Only) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#3A3A3A' }}>
                  Email Address <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4" style={{ color: '#858585' }} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: '' }));
                      }
                    }}
                    placeholder="alex@university.edu"
                    autoComplete="email"
                    className="w-full rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: fieldErrors.email ? '1px solid #EF4444' : '1px solid #E2E2DF',
                      color: '#181818',
                    }}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px]" style={{ color: '#DC2626' }}>{fieldErrors.email}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold" style={{ color: '#3A3A3A' }}>
                  Password <span style={{ color: '#DC2626' }}>*</span>
                </label>
                {isRegister && (
                  <span className="text-[10px]" style={{ color: '#858585' }}>Min. 6 characters</span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4" style={{ color: '#858585' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  placeholder="••••••••"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className="w-full rounded-xl pl-9 pr-10 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: fieldErrors.password ? '1px solid #EF4444' : '1px solid #E2E2DF',
                    color: '#181818',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors"
                  style={{ color: '#858585' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-[11px]" style={{ color: '#DC2626' }}>{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password (Register Only) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#3A3A3A' }}>
                  Confirm Password <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4" style={{ color: '#858585' }} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full rounded-xl pl-9 pr-10 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: fieldErrors.confirmPassword ? '1px solid #EF4444' : '1px solid #E2E2DF',
                      color: '#181818',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors"
                    style={{ color: '#858585' }}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-[11px]" style={{ color: '#DC2626' }}>{fieldErrors.confirmPassword}</p>
                )}
              </div>
            )}

            {/* Submit CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white transition-all disabled:opacity-50 active:scale-[0.98] mt-2"
              style={{
                backgroundColor: '#4f46e5',
                boxShadow: '0 1px 3px rgba(79,70,229,0.25)',
              }}
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isRegister ? 'Creating Workspace...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account & Enter' : 'Sign In to Workspace'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Legal & Back Link */}
        <div className="mt-6 text-center text-xs space-y-2" style={{ color: '#858585' }}>
          <p>
            By continuing, you agree to Nexora&apos;s{' '}
            <Link to="/terms" className="hover:underline" style={{ color: '#4f46e5' }}>
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="hover:underline" style={{ color: '#4f46e5' }}>
              Privacy Policy
            </Link>
            .
          </p>
          <p>
            <Link to="/" className="transition-colors hover:opacity-70" style={{ color: '#5F5F5F' }}>
              ← Return to Nexora Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
