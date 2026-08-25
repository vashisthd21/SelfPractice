import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trophy,
  Users,
  Clock3,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Search,
  ExternalLink,
  RotateCcw,
  ArrowLeft,
  X,
  Target,
  BarChart3,
  Award
} from 'lucide-react';
import { PatternBadge, TYPE_CONFIG } from './PatternRenderers';
import { TypeAnalyticsCard } from './TypeAnalyticsCard';

const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
};

export function CreatorDashboard({ examCode, onBack, onSelectExam }) {
  const [data, setData] = useState(null);
  const [allExams, setAllExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [studentReport, setStudentReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const API = import.meta.env.VITE_API_URL || '/api';
  const api = axios.create({ baseURL: API });

  const loadAnalytics = async (code) => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/exams/${code}/analytics`);
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not fetch exam analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadAllExams = async () => {
    try {
      const res = await api.get('/exams');
      setAllExams(res.data || []);
    } catch (e) {}
  };

  useEffect(() => {
    if (examCode) {
      loadAnalytics(examCode);
    }
    loadAllExams();
  }, [examCode]);

  const handleCopyLink = () => {
    const origin = window.location.origin;
    const url = `${origin}/?code=${data?.exam?.code || examCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(data?.exam?.code || examCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const loadStudentReport = async (attemptId) => {
    setSelectedAttemptId(attemptId);
    setReportLoading(true);
    try {
      const res = await api.get(`/attempts/${attemptId}`);
      setStudentReport(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  };

  const filteredLeaderboard = (data?.leaderboard || []).filter((c) =>
    c.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.candidateEmail && c.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <main className="content">
        <div className="center loading-state">
          <div className="spinner" />
          <p>Loading Creator Dashboard & Student Submissions…</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="content">
        <div className="panel upload-panel center">
          <h2>Exam Dashboard</h2>
          <div className="error">{error || 'No exam selected'}</div>
          {allExams.length > 0 && (
            <div className="created-exams-picker">
              <h3>Select a Hosted Exam:</h3>
              <div className="exam-cards-list">
                {allExams.map((e) => (
                  <button
                    key={e.code}
                    type="button"
                    className="exam-picker-card"
                    onClick={() => {
                      onSelectExam(e.code);
                      loadAnalytics(e.code);
                    }}
                  >
                    <div>
                      <b>{e.title}</b>
                      <span>Code: <code>{e.code}</code> · {e.totalAttempts} submission(s)</span>
                    </div>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="secondary" onClick={onBack} style={{ marginTop: 20 }}>
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </main>
    );
  }

  const { exam, stats, leaderboard, batchPatternAnalytics } = data;
  const origin = window.location.origin;
  const shareUrl = `${origin}/?code=${exam.code}`;

  return (
    <main className="content creator-dashboard">
      {/* Top Header & Share Card */}
      <div className="creator-header-card panel">
        <div className="creator-title-block">
          <div className="creator-badge-row">
            <span className="eyebrow">CREATOR & TEACHER DASHBOARD</span>
            <span className="live-pulse-badge">● Live Submissions Active</span>
          </div>
          <h2>{exam.title}</h2>
          <p>
            Hosted by <b>{exam.creatorName}</b> · {exam.totalQuestions} Questions · {exam.config?.duration} Mins · Marking: +{exam.config?.positiveMarks} / -{exam.config?.negativeMarks}
          </p>
        </div>

        <div className="share-actions-card">
          <div className="code-display-box">
            <span className="share-label">EXAM CODE</span>
            <div className="code-value-row">
              <b className="exam-code-text">{exam.code}</b>
              <button
                type="button"
                className="copy-btn secondary"
                onClick={handleCopyCode}
                title="Copy Exam Code"
              >
                {copiedCode ? <Check size={14} className="green-icon" /> : <Copy size={14} />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="link-share-box">
            <span className="share-label">STUDENT JOIN LINK</span>
            <div className="link-input-row">
              <input type="text" readOnly value={shareUrl} className="share-url-input" />
              <button
                type="button"
                className="primary copy-link-btn"
                onClick={handleCopyLink}
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="creator-kpis-grid">
        <div className="kpi-card panel">
          <div className="kpi-icon-wrap blue-wrap">
            <Users size={22} />
          </div>
          <div>
            <b>{stats.totalCandidates}</b>
            <span>Total Candidates Attempted</span>
          </div>
        </div>

        <div className="kpi-card panel">
          <div className="kpi-icon-wrap gold-wrap">
            <Trophy size={22} />
          </div>
          <div>
            <b>{stats.highestScore} <small>/ {exam.totalQuestions * (exam.config?.positiveMarks || 1)}</small></b>
            <span>Highest Score Achieved</span>
          </div>
        </div>

        <div className="kpi-card panel">
          <div className="kpi-icon-wrap purple-wrap">
            <Target size={22} />
          </div>
          <div>
            <b>{stats.avgScore}</b>
            <span>Batch Average Score</span>
          </div>
        </div>

        <div className="kpi-card panel">
          <div className="kpi-icon-wrap green-wrap">
            <Clock3 size={22} />
          </div>
          <div>
            <b>{fmtTime(stats.avgTimeSeconds)}</b>
            <span>Average Time Spent</span>
          </div>
        </div>
      </div>

      {/* Batch Question Pattern Performance Matrix */}
      {batchPatternAnalytics && batchPatternAnalytics.length > 0 && (
        <div className="panel batch-pattern-card">
          <div className="section-head">
            <div>
              <h3>Batch Question-Pattern Breakdown</h3>
              <p>See which question categories your students mastered and where they faced difficulty.</p>
            </div>
          </div>
          <div className="batch-pattern-grid">
            {batchPatternAnalytics.map((pat) => {
              const conf = TYPE_CONFIG[pat.type] || TYPE_CONFIG.general_mcq;
              const Icon = conf.icon;
              return (
                <div
                  key={pat.type}
                  className="batch-pat-item"
                  style={{ borderLeftColor: conf.color }}
                >
                  <div className="pat-top">
                    <div className="pat-label-wrap">
                      <Icon size={15} color={conf.color} />
                      <b>{conf.label}</b>
                    </div>
                    <span className={`pat-acc-pill ${pat.avgAccuracy >= 65 ? 'good' : 'weak'}`}>
                      {pat.avgAccuracy.toFixed(1)}% Acc
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, pat.avgAccuracy))}%`,
                        backgroundColor: conf.color
                      }}
                    />
                  </div>
                  <span className="pat-attempts-sub">{pat.totalAttempted} total attempt(s)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidates Leaderboard Table */}
      <div className="panel leaderboard-panel">
        <div className="leaderboard-header">
          <div>
            <h3>Candidate Submissions & Leaderboard</h3>
            <p>Ranked live by score and submission speed.</p>
          </div>
          <div className="search-bar-wrap">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search candidate name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="student-search-input"
            />
          </div>
        </div>

        {filteredLeaderboard.length === 0 ? (
          <div className="empty-submissions-state">
            <Users size={40} className="gray-icon" />
            <b>No student submissions yet</b>
            <p>Share your Exam Code (<b>{exam.code}</b>) or Join Link with candidates to see results appear here in real-time.</p>
            <button className="primary" onClick={handleCopyLink}>
              <Copy size={15} /> Copy Student Join Link
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate Name</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Breakdown</th>
                  <th>Time Taken</th>
                  <th>Submitted At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((c, idx) => {
                  const rank = idx + 1;
                  return (
                    <tr key={c.attemptId} className={rank <= 3 ? `top-rank rank-${rank}` : ''}>
                      <td>
                        <span className={`rank-badge ${rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal'}`}>
                          {rank === 1 ? '🥇 1st' : rank === 2 ? '🥈 2nd' : rank === 3 ? '🥉 3rd' : `#${rank}`}
                        </span>
                      </td>
                      <td>
                        <div className="candidate-cell">
                          <b>{c.candidateName}</b>
                          {c.candidateEmail && <small>{c.candidateEmail}</small>}
                        </div>
                      </td>
                      <td>
                        <span className="score-cell">
                          <b>{Number(c.score).toFixed(2)}</b>
                          <small>/ {c.maxScore}</small>
                        </span>
                      </td>
                      <td>
                        <span className={`acc-cell-pill ${c.accuracy >= 70 ? 'acc-high' : c.accuracy >= 40 ? 'acc-mid' : 'acc-low'}`}>
                          {c.accuracy.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <div className="breakdown-pills">
                          <span className="mini-tag green">{c.correct}✓</span>
                          <span className="mini-tag red">{c.wrong}✗</span>
                          <span className="mini-tag gray">{c.unattempted}—</span>
                        </div>
                      </td>
                      <td>
                        <span className="time-cell">{fmtTime(c.timeSpentSeconds)}</span>
                      </td>
                      <td>
                        <span className="date-cell">{new Date(c.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="view-report-btn secondary"
                          onClick={() => loadStudentReport(c.attemptId)}
                        >
                          <span>View Report</span>
                          <ExternalLink size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Student Submission Modal */}
      {selectedAttemptId && (
        <div className="scratchpad-overlay" onClick={() => setSelectedAttemptId(null)}>
          <div className="scratchpad-modal student-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="scratchpad-header">
              <div className="report-modal-title">
                <Award size={18} />
                <b>Candidate Detailed Report: {studentReport?.attempt?.candidateName}</b>
              </div>
              <button
                type="button"
                className="iconbtn"
                onClick={() => setSelectedAttemptId(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="student-report-body">
              {reportLoading || !studentReport ? (
                <div className="center loading-state">
                  <div className="spinner" />
                  <p>Loading candidate response sheet…</p>
                </div>
              ) : (
                <div className="student-report-content">
                  <div className="report-stats-banner">
                    <div>
                      <span>Score</span>
                      <b>{Number(studentReport.attempt.result.score).toFixed(2)} / {studentReport.attempt.result.maxScore}</b>
                    </div>
                    <div>
                      <span>Accuracy</span>
                      <b>{studentReport.attempt.result.accuracy.toFixed(1)}%</b>
                    </div>
                    <div>
                      <span>Correct / Total</span>
                      <b>{studentReport.attempt.result.correct} / {studentReport.attempt.result.totalQuestions}</b>
                    </div>
                    <div>
                      <span>Time Taken</span>
                      <b>{fmtTime(studentReport.attempt.timeSpentSeconds)}</b>
                    </div>
                  </div>

                  <TypeAnalyticsCard typeResults={studentReport.attempt.result.typeResults || []} />

                  <h3 style={{ margin: '18px 0 10px' }}>Question Responses</h3>
                  <div className="review-rows-container">
                    {studentReport.attempt.result.questionResults.map((r) => {
                      const q = studentReport.exam?.questions?.find((x) => x.questionNumber === r.questionNumber);
                      return (
                        <div key={r.questionNumber} className="review-row-enhanced">
                          <div className="r-left">
                            <b>Q{r.questionNumber}</b>
                            <PatternBadge type={r.questionType} customLabel={r.questionTypeLabel} size="small" />
                          </div>
                          <div className="r-question-preview">
                            <span className="r-qtext">{q?.questionText || ''}</span>
                          </div>
                          <div className="r-ans-block">
                            <span className="ans-tag your-ans">
                              Candidate: <b>{r.selectedAnswer || 'None'}</b>
                            </span>
                            <span className="ans-tag correct-ans">
                              Key: <b>{r.correctAnswer || '—'}</b>
                            </span>
                          </div>
                          <span className={`status ${r.status}`}>{r.status}</span>
                          <span className="time-tag">{fmtTime(r.timeSpent)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
