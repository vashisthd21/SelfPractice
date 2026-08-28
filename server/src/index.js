import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MAX_MB = Number(process.env.MAX_FILE_SIZE_MB || 20);
const JWT_SECRET = process.env.JWT_SECRET || 'examlens_secret_key_2026_secure';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '4mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (r, f, cb) => cb(null, f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf'))
});

import {
  connectDB,
  getAllUsers,
  findUserByEmail,
  findUserById,
  saveUser,
  getAllExams,
  findExamByCode,
  saveExam,
  getAllAttempts,
  getAttemptsByExam,
  getAttemptsByUser,
  findAttemptById,
  saveAttempt
} from './db.js';

// Initialize Database connection
connectDB().catch((err) => console.warn('DB init notice:', err.message));

// -------------------------------------------------------------
// AUTH & CRYPTO HELPERS (Pure Node.js Crypto)
// -------------------------------------------------------------

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}

app.use(authMiddleware);

// Generate memorable 6-character uppercase exam code
function generateExamCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

async function pdfText(buffer) {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true
  }).promise;
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
  const passageSource = (rawContext || dir || '').trim();

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

  // 3. Syllogism
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

  // 4. Statement & Conclusion
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
    /Input\s*:/i.test(combined)
  ) {
    const src = (rawContext && rawContext.includes('Input:'))
      ? rawContext
      : (dir && dir.includes('Input:'))
      ? dir
      : text.includes('Input:')
      ? text
      : `${dir} ${rawContext} ${text}`;

    const inputMatch = src.match(/Input\s*:\s*(.*?)(?=\s+Step\s+[I|V|X\d]+|\n|$)/i);
    const stepMatches = [...src.matchAll(/(Step\s+[I|V|X\d]+)\s*:\s*(.*?)(?=\s+Step\s+[I|V|X\d]+|\s+\d{1,3}\s*[.)]|\n|$)/gi)];
    const steps = stepMatches.map((m) => ({ step: m[1].trim(), text: m[2].trim() }));

    return {
      type: 'input_output',
      label: 'Input-Output',
      typeData: {
        inputLine: inputMatch ? inputMatch[1].trim() : '42   17   63   29   85   34',
        steps: steps.length ? steps : [
          { step: 'Step I', text: '17   42   63   29   85   34' },
          { step: 'Step II', text: '17   29   42   63   85   34' },
          { step: 'Step III', text: '17   29   34   42   63   85' }
        ]
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

  // 9. Seating Arrangement & Puzzles
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
  if (/cloze/i.test(section) || (passageSource && /\(\d{1,3}\)/.test(passageSource))) {
    const blankMatch = text.match(/\b(?:blank\s*)?\(?(\d{1,3})\)?/i) || [null, String(q.questionNumber)];
    const cleanPassage = passageSource
      .replace(/^Directions?\s*(?:\([^)]*\))?\s*:?\s*(?:Choose the most suitable word for each blank\.?)?/i, '')
      .trim();
    return {
      type: 'cloze_test',
      label: 'Cloze Test',
      typeData: {
        blankNumber: blankMatch[1] ? Number(blankMatch[1]) : q.questionNumber,
        passage: cleanPassage
      }
    };
  }

  // 14. Para Jumble
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

  // 16. Phrase Replacement
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

  // 17. Fillers
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
    (passageSource && passageSource.length > 120 && !/cloze/i.test(section))
  ) {
    return {
      type: 'reading_comprehension',
      label: 'Reading Comprehension',
      typeData: {
        passage: passageSource
      }
    };
  }

  return {
    type: 'general_mcq',
    label: 'Multiple Choice',
    typeData: {}
  };
}

function parseQuestions(text) {
  let t = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\uf0b7\uf0a7\uf0d8\u25cf\u2219]/g, ' • ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  t = t.replace(/\s+(?=(?:Section|SECTION|Part|PART)\s+[A-Z0-9]+\s*[:—–-])/gi, '\n');
  t = t.replace(/\s+(?=Directions?\s*(?:\([^)]*\))?(?:\s*:)?)/gi, '\n');
  t = t.replace(/\s*•\s*/g, '\n• ');
  t = t.replace(/\s+(?=(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)]\s+(?:[A-Za-z0-9"“'\[]|Statements?|Input:|Step\s+I|Directions))/gi, '\n');
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

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await findUserByEmail(cleanEmail);

    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists. Please log in.' });
    }

    const { hash, salt } = hashPassword(password);
    const userId = `usr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

    const newUser = {
      id: userId,
      name: clean(name),
      email: cleanEmail,
      role: role === 'teacher' ? 'teacher' : 'student',
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString()
    };

    await saveUser(newUser);

    const token = createToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    });

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  } catch (e) {
    console.error('Signup error:', e);
    res.status(500).json({ message: 'Registration failed', error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(cleanEmail);

    if (!user || !verifyPassword(password, user.passwordHash || user.hash, user.passwordSalt || user.salt)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ message: 'Login failed', error: e.message });
  }
});

// Google OAuth Authentication
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, profile, role } = req.body;
    let name = '';
    let email = '';
    let avatar = '';

    if (credential) {
      // Decode Google JWT
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        email = payload.email ? payload.email.toLowerCase() : '';
        name = payload.name || payload.given_name || 'Google User';
        avatar = payload.picture || '';
      }
    } else if (profile) {
      email = profile.email ? profile.email.toLowerCase() : '';
      name = profile.name || 'Google User';
      avatar = profile.avatar || profile.picture || '';
    }

    if (!email) {
      return res.status(400).json({ message: 'Could not extract valid Google email' });
    }

    let user = await findUserByEmail(email);

    if (!user) {
      user = {
        id: `usr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
        name: clean(name) || 'Google User',
        email: email,
        role: role === 'teacher' ? 'teacher' : 'student',
        authProvider: 'google',
        avatar: avatar,
        passwordHash: '',
        passwordSalt: '',
        createdAt: new Date().toISOString()
      };
      await saveUser(user);
    }

    const token = createToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    console.error('Google auth error:', e);
    res.status(500).json({ message: 'Google authentication failed', error: e.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.json({ user: req.user });
  }
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

// -------------------------------------------------------------
// EXAM & EVALUATION ROUTES
// -------------------------------------------------------------

app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.post('/api/parse/questions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF file is required' });
    const text = await pdfText(req.file.buffer);
    const parsed = parseQuestions(text);
    res.json({
      questions: parsed.questions,
      warnings: parsed.warnings,
      totalQuestions: parsed.questions.length,
      rawTextLength: text.length
    });
  } catch (e) {
    console.error('Parse questions error:', e);
    res.status(500).json({ message: `Could not parse question PDF: ${e.message}`, error: e.message });
  }
});

app.post('/api/parse/answer-key', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF file is required' });
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
    console.error('Parse answer key error:', e);
    res.status(500).json({ message: `Could not parse answer-key PDF: ${e.message}`, error: e.message });
  }
});

// Create & Host an Exam (Creator Flow)
app.post('/api/exams/create', async (req, res) => {
  try {
    const { title, creatorName, config, questions, answerKey } = req.body;
    if (!questions || !questions.length) {
      return res.status(400).json({ message: 'Exam must contain questions' });
    }
    if (!answerKey || !Object.keys(answerKey).length) {
      return res.status(400).json({ message: 'Answer key is required to create and host an exam' });
    }

    let code = generateExamCode();
    let existing = await findExamByCode(code);
    while (existing) {
      code = generateExamCode();
      existing = await findExamByCode(code);
    }

    const adminKey = `adm_${crypto.randomBytes(12).toString('hex')}`;
    const id = `exam_${Date.now().toString(36)}`;

    const examRecord = {
      id,
      code,
      adminKey,
      creatorId: req.user?.id || 'guest',
      creatorEmail: req.user?.email || '',
      title: title || 'Practice Examination',
      creatorName: creatorName || req.user?.name || 'Exam Creator',
      createdAt: new Date().toISOString(),
      config: {
        duration: Number(config?.duration) || 30,
        positiveMarks: Number(config?.positiveMarks) || 1,
        negativeMarks: Number(config?.negativeMarks) || 0.25,
        cutoffMarks: Number(config?.cutoffMarks) || 0
      },
      questions,
      answerKey
    };

    await saveExam(examRecord);

    res.json({
      success: true,
      exam: {
        id: examRecord.id,
        code: examRecord.code,
        title: examRecord.title,
        creatorName: examRecord.creatorName,
        totalQuestions: questions.length,
        config: examRecord.config,
        createdAt: examRecord.createdAt
      },
      adminKey,
      code
    });
  } catch (e) {
    console.error('Exam creation error:', e);
    res.status(500).json({ message: 'Could not create exam', error: e.message });
  }
});

// List all hosted exams
app.get('/api/exams', async (req, res) => {
  try {
    const exams = await getAllExams();
    const summaries = exams.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      creatorName: e.creatorName,
      creatorId: e.creatorId,
      creatorEmail: e.creatorEmail,
      totalQuestions: e.questions ? e.questions.length : 0,
      config: e.config,
      createdAt: e.createdAt
    }));
    res.json(summaries);
  } catch (e) {
    console.error('Fetch all exams error:', e);
    res.status(500).json({ message: 'Failed to fetch exams', error: e.message });
  }
});

// List exams created by user (or all if guest/admin)
app.get('/api/exams/my-created', async (req, res) => {
  try {
    const allExams = await getAllExams();
    const userExams = req.user
      ? allExams.filter(
          (e) =>
            e.creatorId === req.user.id ||
            (e.creatorEmail && req.user.email && e.creatorEmail.toLowerCase() === req.user.email.toLowerCase())
        )
      : allExams;

    const summaries = userExams.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      creatorName: e.creatorName,
      creatorId: e.creatorId,
      creatorEmail: e.creatorEmail,
      totalQuestions: e.questions ? e.questions.length : 0,
      config: e.config,
      createdAt: e.createdAt
    }));
    res.json(summaries);
  } catch (e) {
    console.error('Fetch my-created exams error:', e);
    res.status(500).json({ message: 'Failed to fetch created exams', error: e.message });
  }
});

// List student's own attempts
app.get('/api/attempts/my-attempts', async (req, res) => {
  try {
    if (!req.user) return res.json([]);
    const userAttempts = await getAttemptsByUser(req.user.id, req.user.email);
    res.json(userAttempts);
  } catch (e) {
    console.error('Fetch my-attempts error:', e);
    res.status(500).json({ message: 'Failed to fetch attempts', error: e.message });
  }
});

// Candidate Fetch Exam (Stripping answerKey)
app.get('/api/exams/:code', async (req, res) => {
  const rawCode = req.params.code || '';
  const code = decodeURIComponent(rawCode).trim().toUpperCase();
  const exam = await findExamByCode(code);

  if (!exam) {
    return res.status(404).json({ message: `No exam found for code "${code}". Please check the code and try again.` });
  }

  res.json({
    id: exam.id,
    code: exam.code,
    title: exam.title,
    creatorName: exam.creatorName,
    createdAt: exam.createdAt,
    config: exam.config,
    totalQuestions: exam.questions.length,
    questions: exam.questions
  });
});

// Candidate Submission & Scoring
app.post('/api/exams/:code/submit', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { candidateName, candidateEmail, answers, timeSpentSeconds, examSnapshot } = req.body;
    let exam = await findExamByCode(code);

    if (!exam && examSnapshot && examSnapshot.questions) {
      exam = examSnapshot;
    }

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or has expired. Please verify the exam code.' });
    }

    const result = evaluate(exam, answers || {}, exam.answerKey || {});
    const attemptId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const attempt = {
      id: attemptId,
      examId: exam.id || `exam_${code}`,
      examCode: exam.code || code,
      examTitle: exam.title || 'Practice Examination',
      candidateId: req.user?.id || null,
      candidateName: clean(candidateName) || req.user?.name || 'Anonymous Candidate',
      candidateEmail: clean(candidateEmail) || req.user?.email || '',
      submittedAt: new Date().toISOString(),
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      answers: answers || {},
      result
    };

    await saveAttempt(attempt);

    res.json({
      success: true,
      attemptId,
      candidateName: attempt.candidateName,
      submittedAt: attempt.submittedAt,
      result,
      exam: {
        id: exam.id,
        code: exam.code,
        title: exam.title,
        config: exam.config,
        questions: exam.questions
      }
    });
  } catch (e) {
    console.error('Submission error:', e);
    res.status(500).json({ message: 'Evaluation failed', error: e.message });
  }
});

// Creator Analytics & Leaderboard (Restricted to Exam Creator)
app.get('/api/exams/:code/analytics', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const exam = await findExamByCode(code);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Access control: Allow creator or authenticated teacher who owns the exam
    const isCreator =
      !exam.creatorId ||
      exam.creatorId === 'guest' ||
      (req.user && (req.user.id === exam.creatorId || (exam.creatorEmail && req.user.email && req.user.email.toLowerCase() === exam.creatorEmail.toLowerCase())));

    if (!isCreator && req.user?.role !== 'teacher') {
      return res.status(403).json({
        message: 'Access Restricted: Only the exam creator / teacher can access candidate submissions and leaderboard.'
      });
    }

    const examAttempts = await getAttemptsByExam(exam.code);

    const leaderboard = examAttempts
      .map((a) => ({
        attemptId: a.id,
        candidateName: a.candidateName,
        candidateEmail: a.candidateEmail,
        score: a.result.score,
        maxScore: a.result.maxScore,
        accuracy: a.result.accuracy,
        attempted: a.result.attempted,
        correct: a.result.correct,
        wrong: a.result.wrong,
        unattempted: a.result.unattempted,
        timeSpentSeconds: a.timeSpentSeconds,
        submittedAt: a.submittedAt
      }))
      .sort((a, b) => b.score - a.score || a.timeSpentSeconds - b.timeSpentSeconds);

    const totalCandidates = leaderboard.length;
    let avgScore = 0,
      highestScore = 0,
      lowestScore = 0,
      avgAccuracy = 0,
      avgTimeSeconds = 0;

    if (totalCandidates > 0) {
      const scores = leaderboard.map((x) => x.score);
      highestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);
      avgScore = scores.reduce((a, b) => a + b, 0) / totalCandidates;
      avgAccuracy = leaderboard.reduce((a, b) => a + b.accuracy, 0) / totalCandidates;
      avgTimeSeconds = leaderboard.reduce((a, b) => a + b.timeSpentSeconds, 0) / totalCandidates;
    }

    const patternSummary = {};
    for (const a of examAttempts) {
      const typeResults = a.result?.typeResults || [];
      for (const t of typeResults) {
        patternSummary[t.type] ||= {
          type: t.type,
          label: t.label,
          totalQuestions: 0,
          totalCorrect: 0,
          totalAttempted: 0,
          attemptsCount: 0
        };
        const p = patternSummary[t.type];
        p.totalQuestions += t.total;
        p.totalCorrect += t.correct;
        p.totalAttempted += t.attempted;
        p.attemptsCount++;
      }
    }

    const batchPatternAnalytics = Object.values(patternSummary).map((p) => ({
      type: p.type,
      label: p.label,
      avgAccuracy: p.totalAttempted ? (p.totalCorrect / p.totalAttempted) * 100 : 0,
      totalAttempted: p.totalAttempted
    }));

    res.json({
      exam: {
        id: exam.id,
        code: exam.code,
        title: exam.title,
        creatorId: exam.creatorId,
        creatorName: exam.creatorName,
        createdAt: exam.createdAt,
        totalQuestions: exam.questions.length,
        config: exam.config
      },
      stats: {
        totalCandidates,
        highestScore: Number(highestScore.toFixed(2)),
        lowestScore: Number(lowestScore.toFixed(2)),
        avgScore: Number(avgScore.toFixed(2)),
        avgAccuracy: Number(avgAccuracy.toFixed(1)),
        avgTimeSeconds: Math.round(avgTimeSeconds)
      },
      leaderboard,
      batchPatternAnalytics
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ message: 'Could not fetch analytics', error: e.message });
  }
});

// Candidate Attempt History (Authenticated User)
app.get('/api/attempts/my-attempts', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Please log in to view your attempt history' });
  const myAttempts = await getAttemptsByUser(req.user.id, req.user.email);
  res.json(
    myAttempts.map((a) => ({
      id: a.id,
      examId: a.examId,
      examCode: a.examCode,
      examTitle: a.examTitle,
      score: a.result.score,
      maxScore: a.result.maxScore,
      accuracy: a.result.accuracy,
      attempted: a.result.attempted,
      totalQuestions: a.result.totalQuestions,
      submittedAt: a.submittedAt,
      timeSpentSeconds: a.timeSpentSeconds
    }))
  );
});

// Creator Hosted Exams List (Authenticated User)
app.get('/api/exams/my-created', async (req, res) => {
  const allExams = await getAllExams();
  const allAttempts = await getAllAttempts();

  let userExams = allExams;
  if (req.user) {
    userExams = allExams.filter((e) => e.creatorId === req.user.id || (e.creatorEmail && e.creatorEmail.toLowerCase() === req.user.email.toLowerCase()));
  }

  res.json(
    userExams.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      creatorName: e.creatorName,
      createdAt: e.createdAt,
      totalQuestions: e.questions.length,
      duration: e.config?.duration || 30,
      totalAttempts: allAttempts.filter((a) => a.examCode === e.code || a.examId === e.id).length
    }))
  );
});

// Public / All Exams List
app.get('/api/exams', async (req, res) => {
  const allExams = await getAllExams();
  const allAttempts = await getAllAttempts();

  res.json(
    allExams.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      creatorName: e.creatorName,
      createdAt: e.createdAt,
      totalQuestions: e.questions.length,
      duration: e.config?.duration || 30,
      totalAttempts: allAttempts.filter((a) => a.examCode === e.code || a.examId === e.id).length
    }))
  );
});

// Specific Attempt Details
app.get('/api/attempts/:attemptId', async (req, res) => {
  const attempt = await findAttemptById(req.params.attemptId);
  if (!attempt) return res.status(404).json({ message: 'Attempt record not found' });

  const exam = await findExamByCode(attempt.examCode || attempt.examId);

  res.json({
    attempt,
    exam: exam
      ? {
          title: exam.title,
          code: exam.code,
          config: exam.config,
          questions: exam.questions
        }
      : null
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`ExamLens server running on http://localhost:${PORT}`));
}

export default app;
