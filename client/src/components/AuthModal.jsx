import React, { useState } from 'react';
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

  if (!isOpen) return null;

  const API = import.meta.env.VITE_API_URL || '/api';
  const api = axios.create({ baseURL: API });

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

        <form onSubmit={handleSubmit} className="auth-form-body">
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
