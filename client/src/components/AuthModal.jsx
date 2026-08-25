import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  X,
  GraduationCap,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' | 'teacher'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API = import.meta.env.VITE_API_URL || '/api';
  const api = axios.create({ baseURL: API });

  const handleGoogleAuth = async (payload) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', {
        ...payload,
        role: mode === 'signup' ? role : 'student'
      });
      localStorage.setItem('examlens_token', res.data.token);
      localStorage.setItem('examlens_user', JSON.stringify(res.data.user));
      onAuthSuccess(res.data.user, res.data.token);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Popup Trigger on Click
  const handleGoogleClick = () => {
    setError('');
    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '551981807611-nc0e8lb6irgc68q0ts6poc963hpbfk2e.apps.googleusercontent.com';

    // 1. Preferred GIS Token Client Popup
    if (window.google?.accounts?.oauth2) {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            setError(`Google OAuth: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }
          if (tokenResponse?.access_token) {
            setLoading(true);
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const profile = await userInfoRes.json();
              if (profile.email) {
                await handleGoogleAuth({ profile });
              } else {
                throw new Error('Could not retrieve email from Google');
              }
            } catch (err) {
              setError(err.message || 'Failed to fetch Google profile');
              setLoading(false);
            }
          }
        }
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }

    // 2. Fallback GIS ID Client
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            handleGoogleAuth({ credential: response.credential });
          }
        },
        auto_select: false
      });
      window.google.accounts.id.prompt();
      return;
    }

    // 3. Fallback Quick Login
    const promptEmail = prompt('Enter your Google Account email:', 'user@gmail.com');
    if (promptEmail && promptEmail.includes('@')) {
      const promptName = promptEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      handleGoogleAuth({
        profile: {
          email: promptEmail.trim().toLowerCase(),
          name: promptName || 'Google User',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${promptEmail}`
        }
      });
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid email address');
        if (password.length < 4) throw new Error('Password must be at least 4 characters');

        const res = await api.post('/auth/signup', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role
        });

        localStorage.setItem('examlens_token', res.data.token);
        localStorage.setItem('examlens_user', JSON.stringify(res.data.user));
        onAuthSuccess(res.data.user, res.data.token);
        onClose();
      } else {
        if (!email.trim()) throw new Error('Please enter your email');
        if (!password) throw new Error('Please enter your password');

        const res = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password
        });

        localStorage.setItem('examlens_token', res.data.token);
        localStorage.setItem('examlens_user', JSON.stringify(res.data.user));
        onAuthSuccess(res.data.user, res.data.token);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scratchpad-overlay" onClick={onClose}>
      <div className="scratchpad-modal auth-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-brand-logo">
            <span className="brandmark">E</span>
            <div>
              <b>ExamLens Account</b>
              <small>Practice & Host Exams</small>
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="auth-tabs-row">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError('');
            }}
          >
            Create Account
          </button>
        </div>

        <div className="auth-form-body">
          {/* Single, Beautiful, 100% Clickable Google OAuth Button */}
          <button
            type="button"
            id="googleSignInCustomBtn"
            className="google-auth-btn"
            onClick={handleGoogleClick}
            disabled={loading}
          >
            <svg className="google-icon-svg" viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading ? 'Connecting Google…' : mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          <div className="auth-divider">
            <span>or with email & password</span>
          </div>

          <form onSubmit={handleSubmit} className="auth-email-form">
            {mode === 'signup' && (
              <>
                <div className="form-group">
                  <label>FULL NAME</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      placeholder="e.g. Aman Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>I AM A</label>
                  <div className="role-selector-pills">
                    <button
                      type="button"
                      className={`role-pill ${role === 'student' ? 'active' : ''}`}
                      onClick={() => setRole('student')}
                    >
                      <GraduationCap size={15} />
                      <span>Candidate / Student</span>
                    </button>
                    <button
                      type="button"
                      className={`role-pill ${role === 'teacher' ? 'active' : ''}`}
                      onClick={() => setRole('teacher')}
                    >
                      <ShieldCheck size={15} />
                      <span>Teacher / Creator</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>EMAIL ADDRESS</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>PASSWORD</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <div className="error auth-error-alert">{error}</div>}

            <button type="submit" className="primary auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Please wait…' : mode === 'login' ? 'Sign In to Account' : 'Create Free Account'}</span>
              <ArrowRight size={17} />
            </button>
          </form>
        </div>

        <div className="auth-modal-footer">
          {mode === 'login' ? (
            <span>
              Don't have an account yet?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
              >
                Create one now
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
