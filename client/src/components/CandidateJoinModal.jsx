import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Play,
  KeyRound,
  User,
  Clock,
  HelpCircle,
  Award,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function CandidateJoinModal({ initialCode, onStartExam, onCancel }) {
  const [code, setCode] = useState(initialCode || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('examlens_token') || '';
  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('examlens_user') || 'null');
      if (savedUser) {
        if (savedUser.name) setName(savedUser.name);
        if (savedUser.email) setEmail(savedUser.email);
      }
    } catch (e) {}
  }, []);

  const fetchExamDetails = async (examCode) => {
    const clean = (examCode || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean || clean.length < 3) return null;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/exams/${clean}`);
      setExamData(res.data);
      return res.data;
    } catch (e) {
      setError(e.response?.data?.message || `No exam found for code "${clean}". Please verify with creator.`);
      setExamData(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      const clean = initialCode.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      setCode(clean);
      fetchExamDetails(clean);
    }
  }, [initialCode]);

  const handleCodeBlur = () => {
    if (code.trim()) {
      fetchExamDetails(code);
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    const clean = (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      setError('Please enter a valid exam code');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your full name to begin the exam');
      return;
    }

    let activeExam = examData;
    if (!activeExam || (activeExam.code && activeExam.code.toUpperCase() !== clean)) {
      activeExam = await fetchExamDetails(clean);
    }

    if (activeExam) {
      onStartExam({
        exam: activeExam,
        candidateName: name.trim(),
        candidateEmail: email.trim()
      });
    }
  };

  return (
    <div className="join-exam-wrapper panel">
      <div className="join-exam-head">
        <div className="join-icon-badge">
          <KeyRound size={20} />
        </div>
        <div>
          <h3>Join an Examination</h3>
          <p>Enter the 6-character exam code provided by your teacher or creator.</p>
        </div>
      </div>

      <form onSubmit={handleStart} className="join-form">
        <div className="form-group">
          <label>EXAM CODE</label>
          <div className="code-entry-row">
            <div className="input-with-icon code-input-field-wrap">
              <KeyRound size={16} className="input-icon" />
              <input
                type="text"
                placeholder="e.g. S3GAC9"
                value={code}
                maxLength={10}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/\s+/g, '');
                  setCode(val);
                  if (val.length >= 6) fetchExamDetails(val);
                }}
                onBlur={handleCodeBlur}
                className="code-input"
                required
              />
            </div>
            <button
              type="button"
              className="check-code-btn secondary"
              onClick={() => fetchExamDetails(code)}
              disabled={loading || !code.trim()}
            >
              {loading ? 'Checking…' : 'Verify'}
            </button>
          </div>
        </div>

        {examData && (
          <div className="exam-info-preview-box">
            <div className="info-preview-head">
              <span className="exam-ready-tag">
                <ShieldCheck size={13} /> Verified Exam
              </span>
              <span className="exam-author-tag">Hosted by {examData.creatorName}</span>
            </div>
            <h4>{examData.title}</h4>
            <div className="exam-specs-row">
              <div>
                <HelpCircle size={14} />
                <span>{examData.totalQuestions} Questions</span>
              </div>
              <div>
                <Clock size={14} />
                <span>{examData.config?.duration} Minutes</span>
              </div>
              <div>
                <Award size={14} />
                <span>+{examData.config?.positiveMarks} / -{examData.config?.negativeMarks} marks</span>
              </div>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="candidate-details-fields">
          <div className="form-group">
            <label>YOUR FULL NAME *</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Enter your name (shown on leaderboard)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>EMAIL / ROLL NUMBER (OPTIONAL)</label>
            <input
              type="text"
              placeholder="e.g. student@college.edu or Roll No"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="join-actions-row">
          {onCancel && (
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="primary start-test-btn"
            disabled={loading || !name.trim() || !code.trim()}
          >
            <span>Start Timed Exam</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}
