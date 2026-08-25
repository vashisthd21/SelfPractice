import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
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
  Trash2,
  Eye,
  History,
  Play,
  RotateCcw,
  Edit3,
  Filter,
  Layers,
  Sparkles,
  BookOpen,
  LayoutGrid,
  X
} from 'lucide-react';
import {
  PatternRenderer,
  PatternBadge,
  TYPE_CONFIG
} from './components/PatternRenderers';
import { ScratchPadModal } from './components/ScratchPadModal';
import { TypeAnalyticsCard } from './components/TypeAnalyticsCard';
import './styles.css';

const API = 'http://localhost:5000/api';
const api = axios.create({ baseURL: API });

const fmt = (s) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function App() {
  const [screen, setScreen] = useState('home');
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [key, setKey] = useState(null);
  const [keyIssues, setKeyIssues] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [duration, setDuration] = useState(30);
  const [pos, setPos] = useState(1);
  const [neg, setNeg] = useState(0.25);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  useEffect(() => {
    if (screen !== 'exam' || seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [screen, seconds]);

  useEffect(() => {
    if (screen === 'exam' && seconds === 0 && exam) {
      submitExam();
    }
  }, [seconds]);

  async function parseQuestions(file) {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/parse/questions', fd);
      if (!r.data.questions.length) throw new Error('No MCQ questions were detected.');
      setExam({
        title: file.name.replace(/\.pdf$/i, ''),
        questions: r.data.questions,
        warnings: r.data.warnings || [],
        config: { positiveMarks: pos, negativeMarks: neg }
      });
      setScreen('preview');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setAnswers({});
    setIdx(0);
    setSeconds(duration * 60);
    setScreen('exam');
  }

  function choose(v) {
    const q = exam.questions[idx];
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
    const q = exam.questions[idx];
    setAnswers((a) => ({
      ...a,
      [q.questionNumber]: {
        ...(a[q.questionNumber] || {}),
        markedForReview: !a[q.questionNumber]?.markedForReview,
        enteredAt: a[q.questionNumber]?.enteredAt || Date.now()
      }
    }));
  }

  function navigate(next) {
    const q = exam.questions[idx];
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
    setIdx(Math.max(0, Math.min(exam.questions.length - 1, next)));
  }

  async function submitExam() {
    if (!exam) return;
    setScreen('key');
  }

  async function parseKey(file) {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/parse/answer-key', fd);
      const parsed = r.data.answers || {};
      const missing = exam.questions.map((q) => q.questionNumber).filter((n) => parsed[n] === undefined);
      const invalid = exam.questions
        .map((q) => ({
          questionNumber: q.questionNumber,
          answer: parsed[q.questionNumber],
          options: Object.keys(q.options || {})
        }))
        .filter((x) => x.answer !== undefined && !x.options.includes(x.answer));

      setKey(parsed);
      if (missing.length || invalid.length) {
        setKeyIssues({ missing, invalid });
        setScreen('key-review');
      } else {
        const ev = await api.post('/evaluate', { exam, answers, answerKey: parsed });
        setResult(ev.data.result);
        setScreen('result');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function evaluateKey(finalKey) {
    setLoading(true);
    setError('');
    try {
      const ev = await api.post('/evaluate', { exam, answers, answerKey: finalKey });
      setKey(finalKey);
      setResult(ev.data.result);
      setScreen('result');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const r = await api.get('/attempts');
      setHistory(r.data);
      setScreen('history');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {screen === 'home' && <Home onCreate={() => setScreen('upload')} onHistory={loadHistory} />}
      {screen === 'upload' && (
        <UploadPage
          onFile={parseQuestions}
          loading={loading}
          error={error}
          duration={duration}
          setDuration={setDuration}
          pos={pos}
          setPos={setPos}
          neg={neg}
          setNeg={setNeg}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'preview' && (
        <Preview exam={exam} setExam={setExam} onStart={start} onBack={() => setScreen('upload')} />
      )}
      {screen === 'exam' && (
        <ExamPage
          exam={exam}
          answers={answers}
          idx={idx}
          seconds={seconds}
          choose={choose}
          toggleFlag={toggleFlag}
          navigate={navigate}
          onSubmit={submitExam}
          onOpenScratchpad={() => setScratchpadOpen(true)}
        />
      )}
      {screen === 'key' && (
        <KeyPage loading={loading} error={error} onFile={parseKey} onBack={() => setScreen('exam')} />
      )}
      {screen === 'key-review' && (
        <KeyReviewPage
          exam={exam}
          initialKey={key}
          issues={keyIssues}
          onEvaluate={evaluateKey}
          loading={loading}
          error={error}
        />
      )}
      {screen === 'result' && (
        <ResultPage
          exam={exam}
          result={result}
          onHome={() => setScreen('home')}
          onHistory={loadHistory}
        />
      )}
      {screen === 'history' && <HistoryPage items={history} onBack={() => setScreen('home')} />}

      <ScratchPadModal isOpen={scratchpadOpen} onClose={() => setScratchpadOpen(false)} />
    </>
  );
}

function Shell({ children, onBack }) {
  return (
    <div className="app">
      <header>
        <div className="brand" onClick={onBack || undefined}>
          <span className="brandmark">E</span>
          <div>
            <b>ExamLens</b>
            <small>AI Pattern Extraction · Exam Practice</small>
          </div>
        </div>
        {onBack && (
          <button className="ghost" onClick={onBack}>
            Back
          </button>
        )}
      </header>
      {children}
    </div>
  );
}

function Home({ onCreate, onHistory }) {
  return (
    <Shell>
      <main className="hero">
        <div className="hero-copy">
          <span className="eyebrow">SMART EXAM ENGINE</span>
          <h1>
            Auto-detect question patterns & practice with <em>interactive UI.</em>
          </h1>
          <p>
            Upload any exam PDF. ExamLens automatically detects question types—like Reading Comprehension,
            Syllogisms, Seating Arrangements, Coding-Decoding, Inequalities, and Para-Jumbles—and renders
            custom-built solving tools for each pattern.
          </p>
          <div className="actions">
            <button className="primary" onClick={onCreate}>
              <Upload size={18} />
              Upload Question Paper
            </button>
            <button className="secondary" onClick={onHistory}>
              <History size={18} />
              Previous Attempts
            </button>
          </div>
        </div>

        <div className="hero-card">
          <div className="mock-head">
            <span className="pattern-badge-demo">
              <Sparkles size={13} /> Syllogism Pattern
            </span>
            <span className="live">● ACTIVE SOLVER</span>
          </div>
          <div className="mock-syllogism">
            <div className="mock-stmt">
              <b>Statements:</b>
              <span>● Some books are papers.</span>
              <span>● All papers are files.</span>
            </div>
            <div className="mock-conc">
              <b>Conclusions:</b>
              <div className="mock-conc-row">
                <span>I. Some books are files.</span>
                <span className="mock-tag follows">Follows ✓</span>
              </div>
            </div>
          </div>
          <div className="mock-stats">
            <div>
              <b>30</b>
              <span>Questions</span>
            </div>
            <div>
              <b>8+</b>
              <span>Patterns</span>
            </div>
            <div>
              <b>Real-time</b>
              <span>Analytics</span>
            </div>
          </div>
        </div>
      </main>

      <section className="features">
        {[
          ['🧩', 'Pattern Recognition', 'Auto-classifies RC, Syllogisms, Circular Puzzles, Cloze Blanks, Inequalities & more.'],
          ['⚡', 'Interactive UI Modes', 'Live cloze-insertion, conclusion reasoning toggles, clue checklists & formula tools.'],
          ['📝', 'Built-in Scratchpad', 'Rough sheet drawing board and notes drawer to work through math and puzzles.'],
          ['📊', 'Pattern-Wise Analytics', 'See your exact accuracy and time spent broken down by each question category.']
        ].map((x) => (
          <div className="feature" key={x[0]}>
            <div className="icon">{x[0]}</div>
            <h3>{x[1]}</h3>
            <p>{x[2]}</p>
          </div>
        ))}
      </section>
    </Shell>
  );
}

function UploadPage({
  onFile,
  loading,
  error,
  duration,
  setDuration,
  pos,
  setPos,
  neg,
  setNeg,
  onBack
}) {
  return (
    <Shell onBack={onBack}>
      <main className="center">
        <div className="panel upload-panel">
          <span className="eyebrow">STEP 1 OF 3</span>
          <h2>Upload Question Paper</h2>
          <p>ExamLens will detect questions, passages, options and question patterns automatically.</p>

          <label className="drop">
            <Upload size={36} />
            <b>{loading ? 'Analyzing PDF & Extracting Patterns…' : 'Drop PDF here or click to browse'}</b>
            <span>PDF files up to 20 MB · Standard MCQ formats</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <div className="config">
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
              />
            </label>
            <label>
              Marks / Correct
              <input
                type="number"
                step="0.25"
                value={pos}
                onChange={(e) => setPos(+e.target.value)}
              />
            </label>
            <label>
              Negative Marks / Wrong
              <input
                type="number"
                step="0.05"
                value={neg}
                onChange={(e) => setNeg(+e.target.value)}
              />
            </label>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function Preview({ exam, setExam, onStart, onBack }) {
  const [edit, setEdit] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const typeCounts = useMemo(() => {
    const counts = {};
    (exam.questions || []).forEach((q) => {
      const t = q.questionType || 'general_mcq';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [exam]);

  const filteredQuestions = useMemo(() => {
    if (typeFilter === 'all') return exam.questions;
    return exam.questions.filter((q) => (q.questionType || 'general_mcq') === typeFilter);
  }, [exam, typeFilter]);

  return (
    <Shell onBack={onBack}>
      <main className="content">
        <div className="page-title">
          <div>
            <span className="eyebrow">STEP 2 · PREVIEW & PATTERN VERIFICATION</span>
            <h2>{exam.title}</h2>
            <p>
              {exam.questions.length} questions detected across {Object.keys(typeCounts).length} distinct pattern types
            </p>
          </div>
          <button className="primary" onClick={onStart}>
            <Play size={18} />
            Start Timed Exam
          </button>
        </div>

        <div className="pattern-filter-bar">
          <button
            type="button"
            className={`filter-chip ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All Questions ({exam.questions.length})
          </button>
          {Object.entries(typeCounts).map(([typeKey, count]) => {
            const conf = TYPE_CONFIG[typeKey] || TYPE_CONFIG.general_mcq;
            return (
              <button
                key={typeKey}
                type="button"
                className={`filter-chip ${typeFilter === typeKey ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeKey)}
              >
                <conf.icon size={13} />
                <span>{conf.label} ({count})</span>
              </button>
            );
          })}
        </div>

        {exam.warnings?.length > 0 && (
          <div className="warning">
            <b>Parser Notes</b>
            <ul>
              {exam.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="preview-grid">
          {filteredQuestions.map((q, i) => (
            <div className="question-card" key={q.questionNumber}>
              <div className="qtop">
                <div className="qtop-left">
                  <b>Q{q.questionNumber}</b>
                  <PatternBadge type={q.questionType} customLabel={q.questionTypeLabel} size="small" />
                </div>
                <span>{q.section}</span>
                <button
                  className="iconbtn"
                  onClick={() => setEdit(edit === i ? null : i)}
                  title="Toggle Edit"
                >
                  <Eye size={16} />
                </button>
              </div>

              {edit === i ? (
                <div className="editbox">
                  <label>
                    <small>Question Type:</small>
                    <select
                      value={q.questionType || 'general_mcq'}
                      onChange={(e) => {
                        const qs = [...exam.questions];
                        const realIdx = exam.questions.findIndex((x) => x.questionNumber === q.questionNumber);
                        qs[realIdx] = {
                          ...q,
                          questionType: e.target.value,
                          questionTypeLabel: TYPE_CONFIG[e.target.value]?.label || 'Multiple Choice'
                        };
                        setExam({ ...exam, questions: qs });
                      }}
                      className="type-select"
                    >
                      {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {q.passage && (
                    <textarea
                      value={q.passage}
                      placeholder="Passage / Context"
                      onChange={(e) => {
                        const qs = [...exam.questions];
                        const realIdx = exam.questions.findIndex((x) => x.questionNumber === q.questionNumber);
                        qs[realIdx] = { ...q, passage: e.target.value };
                        setExam({ ...exam, questions: qs });
                      }}
                    />
                  )}
                  <textarea
                    value={q.questionText}
                    placeholder="Question Text"
                    onChange={(e) => {
                      const qs = [...exam.questions];
                      const realIdx = exam.questions.findIndex((x) => x.questionNumber === q.questionNumber);
                      qs[realIdx] = { ...q, questionText: e.target.value };
                      setExam({ ...exam, questions: qs });
                    }}
                  />
                  {Object.entries(q.options).map(([k, v]) => (
                    <input
                      key={k}
                      value={v}
                      onChange={(e) => {
                        const qs = [...exam.questions];
                        const realIdx = exam.questions.findIndex((x) => x.questionNumber === q.questionNumber);
                        qs[realIdx] = { ...q, options: { ...q.options, [k]: e.target.value } };
                        setExam({ ...exam, questions: qs });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="preview-rendered-box">
                  <PatternRenderer
                    question={q}
                    selectedOption={null}
                    onSelectOption={() => {}}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </Shell>
  );
}

function ExamPage({
  exam,
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
      {/* Mobile Palette Backdrop */}
      {showPalette && (
        <div className="palette-backdrop" onClick={() => setShowPalette(false)} />
      )}

      <header className="exam-header">
        <div className="brand exam-brand">
          <span className="brandmark">E</span>
          <div className="brand-text-block">
            <b>{exam.title}</b>
            <div className="exam-type-subline">
              <PatternBadge type={q.questionType} customLabel={q.questionTypeLabel} size="small" />
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

          {/* Specialized Pattern Workspace */}
          <div className="pattern-work-area">
            <PatternRenderer
              question={q}
              selectedOption={selected}
              onSelectOption={choose}
            />
          </div>

          {/* Bottom Nav Bar */}
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

function KeyPage({ onFile, loading, error, onBack }) {
  return (
    <Shell onBack={onBack}>
      <main className="center">
        <div className="panel upload-panel">
          <span className="eyebrow">STEP 3 OF 3</span>
          <h2>Upload Answer Key</h2>
          <p>Your attempt has been saved. Upload the official answer-key PDF to evaluate your results.</p>
          <label className="drop">
            <FileText size={36} />
            <b>{loading ? 'Evaluating & Scoring…' : 'Upload Answer-Key PDF'}</b>
            <span>Supports standard keys, tables, and compact keys (e.g., “1 B”, “Q1: B”)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
            />
          </label>
          {error && <div className="error">{error}</div>}
        </div>
      </main>
    </Shell>
  );
}

function KeyReviewPage({ exam, initialKey, issues, onEvaluate, loading, error }) {
  const [local, setLocal] = useState({ ...initialKey });
  const fixable = [
    ...(issues?.missing || []).map((n) => ({
      questionNumber: n,
      answer: null,
      options: Object.keys(exam.questions.find((q) => q.questionNumber === n)?.options || {})
    })),
    ...(issues?.invalid || [])
  ];

  return (
    <Shell>
      <main className="content">
        <div className="page-title">
          <div>
            <span className="eyebrow">ANSWER KEY VALIDATION</span>
            <h2>Review Extracted Answer Key</h2>
            <p>The PDF answer key contains missing or mismatching options that require confirmation.</p>
          </div>
        </div>
        <div className="panel key-review">
          <div className="key-issue-list">
            {fixable.map((item) => {
              const q = exam.questions.find((x) => x.questionNumber === item.questionNumber);
              const opts = Object.keys(q?.options || {});
              return (
                <div className="key-issue" key={item.questionNumber}>
                  <div>
                    <b>Question {item.questionNumber}</b>
                    <span>{item.answer ? `Extracted answer: ${item.answer}` : 'Answer missing from key'}</span>
                  </div>
                  <select
                    value={local[item.questionNumber] || ''}
                    onChange={(e) => setLocal({ ...local, [item.questionNumber]: e.target.value })}
                  >
                    <option value="">Select answer</option>
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="actions bottom">
            <button
              className="primary"
              disabled={loading || fixable.some((x) => !local[x.questionNumber])}
              onClick={() => onEvaluate(local)}
            >
              {loading ? 'Evaluating…' : 'Confirm & Calculate Result'}
            </button>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function ResultPage({ exam, result, onHome, onHistory }) {
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewTypeFilter, setReviewTypeFilter] = useState('all');

  const pie = [
    { name: 'Correct', value: result.correct, color: '#10b981' },
    { name: 'Wrong', value: result.wrong, color: '#ef4444' },
    { name: 'Unattempted', value: result.unattempted, color: '#94a3b8' }
  ];

  const filteredResults = useMemo(() => {
    return result.questionResults.filter((r) => {
      if (reviewFilter !== 'all' && r.status !== reviewFilter) return false;
      if (reviewTypeFilter !== 'all' && r.questionType !== reviewTypeFilter) return false;
      return true;
    });
  }, [result, reviewFilter, reviewTypeFilter]);

  const availableTypes = useMemo(() => {
    const set = new Set();
    result.questionResults.forEach((r) => set.add(r.questionType || 'general_mcq'));
    return Array.from(set);
  }, [result]);

  return (
    <Shell>
      <main className="content">
        <div className="result-hero">
          <div>
            <span className="eyebrow">SCORECARD & PERFORMANCE</span>
            <h2>{exam.title}</h2>
            <p>Here is your comprehensive test breakdown and pattern-wise analytics.</p>
          </div>
          <div className="score">
            <b>{Number(result.score).toFixed(2)}</b>
            <span>/ {result.maxScore}</span>
          </div>
        </div>

        <div className="kpis">
          <Kpi icon={<CheckCircle2 className="green-icon" />} label="Correct" value={result.correct} />
          <Kpi icon={<XCircle className="red-icon" />} label="Wrong" value={result.wrong} />
          <Kpi icon={<MinusCircle className="gray-icon" />} label="Unattempted" value={result.unattempted} />
          <Kpi label="Overall Accuracy" value={`${result.accuracy.toFixed(1)}%`} />
          <Kpi label="Attempt Rate" value={`${result.attemptRate.toFixed(1)}%`} />
        </div>

        <TypeAnalyticsCard typeResults={result.typeResults || []} />

        <div className="charts">
          <div className="panel chart">
            <h3>Answer Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                >
                  {pie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="panel chart">
            <h3>Section Accuracy</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={result.sectionResults}>
                <XAxis dataKey="sectionName" hide />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Bar dataKey="accuracy" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="section-labels">
              {result.sectionResults.map((s) => (
                <span key={s.sectionName}>
                  <b>{s.accuracy.toFixed(0)}%</b> {s.sectionName}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="panel review">
          <div className="review-head">
            <div>
              <h3>Question-by-Question Review</h3>
              <span>
                {result.correct} correct · {result.wrong} wrong · {result.unattempted} unattempted
              </span>
            </div>

            <div className="review-filters">
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
                className="review-select"
              >
                <option value="all">All Statuses</option>
                <option value="correct">Correct Only</option>
                <option value="wrong">Wrong Only</option>
                <option value="unattempted">Unattempted Only</option>
              </select>

              <select
                value={reviewTypeFilter}
                onChange={(e) => setReviewTypeFilter(e.target.value)}
                className="review-select"
              >
                <option value="all">All Question Types</option>
                {availableTypes.map((t) => {
                  const conf = TYPE_CONFIG[t] || TYPE_CONFIG.general_mcq;
                  return (
                    <option key={t} value={t}>
                      {conf.label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="review-rows-container">
            {filteredResults.map((r) => {
              const q = exam.questions.find((x) => x.questionNumber === r.questionNumber);
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
          <button className="secondary" onClick={onHistory}>
            <History size={17} />
            History
          </button>
          <button className="primary" onClick={onHome}>
            Create Another Exam
          </button>
        </div>
      </main>
    </Shell>
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

function HistoryPage({ items, onBack }) {
  return (
    <Shell onBack={onBack}>
      <main className="content">
        <div className="page-title">
          <div>
            <span className="eyebrow">PRACTICE HISTORY</span>
            <h2>Previous Attempts</h2>
          </div>
        </div>
        <div className="panel history">
          <table>
            <thead>
              <tr>
                <th>Exam</th>
                <th>Date</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Attempted</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.examTitle}</b>
                  </td>
                  <td>{new Date(x.createdAt).toLocaleString()}</td>
                  <td>
                    {Number(x.score).toFixed(2)} / {x.maxScore}
                  </td>
                  <td>{x.accuracy.toFixed(1)}%</td>
                  <td>
                    {x.attempted}/{x.totalQuestions}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan="5">No attempts recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </Shell>
  );
}

createRoot(document.getElementById('root')).render(<App />);
