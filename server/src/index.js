import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MAX_MB = Number(process.env.MAX_FILE_SIZE_MB || 20);

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (r, f, cb) => cb(null, f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf'))
});

const dataDir = path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });
const attemptsFile = path.join(dataDir, 'attempts.json');
if (!fs.existsSync(attemptsFile)) fs.writeFileSync(attemptsFile, '[]');
const readAttempts = () => JSON.parse(fs.readFileSync(attemptsFile, 'utf8'));
const writeAttempts = (x) => fs.writeFileSync(attemptsFile, JSON.stringify(x, null, 2));

async function pdfText(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  let pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const c = await p.getTextContent();
    pages.push(c.items.map((x) => x.str).join(' '));
  }
  return pages.join('\n');
}

function clean(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function normalizeOptionLabel(label) {
  const u = String(label).toUpperCase();
  return /^[A-H]$/.test(u) ? u : ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' }[u] || u);
}

// Automatic question type and pattern classifier
function classifyQuestion(q, fullContext = {}) {
  const text = (q.questionText || '').trim();
  const rawContext = (q.passage || fullContext.passage || '').trim();
  const dir = (q.directions || fullContext.directions || '').trim();
  const section = (q.section || fullContext.section || '').trim();
  const combined = `${section} ${dir} ${rawContext} ${text}`;
  const options = q.options || {};
  const optValues = Object.values(options).map((v) => (v || '').trim());

  // 1. Direction & Distance
  if (
    /direction|distance/i.test(section) ||
    (/walks\s+\d+\s*(?:m|metres|km)/i.test(text) && /turns\s+(?:left|right|north|south|east|west)|north|south|east|west/i.test(text)) ||
    /starting point/i.test(text)
  ) {
    return {
      type: 'direction_distance',
      label: 'Direction & Distance',
      typeData: { prompt: text }
    };
  }

  // 2. Blood Relation
  if (
    /blood\s*relation/i.test(section) ||
    /how is .* related to|mother of|father of|sister of|brother of|grandfather|daughter of|son of|husband of|wife of/i.test(text)
  ) {
    return {
      type: 'blood_relation',
      label: 'Blood Relation',
      typeData: { prompt: text }
    };
  }

  // 3. Syllogism (plural statements with standard quantifiers)
  if (
    /syllogism/i.test(section) ||
    (/statements?\s*:\s*[\s\S]*?(?:all|some|no|only a few)\b/i.test(text) && /conclusions?\s*:/i.test(text))
  ) {
    const sm = text.match(/statements?\s*:\s*([\s\S]*?)(?=conclusions?\s*:)/i);
    const cm = text.match(/conclusions?\s*:\s*([\s\S]*)$/i);
    const statements = sm
      ? sm[1].split(/\n|\.\s+|•/).map((s) => s.trim().replace(/^[-•*]\s*/, '')).filter((s) => s.length > 2)
      : [];
    const conclusions = cm
      ? cm[1].split(/(?=(?:I{1,3}|IV|V)\s*[.)])/i).map((c) => c.trim()).filter((c) => c.length > 2)
      : [];
    return {
      type: 'syllogism',
      label: 'Syllogism',
      typeData: {
        statements: statements.length ? statements : [sm ? sm[1].trim() : ''],
        conclusions: conclusions.length ? conclusions : [cm ? cm[1].trim() : '']
      }
    };
  }

  // 4. Statement & Conclusion / Assumption
  if (
    /statement\s*&?\s*conclusion/i.test(section) ||
    (/statement\s*:/i.test(text) && /conclusions?\s*:/i.test(text))
  ) {
    const sm = text.match(/statement\s*:\s*([\s\S]*?)(?=conclusions?\s*:)/i);
    const cm = text.match(/conclusions?\s*:\s*([\s\S]*)$/i);
    const statement = sm ? sm[1].trim() : '';
    const conclusions = cm
      ? cm[1].split(/(?=(?:I{1,3}|IV|V)\s*[.)])/i).map((c) => c.trim()).filter((c) => c.length > 2)
      : [];
    return {
      type: 'statement_conclusion',
      label: 'Statement & Conclusion',
      typeData: { statement, conclusions }
    };
  }

  // 5. Inequality
  if (
    /inequality/i.test(section) ||
    (/^[A-Z0-9]\s*[><=≥≤≠]/i.test(text) || /[><=≥≤≠].*[><=≥≤≠]/.test(text))
  ) {
    const exprMatch = text.match(/([A-Z0-9]\s*(?:[><=≥≤≠]|>=|<=)\s*[A-Z0-9](?:\s*(?:[><=≥≤≠]|>=|<=)\s*[A-Z0-9])+)/i);
    return {
      type: 'inequality',
      label: 'Inequality',
      typeData: {
        expression: exprMatch ? exprMatch[1].trim() : text.split(/\n|\?/)[0].trim()
      }
    };
  }

  // 6. Input-Output Machine
  if (
    /input\s*[-–—]?\s*output/i.test(section) ||
    /machine rearranges/i.test(combined) ||
    /Input\s*:/i.test(rawContext) ||
    /Input\s*:/i.test(text)
  ) {
    const src = rawContext.includes('Input:') ? rawContext : text;
    const inputMatch = src.match(/Input\s*:\s*(.*?)(?=\n|Step|$)/i);
    const stepMatches = [...src.matchAll(/(Step\s+[I|V|X\d]+)\s*:\s*(.*?)(?=\n\s*Step|\n\s*Question|\n\s*\d+\.|$)/gi)];
    const steps = stepMatches.map((m) => ({ step: m[1].trim(), text: m[2].trim() }));
    return {
      type: 'input_output',
      label: 'Input-Output',
      typeData: {
        inputLine: inputMatch ? inputMatch[1].trim() : '',
        steps
      }
    };
  }

  // 7. Coding-Decoding
  if (
    /coding\s*[-–—]?\s*decoding/i.test(section) ||
    /is coded as/i.test(rawContext) ||
    /is coded as/i.test(text)
  ) {
    const src = rawContext.includes('coded as') ? rawContext : text;
    const pairs = [];
    const pairRe = /[“"']([^"”']+)["”']\s+is\s+coded\s+as\s+[“"']([^"”']+)["”']/gi;
    let m;
    while ((m = pairRe.exec(src))) {
      pairs.push({ phrase: m[1].trim(), code: m[2].trim() });
    }
    const targetMatch = text.match(/code\s+for\s+[“"']?([^"”'?]+)["”']?/i);
    return {
      type: 'coding_decoding',
      label: 'Coding-Decoding',
      typeData: {
        rules: pairs,
        targetWord: targetMatch ? targetMatch[1].trim() : ''
      }
    };
  }

  // 8. Alphanumeric Series
  if (
    /alphanumeric/i.test(section) ||
    (/sequence\s+carefully/i.test(combined) && /[A-Z0-9]\s+[A-Z0-9]/.test(rawContext))
  ) {
    const seriesMatch = rawContext.match(/([A-Z0-9](?:\s+[A-Z0-9]){7,})/i);
    return {
      type: 'alphanumeric_series',
      label: 'Alphanumeric Series',
      typeData: {
        series: seriesMatch ? seriesMatch[1].trim() : rawContext.trim()
      }
    };
  }

  // 9. Seating Arrangement & Puzzles (Clean Clues & Setup Extraction)
  if (
    /puzzle|seating/i.test(section) ||
    /sitting around|facing the centre|circular table|linear row|floor|box puzzle|immediate neighbour/i.test(combined)
  ) {
    const raw = (rawContext || dir || '').trim();
    const clueLines = [];
    let setupText = '';
    const parts = raw.split(/\n|•/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (/^Directions/i.test(p) || /sitting around|facing the centre|eight persons|seven persons|six persons|are sitting/i.test(p)) {
        setupText = setupText ? `${setupText} ${p}` : p;
      } else if (p.length > 3) {
        clueLines.push(p.replace(/^[-•*]\s*/, ''));
      }
    }
    const arrangementType = /circular|round|circle/i.test(combined)
      ? 'circular'
      : /linear|row|north|south/i.test(combined)
      ? 'linear'
      : /floor|box/i.test(combined)
      ? 'floor'
      : 'puzzle';
    return {
      type: 'puzzle_seating',
      label: arrangementType === 'circular' ? 'Circular Seating' : arrangementType === 'linear' ? 'Linear Seating' : 'Puzzle / Seating',
      typeData: {
        setupText: setupText || 'Eight persons A, B, C, D, E, F, G and H are sitting around a circular table, facing the centre.',
        clues: clueLines,
        arrangementType
      }
    };
  }

  // 10. Vocabulary & Word Usage
  if (
    /closest in meaning|most nearly means|opposite in meaning|synonym|antonym|used correctly|word closest/i.test(text) ||
    (/vocabulary/i.test(section) && !/rearrange/i.test(text) && !/^[A-E]{4}$/i.test(optValues[0] || ''))
  ) {
    return {
      type: 'vocabulary',
      label: 'Vocabulary & Usage',
      typeData: { prompt: text }
    };
  }

  // 11. Odd One Out
  if (/odd\s*one\s*out|different from the other/i.test(combined) || /^Odd One Out/i.test(text)) {
    return {
      type: 'odd_one_out',
      label: 'Odd One Out',
      typeData: { prompt: text }
    };
  }

  // 12. Order & Ranking
  if (
    /ranking|order/i.test(section) ||
    /ranks?\s+\d+(?:st|nd|rd|th)\s+from/i.test(text) ||
    /taller than|shorter than|heavier than/i.test(text) ||
    /^Ranking\b/i.test(text)
  ) {
    return {
      type: 'order_ranking',
      label: 'Order & Ranking',
      typeData: { prompt: text }
    };
  }

  // 13. Cloze Test
  if (/cloze/i.test(section) || (rawContext && /\(\d{1,3}\)/.test(rawContext))) {
    const blankMatch = text.match(/\b(?:blank\s*)?\(?(\d{1,3})\)?/i) || [null, String(q.questionNumber)];
    return {
      type: 'cloze_test',
      label: 'Cloze Test',
      typeData: {
        blankNumber: blankMatch[1] ? Number(blankMatch[1]) : q.questionNumber,
        passage: rawContext
      }
    };
  }

  // 14. Para Jumble / Sentence Rearrangement
  const isJumbleOptions = optValues.length >= 3 && optValues.every((v) => /^[A-E]{3,6}$/i.test(v));
  if (
    /rearrange the following/i.test(text) ||
    isJumbleOptions ||
    (/para\s*jumble/i.test(section) && /[A-E]\.\s+/.test(text))
  ) {
    const sentenceMatches = [...text.matchAll(/(?:^|\n|\s)([A-E])\.\s*(.+?)(?=(?:\s+[A-E]\.|$))/g)];
    const sentences = {};
    if (sentenceMatches.length >= 3) {
      sentenceMatches.forEach((m) => {
        sentences[m[1].toUpperCase()] = m[2].trim();
      });
    }
    return {
      type: 'para_jumble',
      label: 'Para Jumble',
      typeData: {
        sentences
      }
    };
  }

  // 15. Error Detection
  const hasSlashSeparators = (text.match(/\//g) || []).length >= 2;
  const hasNoErrorOption = optValues.some((v) => /no error/i.test(v));
  if (/error\s*detection|spotting\s*error/i.test(section) || (hasSlashSeparators && hasNoErrorOption)) {
    const parts = text.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
    return {
      type: 'error_detection',
      label: 'Error Detection',
      typeData: {
        segments: parts
      }
    };
  }

  // 16. Phrase Replacement / Sentence Improvement
  const hasNoImprovementOption = optValues.some((v) => /no improvement|no correction/i.test(v));
  if (/phrase\s*replacement|sentence\s*improvement/i.test(section) || hasNoImprovementOption) {
    return {
      type: 'phrase_replacement',
      label: 'Phrase Replacement',
      typeData: {
        fullText: text
      }
    };
  }

  // 17. Fillers / Sentence Completion
  if (/fillers?|fill in the blank/i.test(section) || /_{3,}|\.{4,}/.test(text)) {
    return {
      type: 'fillers',
      label: 'Fillers',
      typeData: {
        sentence: text
      }
    };
  }

  // 18. Reading Comprehension
  if (
    /reading\s*comprehension|\bRC\b/i.test(section) ||
    (rawContext && rawContext.length > 120 && !/cloze/i.test(section))
  ) {
    return {
      type: 'reading_comprehension',
      label: 'Reading Comprehension',
      typeData: {
        passage: rawContext
      }
    };
  }

  return {
    type: 'general_mcq',
    label: 'Multiple Choice',
    typeData: {}
  };
}

// Flexible parser for standard MCQ PDFs with multi-pattern extraction
function parseQuestions(text) {
  let t = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\uf0b7\uf0a7\uf0d8\u25cf\u2219]/g, ' • ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  // Pre-split on structural landmarks
  t = t.replace(/\s+(?=(?:Section|SECTION|Part|PART)\s+[A-Z0-9]+\s*[:—–-])/gi, '\n');
  t = t.replace(/\s+(?=Directions?\s*(?:\([^)]*\))?(?:\s*:)?)/gi, '\n');
  t = t.replace(/\s*•\s*/g, '\n• ');
  t = t.replace(/\s+(?=(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)]\s+(?:[A-Za-z0-9"“'\[]|Statements?|Input:|Step\s+I|Directions))/gi, '\n');
  // Only split options if not followed by a question number
  t = t.replace(/\s+(?=\(?[A-H]\)?\s*[.)]\s+(?!\d{1,3}\s*[.)])[A-Za-z0-9"“'\[])/g, '\n');

  const lines = t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const questions = [];
  let section = 'General';
  let sectionDirections = '';
  let sectionContext = '';
  let collectingContext = false;
  let current = null;
  let currentOpt = null;

  const sectionRe = /^(?:Section|Part)\s+([A-Z0-9]+)\s*[:—–-]\s*(.+)$/i;
  const directionsRe = /^Directions?\s*(?:\(([^)]*)\))?\s*:?(.*)$/i;
  const qRe = /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*(?:[.)]|:)?\s*(.*)$/i;
  const optRe = /^\(?([A-H]|[1-8])\)?\s*[.)]\s+(.*)$/i;

  const looksLikeQuestionNumber = (line) => {
    const m = line.match(qRe);
    if (!m) return false;
    const n = Number(m[1]);
    return (
      n >= 1 &&
      n <= 999 &&
      (/^\d{1,3}\s*[.)]\s*/.test(line) || /^Q(?:uestion)?\s*\d{1,3}/i.test(line) || /^\d{1,3}\s*$/.test(line))
    );
  };

  const meaningfulContext = (v) => clean(v).length >= 20;
  const attachContext = (q) => {
    if (sectionDirections) q.directions = sectionDirections;
    const context = sectionContext.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    if (meaningfulContext(context)) q.passage = context;
  };

  const pushCurrent = () => {
    if (!current) return;
    if (!current.questionText) {
      current.questionText = section.toLowerCase().includes('cloze')
        ? `Choose the most suitable word for blank ${current.questionNumber}.`
        : 'Answer the question using the information provided above.';
    }
    attachContext(current);
    const classification = classifyQuestion(current, {
      section,
      directions: sectionDirections,
      passage: sectionContext
    });
    current.questionType = classification.type;
    current.questionTypeLabel = classification.label;
    current.typeData = classification.typeData;

    questions.push(current);
    current = null;
    currentOpt = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const sm = line.match(sectionRe);
    if (sm) {
      pushCurrent();
      let rawSectionTitle = clean(sm[2] || '');

      // If a question number was attached inline to section title, split it
      const inlineQ = rawSectionTitle.match(/^(.*?)\s+(?=(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)]\s+)/i);
      if (inlineQ) {
        const leftover = rawSectionTitle.slice(inlineQ[1].length).trim();
        rawSectionTitle = inlineQ[1].trim();
        lines.splice(i + 1, 0, leftover);
      }

      const inlineDir = rawSectionTitle.match(/^(.*?)(?:\s+)?Directions?\s*(?:\(([^)]*)\))?\s*:?(.*)$/i);
      if (inlineDir && /Directions?/i.test(rawSectionTitle)) {
        section = `Section ${sm[1]} — ${clean(inlineDir[1])}`;
        sectionDirections = clean(`Directions${inlineDir[2] ? ` (${inlineDir[2]})` : ''} ${inlineDir[3] || ''}`);
        sectionContext = '';
        collectingContext = true;
      } else {
        section = `Section ${sm[1]} — ${rawSectionTitle}`;
        sectionDirections = '';
        sectionContext = '';
        collectingContext = false;
      }
      continue;
    }

    const dm = line.match(directionsRe);
    if (dm) {
      sectionDirections = clean(`${dm[1] ? `Directions (${dm[1]})` : 'Directions'} ${dm[2] || ''}`);
      sectionContext = '';
      collectingContext = true;
      continue;
    }

    const qmCandidate = line.match(qRe);
    const candidateNumber = qmCandidate ? Number(qmCandidate[1]) : null;
    const lastNumber = current?.questionNumber ?? (questions.length ? questions[questions.length - 1].questionNumber : 0);
    const isSequentialQuestion = !!qmCandidate && candidateNumber === lastNumber + 1;

    if (looksLikeQuestionNumber(line) && (candidateNumber > 5 || isSequentialQuestion || !current)) {
      pushCurrent();
      current = {
        questionNumber: candidateNumber,
        questionText: clean(qmCandidate[2] || ''),
        options: {},
        section
      };
      currentOpt = null;
      collectingContext = false;
      continue;
    }

    const om = line.match(optRe);
    if (om && current) {
      const label = normalizeOptionLabel(om[1]);
      if (Object.prototype.hasOwnProperty.call(current.options, label)) {
        const previous = Object.entries(current.options)
          .map(([k, v]) => `${k}. ${v}`)
          .join(' ');
        current.questionText = clean(`${current.questionText} ${previous}`);
        current.options = {};
      }
      current.options[label] = clean(om[2]);
      currentOpt = label;
      continue;
    }

    if (looksLikeQuestionNumber(line)) {
      const qm = line.match(qRe);
      pushCurrent();
      current = {
        questionNumber: Number(qm[1]),
        questionText: clean(qm[2] || ''),
        options: {},
        section
      };
      currentOpt = null;
      collectingContext = false;
      continue;
    }

    if (current) {
      if (currentOpt) {
        current.options[currentOpt] = clean(`${current.options[currentOpt]} ${line}`);
      } else {
        current.questionText = clean(`${current.questionText} ${line}`);
      }
    } else if (collectingContext) {
      sectionContext = sectionContext ? `${sectionContext}\n${line}` : line;
    }
  }
  pushCurrent();

  // Keep strongest occurrence if duplicated
  const unique = new Map();
  for (const q of questions) {
    const options = Object.fromEntries(Object.entries(q.options || {}).filter(([k, v]) => v));
    const normalized = { ...q, questionText: clean(q.questionText), options };
    const old = unique.get(normalized.questionNumber);
    const score = (x) => Object.keys(x.options || {}).length * 10 + (x.questionText?.length || 0);
    if (!old || score(normalized) > score(old)) unique.set(normalized.questionNumber, normalized);
  }

  const parsed = [...unique.values()].sort((a, b) => a.questionNumber - b.questionNumber);
  const warnings = [];
  parsed.forEach((q) => {
    const optionCount = Object.keys(q.options).length;
    if (!q.questionText) warnings.push(`Q${q.questionNumber}: question text is empty`);
    if (optionCount < 2) warnings.push(`Q${q.questionNumber}: only ${optionCount} option(s) detected`);
  });
  return { questions: parsed, warnings };
}

function parseAnswerKey(text) {
  const normalizeAnswer = (value) => {
    const u = String(value).toUpperCase();
    return /^[A-H]$/.test(u) ? u : ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' }[u] || u);
  };
  const cleanText = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\uf0b7\uf0a7\uf0d8\u25cf\u2219]/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ');
  const out = {};

  const patterns = [
    /Q(?:uestion)?\s*(\d{1,3})\s*[:=\-. )]?\s*\(?([A-Z1-8])\)?(?=\s|\d|$|⚠)/gi,
    /(?:^|\s)(\d{1,3})\s*[:=\-. )]?\s*\(?([A-Z1-8])\)?(?=\s|\d|$|⚠)/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(cleanText))) {
      const n = Number(m[1]);
      if (n > 0 && n < 1000) out[n] = normalizeAnswer(m[2]);
    }
  }
  return out;
}

function evaluate(exam, answers, key) {
  const cfg = exam.config || { positiveMarks: 1, negativeMarks: 0 };
  let correct = 0,
    wrong = 0,
    unattempted = 0,
    score = 0;
  const results = [];

  for (const q of exam.questions) {
    const selected = (answers[q.questionNumber]?.selectedOption || null)?.toUpperCase() || null;
    const correctAnswer = key[q.questionNumber] || null;
    let status = 'unattempted',
      marks = 0;

    if (!selected) {
      unattempted++;
    } else if (selected === correctAnswer) {
      correct++;
      status = 'correct';
      marks = Number(cfg.positiveMarks) || 1;
      score += marks;
    } else {
      wrong++;
      status = 'wrong';
      marks = -(Number(cfg.negativeMarks) || 0);
      score += marks;
    }

    results.push({
      questionNumber: q.questionNumber,
      selectedAnswer: selected,
      correctAnswer,
      status,
      timeSpent: Number(answers[q.questionNumber]?.timeSpent || 0),
      marksObtained: marks,
      questionType: q.questionType || 'general_mcq',
      questionTypeLabel: q.questionTypeLabel || 'Multiple Choice'
    });
  }

  const attempted = correct + wrong;
  const total = exam.questions.length;

  // Section-wise analytics
  const sections = {};
  for (const r of results) {
    const q = exam.questions.find((x) => x.questionNumber === r.questionNumber);
    const s = q?.section || 'General';
    sections[s] ||= { sectionName: s, total: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, time: 0 };
    const z = sections[s];
    z.total++;
    z.time += r.timeSpent;
    if (r.status === 'correct') {
      z.correct++;
      z.attempted++;
    } else if (r.status === 'wrong') {
      z.wrong++;
      z.attempted++;
    } else {
      z.unattempted++;
    }
  }
  const sectionResults = Object.values(sections).map((s) => ({
    ...s,
    accuracy: s.attempted ? (s.correct / s.attempted) * 100 : 0,
    averageTime: s.total ? s.time / s.total : 0
  }));

  // Type-wise analytics
  const types = {};
  for (const r of results) {
    const t = r.questionType || 'general_mcq';
    const label = r.questionTypeLabel || 'Multiple Choice';
    types[t] ||= { type: t, label, total: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, time: 0 };
    const z = types[t];
    z.total++;
    z.time += r.timeSpent;
    if (r.status === 'correct') {
      z.correct++;
      z.attempted++;
    } else if (r.status === 'wrong') {
      z.wrong++;
      z.attempted++;
    } else {
      z.unattempted++;
    }
  }
  const typeResults = Object.values(types).map((t) => ({
    ...t,
    accuracy: t.attempted ? (t.correct / t.attempted) * 100 : 0,
    averageTime: t.total ? t.time / t.total : 0
  }));

  return {
    totalQuestions: total,
    attempted,
    correct,
    wrong,
    unattempted,
    score,
    maxScore: total * (Number(cfg.positiveMarks) || 1),
    accuracy: attempted ? (correct / attempted) * 100 : 0,
    attemptRate: total ? (attempted / total) * 100 : 0,
    questionResults: results,
    sectionResults,
    typeResults
  };
}

function qOptions(exam, n) {
  const q = exam.questions.find((x) => x.questionNumber === n);
  return q?.options || {};
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/parse/questions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF is required' });
    const text = await pdfText(req.file.buffer);
    const parsed = parseQuestions(text);
    res.json({
      questions: parsed.questions,
      warnings: parsed.warnings,
      totalQuestions: parsed.questions.length,
      rawTextLength: text.length
    });
  } catch (e) {
    res.status(500).json({ message: 'Could not parse question PDF', error: e.message });
  }
});

app.post('/api/parse/answer-key', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF is required' });
    const text = await pdfText(req.file.buffer);
    const answers = parseAnswerKey(text);
    res.json({
      answers,
      totalAnswers: Object.keys(answers).length,
      invalidAnswers: Object.entries(answers)
        .filter(([, a]) => !/[A-E]/.test(a))
        .map(([q, a]) => ({ questionNumber: Number(q), answer: a }))
    });
  } catch (e) {
    res.status(500).json({ message: 'Could not parse answer-key PDF', error: e.message });
  }
});

app.post('/api/evaluate', (req, res) => {
  try {
    const { exam, answers, answerKey } = req.body;
    if (!exam?.questions || !answerKey) return res.status(400).json({ message: 'Exam and answer key are required' });

    const missing = exam.questions.map((q) => q.questionNumber).filter((n) => answerKey[n] === undefined);
    if (missing.length) {
      return res.status(400).json({ message: `Answer key is missing: ${missing.join(', ')}`, missing });
    }

    const invalid = exam.questions
      .map((q) => ({ questionNumber: q.questionNumber, answer: answerKey[q.questionNumber] }))
      .filter((x) => x.answer && !Object.prototype.hasOwnProperty.call(qOptions(exam, x.questionNumber), x.answer));

    if (invalid.length) {
      return res.status(400).json({
        message: `Answer key contains option(s) not present in the question paper: ${invalid
          .map((x) => `Q${x.questionNumber}=${x.answer}`)
          .join(', ')}`,
        invalid
      });
    }

    const result = evaluate(exam, answers || {}, answerKey);
    const id = Date.now().toString(36);
    const attempt = {
      id,
      createdAt: new Date().toISOString(),
      examTitle: exam.title || 'Untitled Exam',
      exam,
      result
    };
    const all = readAttempts();
    all.unshift(attempt);
    writeAttempts(all.slice(0, 100));
    res.json(attempt);
  } catch (e) {
    res.status(500).json({ message: 'Evaluation failed', error: e.message });
  }
});

app.get('/api/attempts', (req, res) =>
  res.json(
    readAttempts().map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      examTitle: a.examTitle,
      score: a.result.score,
      maxScore: a.result.maxScore,
      accuracy: a.result.accuracy,
      attempted: a.result.attempted,
      totalQuestions: a.result.totalQuestions
    }))
  )
);

app.get('/api/attempts/:id', (req, res) => {
  const a = readAttempts().find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ message: 'Attempt not found' });
  res.json(a);
});

app.use(express.static(path.resolve('../client/dist')));

app.listen(PORT, () => console.log(`ExamLens server running on http://localhost:${PORT}`));
