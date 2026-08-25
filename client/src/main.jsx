import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import {
  Upload,
  FileText,
  Clock3,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Play,
  RotateCcw,
  Edit3,
  Sparkles,
  LayoutGrid,
  X,
  KeyRound,
  Trophy,
  Share2,
  Copy,
  Check,
  Award,
  ExternalLink,
  Users,
  ShieldCheck,
  CheckCircle,
  LogIn,
  LogOut,
  UserCheck,
  History,
  GraduationCap,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import {
  PatternRenderer,
  PatternBadge,
  TYPE_CONFIG
} from './components/PatternRenderers';
import { ScratchPadModal } from './components/ScratchPadModal';
import { TypeAnalyticsCard } from './components/TypeAnalyticsCard';
import { CreatorDashboard } from './components/CreatorDashboard';
import { CandidateJoinModal } from './components/CandidateJoinModal';
import { AuthModal } from './components/AuthModal';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '/api';

const fmt = (s) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
};

function App() {
  // Navigation states: 'home', 'create-upload', 'create-preview', 'publish-success', 'exam', 'result', 'creator-dashboard', 'my-attempts'
  const [screen, setScreen] = useState('home');
  const [initialCodeParam, setInitialCodeParam] = useState('');

  // Authentication state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('examlens_user') || 'null');
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('examlens_token') || '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  // Authenticated User Lists
  const [myCreatedExams, setMyCreatedExams] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // Creator flow states
  const [creatorExam, setCreatorExam] = useState(null);
  const [creatorAnswerKey, setCreatorAnswerKey] = useState(null);
  const [publishedExam, setPublishedExam] = useState(null);
  const [creatorExamTitle, setCreatorExamTitle] = useState('');
  const [creatorName, setCreatorName] = useState(currentUser?.name || '');
  const [duration, setDuration] = useState(30);
  const [pos, setPos] = useState(1);
  const [neg, setNeg] = useState(0.25);

  // Candidate exam states
  const [candidateExam, setCandidateExam] = useState(null);
  const [candidateName, setCandidateName] = useState(currentUser?.name || '');
  const [candidateEmail, setCandidateEmail] = useState(currentUser?.email || '');
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timeSpentTotal, setTimeSpentTotal] = useState(0);
  const [candidateResult, setCandidateResult] = useState(null);

  // General & UI states
  const [activeDashboardCode, setActiveDashboardCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Axios instance with bearer token
  const authApi = useMemo(() => {
    return axios.create({
      baseURL: API,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  }, [token]);

  // Load URL parameters on mount (?code=8K2P9Q or ?results=8K2P9Q)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const results = params.get('results') || params.get('dashboard');

    if (results) {
      setActiveDashboardCode(results.toUpperCase());
      setScreen('creator-dashboard');
    } else if (code) {
      setInitialCodeParam(code.toUpperCase());
      setScreen('home');
    }
  }, []);

  // Fetch user exams & attempt history when logged in
  const loadUserAccountData = async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const [resExams, resAttempts] = await Promise.allSettled([
        authApi.get('/exams/my-created'),
        authApi.get('/attempts/my-attempts')
      ]);
      if (resExams.status === 'fulfilled') setMyCreatedExams(resExams.value.data || []);
      if (resAttempts.status === 'fulfilled') setMyAttempts(resAttempts.value.data || []);
    } catch (e) {
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadUserAccountData();
    }
  }, [token]);

  // Exam Countdown Timer
  useEffect(() => {
    if (screen !== 'exam' || seconds <= 0) return;
    const t = setInterval(() => {
      setSeconds((s) => s - 1);
      setTimeSpentTotal((t) => t + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [screen, seconds]);

  // Auto-submit when time expires
  useEffect(() => {
    if (screen === 'exam' && seconds === 0 && candidateExam) {
      submitCandidateExam();
    }
  }, [seconds]);

  const handleAuthSuccess = (u, t) => {
    setCurrentUser(u);
    setToken(t);
    setCreatorName(u.name || '');
    setCandidateName(u.name || '');
    setCandidateEmail(u.email || '');
  };

  const handleSignOut = () => {
    localStorage.removeItem('examlens_token');
    localStorage.removeItem('examlens_user');
    setCurrentUser(null);
    setToken('');
    setMyCreatedExams([]);
    setMyAttempts([]);
    setScreen('home');
  };

  // -------------------------------------------------------------
  // CREATOR ACTIONS
  // -------------------------------------------------------------

  async function handleUploadQuestions(file) {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await authApi.post('/parse/questions', fd);
      if (!r.data.questions?.length) throw new Error('No questions were detected in this PDF.');
      setCreatorExam({
        title: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        questions: r.data.questions,
        warnings: r.data.warnings || []
      });
      setCreatorExamTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadAnswerKey(file) {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await authApi.post('/parse/answer-key', fd);
      const parsed = r.data.answers || {};
      setCreatorAnswerKey(parsed);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishExam() {
    if (!creatorExam?.questions?.length) {
      setError('Please upload question paper PDF first.');
      return;
    }
    if (!creatorAnswerKey || !Object.keys(creatorAnswerKey).length) {
      setError('Please upload answer key PDF before publishing.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        title: creatorExamTitle || creatorExam.title || 'Practice Examination',
        creatorName: creatorName || currentUser?.name || 'Exam Creator',
        config: {
          duration,
          positiveMarks: pos,
          negativeMarks: neg
        },
        questions: creatorExam.questions,
        answerKey: creatorAnswerKey
      };

      const res = await authApi.post('/exams/create', payload);
      setPublishedExam(res.data.exam);
      setCreatorExam(null);
      setCreatorAnswerKey(null);
      setCreatorExamTitle('');
      await loadUserAccountData();
      setScreen('publish-success');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // CANDIDATE ACTIONS
  // -------------------------------------------------------------

  function handleStartCandidateExam({ exam, candidateName: cName, candidateEmail: cEmail }) {
    setCandidateExam(exam);
    setCandidateName(cName || currentUser?.name || 'Candidate');
    setCandidateEmail(cEmail || currentUser?.email || '');
    setAnswers({});
    setIdx(0);
    setSeconds((exam.config?.duration || 30) * 60);
    setTimeSpentTotal(0);
    setScreen('exam');
  }

  function chooseOption(v) {
    const q = candidateExam.questions[idx];
    setAnswers((a) => ({
      ...a,
      [q.questionNumber]: {
        ...(a[q.questionNumber] || {}),
        selectedOption: v,
        enteredAt: a[q.questionNumber]?.enteredAt || Date.now()
      }
    }));
  }

  function toggleFlag() {
    const q = candidateExam.questions[idx];
    setAnswers((a) => ({
      ...a,
      [q.questionNumber]: {
        ...(a[q.questionNumber] || {}),
        markedForReview: !a[q.questionNumber]?.markedForReview,
        enteredAt: a[q.questionNumber]?.enteredAt || Date.now()
      }
    }));
  }

  function navigateQuestion(next) {
    const q = candidateExam.questions[idx];
    setAnswers((a) => ({
      ...a,
      [q.questionNumber]: {
        ...(a[q.questionNumber] || {}),
        timeSpent:
          (a[q.questionNumber]?.timeSpent || 0) +
          (Date.now() - (a[q.questionNumber]?.enteredAt || Date.now())) / 1000,
        enteredAt: Date.now()
      }
    }));
    setIdx(Math.max(0, Math.min(candidateExam.questions.length - 1, next)));
  }

  async function submitCandidateExam() {
    if (!candidateExam) return;
    setLoading(true);
    setError('');
    try {
      const payload = {
        candidateName: candidateName || currentUser?.name || 'Anonymous Candidate',
        candidateEmail: candidateEmail || currentUser?.email || '',
        answers,
        timeSpentSeconds: timeSpentTotal,
        examSnapshot: candidateExam
      };

      const res = await authApi.post(`/exams/${candidateExam.code}/submit`, payload);
      setCandidateResult(res.data.result);
      loadUserAccountData();
      setScreen('result');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyShareLink = (code) => {
    const origin = window.location.origin;
    const url = `${origin}/?code=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="app">
      {/* Universal Header with Authentication Status */}
      {screen !== 'exam' && (
        <header>
          <div className="brand" onClick={() => setScreen('home')}>
            <span className="brandmark">E</span>
            <div>
              <b>ExamLens</b>
              <small>Multi-User Exam Platform</small>
            </div>
          </div>

          <div className="header-nav-actions">
            <button
              type="button"
              className={screen === 'home' ? 'ghost active-tab' : 'ghost'}
              onClick={() => setScreen('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={screen === 'create-upload' ? 'ghost active-tab' : 'ghost'}
              onClick={() => {
                if (!currentUser) {
                  setAuthMode('signup');
                  setAuthModalOpen(true);
                } else {
                  setScreen('create-upload');
                }
              }}
            >
              + Create Exam
            </button>

            {/* ONLY show Creator Dashboard to Authenticated Teachers/Creators */}
            {currentUser?.role === 'teacher' && (
              <button
                type="button"
                className={screen === 'creator-dashboard' ? 'ghost active-tab' : 'ghost'}
                onClick={() => {
                  setActiveDashboardCode(myCreatedExams[0]?.code || publishedExam?.code || '');
                  setScreen('creator-dashboard');
                }}
              >
                Creator Dashboard
              </button>
            )}

            {currentUser ? (
              <div className="user-profile-header-group">
                <div className="user-pill-badge">
                  <span className="user-avatar-circle">
                    {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
                  </span>
                  <div className="user-info-text">
                    <b>{currentUser.name}</b>
                    <small>{currentUser.role === 'teacher' ? 'Teacher' : 'Student'}</small>
                  </div>
                </div>
                <button type="button" className="ghost signout-btn" onClick={handleSignOut} title="Sign Out">
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="auth-header-buttons">
                <button
                  type="button"
                  className="ghost signin-trigger-btn"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                >
                  <LogIn size={15} />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  className="primary signup-trigger-btn"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  }}
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {/* 1. HOMEPAGE */}
      {screen === 'home' && (
        <main className="hero-multiuser">
          <div className="hero-left-section">
            <span className="eyebrow">EXAM HOSTING & PRACTICE PLATFORM</span>
            <h1>
              Create, share, and solve exams with <em>interactive pattern AI.</em>
            </h1>
            <p>
              Upload Question Paper & Answer Key PDFs. Generate a shareable 6-digit code.
              Candidates solve with specialized tools, while creators monitor live results and rankings.
            </p>

            <div className="home-action-buttons">
              <button
                className="primary host-btn"
                onClick={() => {
                  if (!currentUser) {
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  } else {
                    setScreen('create-upload');
                  }
                }}
              >
                <Upload size={18} />
                <span>Create & Host an Exam</span>
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setActiveDashboardCode(myCreatedExams[0]?.code || publishedExam?.code || '');
                  setScreen('creator-dashboard');
                }}
              >
                <Trophy size={18} />
                <span>View Results & Leaderboard</span>
              </button>
            </div>

            {/* Authenticated User Quick Links */}
            {currentUser && (
              <div className="user-dashboard-summary-cards">
                {myCreatedExams.length > 0 && (
                  <div className="user-dash-box">
                    <div className="dash-box-head">
                      <ShieldCheck size={16} className="blue-icon" />
                      <b>My Hosted Exams ({myCreatedExams.length})</b>
                    </div>
                    <div className="quick-exams-list">
                      {myCreatedExams.slice(0, 3).map((e) => (
                        <div key={e.code} className="quick-exam-item">
                          <div>
                            <b>{e.title}</b>
                            <small>Code: <code>{e.code}</code> · {e.totalAttempts} submissions</small>
                          </div>
                          <button
                            type="button"
                            className="secondary btn-xs"
                            onClick={() => {
                              setActiveDashboardCode(e.code);
                              setScreen('creator-dashboard');
                            }}
                          >
                            Leaderboard →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {myAttempts.length > 0 && (
                  <div className="user-dash-box">
                    <div className="dash-box-head">
                      <GraduationCap size={16} className="green-icon" />
                      <b>My Exam History ({myAttempts.length})</b>
                    </div>
                    <div className="quick-exams-list">
                      {myAttempts.slice(0, 3).map((a) => (
                        <div key={a.id} className="quick-exam-item">
                          <div>
                            <b>{a.examTitle}</b>
                            <small>Score: <b>{Number(a.score).toFixed(2)}</b>/{a.maxScore} · {a.accuracy.toFixed(0)}% Acc</small>
                          </div>
                          <span className="attempt-date-tag">{new Date(a.submittedAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="features-pill-row">
              <span className="feat-pill">⚡ Auto Pattern AI</span>
              <span className="feat-pill">🔗 Unique 6-Digit Code</span>
              <span className="feat-pill">🏆 Live Leaderboard</span>
              <span className="feat-pill">📱 iPhone 13 Optimized</span>
            </div>
          </div>

          <div className="hero-right-join-card">
            <CandidateJoinModal
              initialCode={initialCodeParam}
              onStartExam={handleStartCandidateExam}
            />
          </div>
        </main>
      )}

      {/* 2. CREATOR EXAM CREATION WORKFLOW */}
      {screen === 'create-upload' && (
        <main className="content">
          <div className="page-title">
            <div>
              <span className="eyebrow">STEP 1 OF 2 · HOST AN EXAM</span>
              <h2>Upload Exam & Answer Key</h2>
              <p>Upload your Question Paper PDF and Answer Key PDF to generate your unique shareable exam code.</p>
            </div>
          </div>

          <div className="create-grid-layout">
            <div className="panel upload-sub-card">
              <div className="card-top-icon">
                <FileText size={24} className="blue-icon" />
                <b>1. Question Paper PDF</b>
              </div>
              <p>Upload standard MCQ question paper (PDF format).</p>

              <label className="drop drop-compact">
                <Upload size={28} />
                <b>{creatorExam ? `✓ ${creatorExam.questions.length} questions detected` : 'Drop Question Paper PDF'}</b>
                <span>{creatorExam ? creatorExam.title : 'Supports PDF up to 20MB'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => e.target.files[0] && handleUploadQuestions(e.target.files[0])}
                />
              </label>
            </div>

            <div className="panel upload-sub-card">
              <div className="card-top-icon">
                <ShieldCheck size={24} className="green-icon" />
                <b>2. Answer Key PDF</b>
              </div>
              <p>Upload official answer key PDF to enable automated scoring.</p>

              <label className="drop drop-compact">
                <FileText size={28} />
                <b>{creatorAnswerKey ? `✓ ${Object.keys(creatorAnswerKey).length} answers extracted` : 'Drop Answer Key PDF'}</b>
                <span>Supports tables, standard keys & compact formats</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => e.target.files[0] && handleUploadAnswerKey(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div className="panel exam-config-panel">
            <h3>Exam Settings & Rules</h3>
            <div className="config-grid-full">
              <label>
                EXAM TITLE
                <input
                  type="text"
                  value={creatorExamTitle}
                  placeholder="e.g. IBPS PO Reasoning Mock Test 1"
                  onChange={(e) => setCreatorExamTitle(e.target.value)}
                />
              </label>
              <label>
                CREATOR / INSTITUTION NAME
                <input
                  type="text"
                  value={creatorName}
                  placeholder="e.g. Prof. Sharma or Apex Academy"
                  onChange={(e) => setCreatorName(e.target.value)}
                />
              </label>
              <label>
                TIME DURATION (MINUTES)
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(+e.target.value)}
                />
              </label>
              <label>
                POSITIVE MARKS / CORRECT
                <input
                  type="number"
                  step="0.25"
                  value={pos}
                  onChange={(e) => setPos(+e.target.value)}
                />
              </label>
              <label>
                NEGATIVE MARKS / WRONG
                <input
                  type="number"
                  step="0.05"
                  value={neg}
                  onChange={(e) => setNeg(+e.target.value)}
                />
              </label>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="actions bottom" style={{ marginTop: 24 }}>
              <button className="secondary" onClick={() => setScreen('home')}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={loading || !creatorExam || !creatorAnswerKey}
                onClick={() => setScreen('create-preview')}
              >
                {loading ? 'Processing…' : 'Preview & Verify Patterns →'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* 3. CREATOR PREVIEW & PUBLISH */}
      {screen === 'create-preview' && creatorExam && (
        <main className="content">
          <div className="page-title">
            <div>
              <span className="eyebrow">STEP 2 OF 2 · PATTERN VERIFICATION</span>
              <h2>{creatorExamTitle || creatorExam.title}</h2>
              <p>
                {creatorExam.questions.length} questions extracted · Answer key: {Object.keys(creatorAnswerKey || {}).length} verified
              </p>
            </div>
            <button className="primary publish-btn" onClick={handlePublishExam} disabled={loading}>
              <Sparkles size={18} />
              <span>{loading ? 'Publishing…' : 'Publish & Generate Exam Code'}</span>
            </button>
          </div>

          <div className="preview-grid">
            {creatorExam.questions.map((q) => (
              <div className="question-card" key={q.questionNumber}>
                <div className="qtop">
                  <div className="qtop-left">
                    <b>Q{q.questionNumber}</b>
                    <PatternBadge type={q.questionType} customLabel={q.questionTypeLabel} size="small" />
                  </div>
                  <span className="key-tag-preview">
                    Key: <b>{creatorAnswerKey?.[q.questionNumber] || '—'}</b>
                  </span>
                </div>
                <div className="preview-rendered-box">
                  <PatternRenderer question={q} selectedOption={null} onSelectOption={() => {}} />
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* 4. PUBLISH SUCCESS SCREEN */}
      {screen === 'publish-success' && publishedExam && (
        <main className="content">
          <div className="panel publish-success-card center">
            <div className="success-icon-wrap">
              <CheckCircle size={44} className="green-icon" />
            </div>
            <span className="eyebrow">EXAM PUBLISHED SUCCESSFULLY</span>
            <h2>{publishedExam.title}</h2>
            <p>Your exam is live! Share this unique code or direct link with students to attempt.</p>

            <div className="code-highlight-card">
              <span className="code-sub-label">UNIQUE EXAM CODE</span>
              <div className="big-code-display">{publishedExam.code}</div>
              <button
                type="button"
                className="secondary copy-code-action"
                onClick={() => handleCopyCode(publishedExam.code)}
              >
                {copiedCode ? <Check size={16} className="green-icon" /> : <Copy size={16} />}
                <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="link-share-container">
              <label>DIRECT STUDENT JOIN LINK:</label>
              <div className="link-input-group">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?code=${publishedExam.code}`}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleCopyShareLink(publishedExam.code)}
                >
                  {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            <div className="publish-next-actions">
              <button
                className="primary dashboard-trigger-btn"
                onClick={() => {
                  setActiveDashboardCode(publishedExam.code);
                  setScreen('creator-dashboard');
                }}
              >
                <Trophy size={18} />
                <span>Go to Creator Results & Leaderboard</span>
              </button>
              <button
                className="secondary"
                onClick={() => {
                  handleStartCandidateExam({
                    exam: publishedExam,
                    candidateName: currentUser?.name || 'Test Candidate',
                    candidateEmail: currentUser?.email || ''
                  });
                }}
              >
                <Play size={18} />
                <span>Take Test as Candidate (Preview)</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* 5. CANDIDATE EXAM EXPERIENCE */}
      {screen === 'exam' && candidateExam && (
        <ExamPage
          exam={candidateExam}
          candidateName={candidateName}
          answers={answers}
          idx={idx}
          seconds={seconds}
          choose={chooseOption}
          toggleFlag={toggleFlag}
          navigate={navigateQuestion}
          onSubmit={submitCandidateExam}
          onOpenScratchpad={() => setScratchpadOpen(true)}
        />
      )}

      {/* 6. CANDIDATE RESULT SCORECARD */}
      {screen === 'result' && candidateResult && candidateExam && (
        <main className="content">
          <div className="result-hero">
            <div>
              <span className="eyebrow">EXAM SCORECARD</span>
              <h2>{candidateExam.title}</h2>
              <p>Candidate: <b>{candidateName}</b> · Submitted: {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="score">
              <b>{Number(candidateResult.score).toFixed(2)}</b>
              <span>/ {candidateResult.maxScore}</span>
            </div>
          </div>

          <div className="kpis">
            <Kpi icon={<CheckCircle2 className="green-icon" />} label="Correct" value={candidateResult.correct} />
            <Kpi icon={<XCircle className="red-icon" />} label="Wrong" value={candidateResult.wrong} />
            <Kpi icon={<MinusCircle className="gray-icon" />} label="Unattempted" value={candidateResult.unattempted} />
            <Kpi label="Accuracy" value={`${candidateResult.accuracy.toFixed(1)}%`} />
            <Kpi label="Attempt Rate" value={`${candidateResult.attemptRate.toFixed(1)}%`} />
          </div>

          <TypeAnalyticsCard typeResults={candidateResult.typeResults || []} />

          <div className="panel review" style={{ marginTop: 20 }}>
            <div className="review-head">
              <div>
                <h3>Question Review & Answer Key</h3>
                <span>Compare your responses with the official key</span>
              </div>
            </div>

            <div className="review-rows-container">
              {candidateResult.questionResults.map((r) => {
                const q = candidateExam.questions.find((x) => x.questionNumber === r.questionNumber);
                return (
                  <div className="review-row-enhanced" key={r.questionNumber}>
                    <div className="r-left">
                      <b>Q{r.questionNumber}</b>
                      <PatternBadge type={r.questionType} customLabel={r.questionTypeLabel} size="small" />
                    </div>
                    <div className="r-question-preview">
                      <span className="r-qtext">{q?.questionText || ''}</span>
                    </div>
                    <div className="r-ans-block">
                      <span className="ans-tag your-ans">
                        Your: <b>{r.selectedAnswer || 'None'}</b>
                      </span>
                      <span className="ans-tag correct-ans">
                        Key: <b>{r.correctAnswer || '—'}</b>
                      </span>
                    </div>
                    <span className={`status ${r.status}`}>{r.status}</span>
                    <span className="time-tag">{fmt(r.timeSpent)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="actions bottom">
            {currentUser?.role === 'teacher' && (
              <button
                className="secondary"
                onClick={() => {
                  setActiveDashboardCode(candidateExam.code);
                  setScreen('creator-dashboard');
                }}
              >
                <Trophy size={17} />
                Creator Dashboard
              </button>
            )}
            <button className="primary" onClick={() => setScreen('home')}>
              Back to Home
            </button>
          </div>
        </main>
      )}

      {/* 7. CREATOR DASHBOARD & LEADERBOARD */}
      {screen === 'creator-dashboard' && (
        <CreatorDashboard
          examCode={activeDashboardCode}
          onBack={() => setScreen('home')}
          onSelectExam={(code) => setActiveDashboardCode(code)}
        />
      )}

      <ScratchPadModal isOpen={scratchpadOpen} onClose={() => setScratchpadOpen(false)} />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

function ExamPage({
  exam,
  candidateName,
  answers,
  idx,
  seconds,
  choose,
  toggleFlag,
  navigate,
  onSubmit,
  onOpenScratchpad
}) {
  const [showPalette, setShowPalette] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState('all');
  const q = exam.questions[idx];
  const selected = answers[q.questionNumber]?.selectedOption;

  const counts = exam.questions.reduce(
    (a, x) => {
      const s = answers[x.questionNumber]?.selectedOption
        ? 'answered'
        : answers[x.questionNumber]?.markedForReview
        ? 'review'
        : 'unseen';
      a[s]++;
      return a;
    },
    { answered: 0, review: 0, unseen: 0 }
  );

  const availableTypes = useMemo(() => {
    const set = new Set();
    exam.questions.forEach((item) => set.add(item.questionType || 'general_mcq'));
    return Array.from(set);
  }, [exam]);

  return (
    <div className="exam">
      {showPalette && <div className="palette-backdrop" onClick={() => setShowPalette(false)} />}

      <header className="exam-header">
        <div className="brand exam-brand">
          <span className="brandmark">E</span>
          <div className="brand-text-block">
            <b>{exam.title}</b>
            <div className="exam-type-subline">
              <span className="candidate-name-badge">Candidate: {candidateName}</span>
            </div>
          </div>
        </div>

        <div className="exam-header-actions">
          <button
            type="button"
            className="secondary scratchpad-trigger"
            onClick={onOpenScratchpad}
            title="Open Rough Sheet / Notes"
          >
            <Edit3 size={15} />
            <span className="btn-label-desktop">Rough Sheet</span>
            <span className="btn-label-mobile">Sheet</span>
          </button>

          <div className="timer">
            <Clock3 size={15} />
            <span>{fmt(seconds)}</span>
          </div>

          <button
            type="button"
            className="palette-toggle secondary"
            onClick={() => setShowPalette((v) => !v)}
            title="Open Question Palette"
          >
            <LayoutGrid size={15} />
            <span>Palette</span>
          </button>

          <button type="button" className="danger submit-btn" onClick={onSubmit}>
            Submit
          </button>
        </div>
      </header>

      <div className="exam-layout">
        <main className="exam-main">
          <div className="qmeta">
            <span className="qnum-badge">Question {idx + 1} of {exam.questions.length}</span>
            <PatternBadge type={q.questionType} customLabel={q.questionTypeLabel} />
            <span className="q-section-name">{q.section}</span>
          </div>

          <div className="pattern-work-area">
            <PatternRenderer
              question={q}
              selectedOption={selected}
              onSelectOption={choose}
            />
          </div>

          <div className="exam-actions">
            <button className="secondary clear-btn" onClick={() => choose(null)}>
              <RotateCcw size={15} />
              <span>Clear</span>
            </button>
            <button
              className={answers[q.questionNumber]?.markedForReview ? 'reviewbtn active' : 'reviewbtn'}
              onClick={toggleFlag}
            >
              <Flag size={15} />
              <span>Review</span>
            </button>
            <div className="spacer" />
            <button
              className="secondary prev-btn"
              disabled={idx === 0}
              onClick={() => navigate(idx - 1)}
            >
              <ChevronLeft size={16} />
              <span>Prev</span>
            </button>
            <button
              className="primary next-btn"
              disabled={idx === exam.questions.length - 1}
              onClick={() => navigate(idx + 1)}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </main>

        <aside className={`palette ${showPalette ? 'palette-open' : ''}`}>
          <div className="palette-mobile-head">
            <h3>Question Palette</h3>
            <button className="iconbtn close-palette-btn" onClick={() => setShowPalette(false)}>
              <X size={18} />
            </button>
          </div>
          <h3 className="palette-desktop-title">Question Palette</h3>

          <div className="palette-filter-wrapper">
            <label>Filter by Pattern:</label>
            <select
              value={paletteFilter}
              onChange={(e) => setPaletteFilter(e.target.value)}
              className="palette-filter-select"
            >
              <option value="all">All Patterns ({exam.questions.length})</option>
              {availableTypes.map((t) => {
                const conf = TYPE_CONFIG[t] || TYPE_CONFIG.general_mcq;
                const count = exam.questions.filter((x) => (x.questionType || 'general_mcq') === t).length;
                return (
                  <option key={t} value={t}>
                    {conf.label} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="legend">
            <span className="legend-answered">● Answered {counts.answered}</span>
            <span className="legend-review">● Review {counts.review}</span>
            <span className="legend-unseen">● Unseen {counts.unseen}</span>
          </div>

          <div className="palette-grid">
            {exam.questions.map((x, i) => {
              const a = answers[x.questionNumber];
              const isFilteredOut =
                paletteFilter !== 'all' && (x.questionType || 'general_mcq') !== paletteFilter;
              return (
                <button
                  key={x.questionNumber}
                  className={`palette-btn ${a?.selectedOption ? 'panswered' : ''} ${
                    a?.markedForReview ? 'preview' : ''
                  } ${i === idx ? 'current' : ''} ${isFilteredOut ? 'dimmed' : ''}`}
                  onClick={() => {
                    navigate(i);
                    setShowPalette(false);
                  }}
                  title={`Q${x.questionNumber} - ${x.questionTypeLabel || 'MCQ'}`}
                >
                  {x.questionNumber}
                </button>
              );
            })}
          </div>

          <div className="palette-footer-actions">
            <button type="button" className="danger palette-submit-btn" onClick={onSubmit}>
              Submit Exam Now
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }) {
  return (
    <div className="kpi">
      {icon && <div className="kpiicon">{icon}</div>}
      <div>
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
