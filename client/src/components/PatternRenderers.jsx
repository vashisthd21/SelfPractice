import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Puzzle,
  GitCommit,
  Hash,
  Layers,
  ArrowUpDown,
  AlertCircle,
  Sparkles,
  Compass,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle as QuestionIcon,
  ChevronRight,
  ListOrdered,
  Type,
  Code2
} from 'lucide-react';

// Question Type Configuration with colors & icons
export const TYPE_CONFIG = {
  reading_comprehension: {
    label: 'Reading Comprehension',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    icon: BookOpen
  },
  cloze_test: {
    label: 'Cloze Test',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    icon: Type
  },
  syllogism: {
    label: 'Syllogism',
    color: '#ec4899',
    bgColor: '#fdf2f8',
    borderColor: '#fbcfe8',
    icon: GitCommit
  },
  statement_conclusion: {
    label: 'Statement & Conclusion',
    color: '#f43f5e',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
    icon: AlertCircle
  },
  puzzle_seating: {
    label: 'Puzzle & Seating',
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    icon: Puzzle
  },
  inequality: {
    label: 'Inequality',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    icon: ArrowUpDown
  },
  coding_decoding: {
    label: 'Coding-Decoding',
    color: '#06b6d4',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    icon: Code2
  },
  alphanumeric_series: {
    label: 'Alphanumeric Series',
    color: '#6366f1',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe',
    icon: Hash
  },
  input_output: {
    label: 'Input-Output Machine',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd',
    icon: Layers
  },
  para_jumble: {
    label: 'Para Jumble',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    icon: ListOrdered
  },
  error_detection: {
    label: 'Error Detection',
    color: '#e11d48',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
    icon: AlertCircle
  },
  phrase_replacement: {
    label: 'Phrase Replacement',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    icon: Sparkles
  },
  fillers: {
    label: 'Fillers / Blanks',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    icon: Type
  },
  direction_distance: {
    label: 'Direction & Distance',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    icon: Compass
  },
  blood_relation: {
    label: 'Blood Relation',
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#ffedd5',
    icon: Users
  },
  order_ranking: {
    label: 'Order & Ranking',
    color: '#4f46e5',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe',
    icon: ListOrdered
  },
  vocabulary: {
    label: 'Vocabulary & Usage',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    icon: BookOpen
  },
  odd_one_out: {
    label: 'Odd One Out',
    color: '#9333ea',
    bgColor: '#faf5ff',
    borderColor: '#f3e8ff',
    icon: Sparkles
  },
  general_mcq: {
    label: 'Multiple Choice',
    color: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
    icon: HelpCircle
  }
};

// Pattern Badge Component
export function PatternBadge({ type, customLabel, size = 'normal' }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.general_mcq;
  const Icon = config.icon;
  const label = customLabel || config.label;

  return (
    <span
      className={`pattern-badge ${size === 'small' ? 'badge-sm' : ''}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        borderColor: config.borderColor
      }}
    >
      <Icon size={size === 'small' ? 12 : 14} />
      <span>{label}</span>
    </span>
  );
}

// 1. Reading Comprehension View
export function ReadingCompView({ question, selectedOption, onSelectOption }) {
  const [fontSize, setFontSize] = useState(15);
  const passage = question.passage || question.directions || '';

  return (
    <div className="pattern-layout rc-layout">
      {passage && (
        <div className="passage-card">
          <div className="passage-toolbar">
            <div className="passage-header-title">
              <BookOpen size={16} />
              <span>Reading Passage</span>
            </div>
            <div className="font-controls">
              <button
                type="button"
                className="font-btn"
                onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                title="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className="font-btn"
                onClick={() => setFontSize((s) => Math.min(20, s + 1))}
                title="Increase font size"
              >
                A+
              </button>
            </div>
          </div>
          <div className="passage-content" style={{ fontSize: `${fontSize}px` }}>
            {passage.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 2. Cloze Test View with dynamic live blank insertion
export function ClozeTestView({ question, selectedOption, onSelectOption }) {
  const passage = question.passage || '';
  const currentBlank = question.typeData?.blankNumber || question.questionNumber;
  const chosenWord = selectedOption && question.options[selectedOption] ? question.options[selectedOption] : null;

  const renderClozePassage = () => {
    if (!passage) return null;
    const regex = /\((\s*\d{1,3}\s*)\)|_{3,}/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(passage)) !== null) {
      if (match.index > lastIndex) {
        parts.push(passage.slice(lastIndex, match.index));
      }

      const blankNum = match[1] ? Number(match[1].trim()) : null;
      const isCurrent = blankNum === currentBlank;

      parts.push(
        <span
          key={match.index}
          className={`cloze-blank ${isCurrent ? 'active-blank' : ''} ${isCurrent && chosenWord ? 'filled-blank' : ''}`}
        >
          {isCurrent && chosenWord ? (
            <b className="inserted-word">{chosenWord}</b>
          ) : (
            `(${blankNum || currentBlank})`
          )}
        </span>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < passage.length) {
      parts.push(passage.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="pattern-layout cloze-layout">
      {passage && (
        <div className="cloze-passage-card">
          <div className="cloze-passage-header">
            <Type size={16} />
            <span>Cloze Passage · Blank ({currentBlank})</span>
          </div>
          <div className="cloze-passage-text">{renderClozePassage()}</div>
        </div>
      )}

      <div className="question-interactive-card">
        <div className="blank-indicator-banner">
          <span>Select the word for blank <b>({currentBlank})</b></span>
        </div>
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 3. Syllogism View with interactive conclusion validation tags
export function SyllogismView({ question, selectedOption, onSelectOption }) {
  const statements = question.typeData?.statements || [];
  const conclusions = question.typeData?.conclusions || [];
  const [evalStates, setEvalStates] = useState({});

  const toggleEval = (index) => {
    setEvalStates((prev) => {
      const current = prev[index];
      const next = current === 'true' ? 'false' : current === 'false' ? 'uncertain' : 'true';
      return { ...prev, [index]: next };
    });
  };

  return (
    <div className="pattern-layout syllogism-layout">
      <div className="syllogism-cards-grid">
        {statements.length > 0 && (
          <div className="syllogism-panel statements-panel">
            <div className="panel-heading">
              <GitCommit size={16} />
              <span>Statements</span>
            </div>
            <ul className="statement-list">
              {statements.map((stmt, idx) => (
                <li key={idx} className="statement-item">
                  <span className="bullet">●</span>
                  <span className="text">{stmt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {conclusions.length > 0 && (
          <div className="syllogism-panel conclusions-panel">
            <div className="panel-heading">
              <CheckCircle2 size={16} />
              <span>Conclusions</span>
            </div>
            <div className="conclusion-list">
              {conclusions.map((conc, idx) => {
                const status = evalStates[idx];
                return (
                  <div
                    key={idx}
                    className={`conclusion-item ${status ? `status-${status}` : ''}`}
                    onClick={() => toggleEval(idx)}
                    title="Click to toggle reasoning: Follows / Doesn't follow / Uncertain"
                  >
                    <span className="conclusion-text">{conc}</span>
                    <span className={`eval-badge ${status || 'none'}`}>
                      {status === 'true' && <><CheckCircle2 size={13} /> Follows</>}
                      {status === 'false' && <><XCircle size={13} /> Doesn't follow</>}
                      {status === 'uncertain' && <><QuestionIcon size={13} /> Uncertain</>}
                      {!status && <span className="eval-hint">Check</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="question-interactive-card">
        <h2 className="question-title">
          {question.questionText.replace(/statements?:[\s\S]*?conclusions?:[\s\S]*$/i, '').trim() || 'Choose the correct option:'}
        </h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 4. Statement & Conclusion View
export function StatementConclusionView({ question, selectedOption, onSelectOption }) {
  const statement = question.typeData?.statement || '';
  const conclusions = question.typeData?.conclusions || [];

  return (
    <div className="pattern-layout st-conclusion-layout">
      {statement && (
        <div className="statement-box">
          <div className="box-title">
            <AlertCircle size={16} />
            <span>Given Statement</span>
          </div>
          <p className="statement-body">{statement}</p>
        </div>
      )}

      {conclusions.length > 0 && (
        <div className="conclusions-box">
          <div className="box-title">
            <CheckCircle2 size={16} />
            <span>Conclusions</span>
          </div>
          <div className="conclusions-sublist">
            {conclusions.map((c, i) => (
              <div key={i} className="conclusion-row">
                <span className="c-text">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">Which of the conclusions logically follows?</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 5. Seating Arrangement & Puzzle View with Clue Checklist & Setup text
export function PuzzleSeatingView({ question, selectedOption, onSelectOption }) {
  const clues = question.typeData?.clues || [];
  const setupText = question.typeData?.setupText || question.directions || '';
  const arrangementType = question.typeData?.arrangementType || 'circular';
  const [checkedClues, setCheckedClues] = useState({});

  const toggleClue = (idx) => {
    setCheckedClues((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const solvedCount = Object.values(checkedClues).filter(Boolean).length;
  const totalClues = clues.length || 1;

  return (
    <div className="pattern-layout puzzle-layout">
      <div className="puzzle-clues-card">
        <div className="puzzle-header">
          <div className="puzzle-title">
            <Puzzle size={16} />
            <span>
              {arrangementType === 'circular'
                ? 'Circular Arrangement Clues'
                : arrangementType === 'linear'
                ? 'Linear Row Clues'
                : 'Puzzle Conditions'}
            </span>
          </div>
          <span className="clue-counter">
            {solvedCount} / {totalClues} solved
          </span>
        </div>

        {setupText && (
          <div className="puzzle-setup-text">
            <p>{setupText}</p>
          </div>
        )}

        {clues.length > 0 ? (
          <div className="clues-checklist">
            {clues.map((clue, idx) => (
              <div
                key={idx}
                className={`clue-row ${checkedClues[idx] ? 'clue-completed' : ''}`}
                onClick={() => toggleClue(idx)}
              >
                <input
                  type="checkbox"
                  checked={!!checkedClues[idx]}
                  onChange={() => {}}
                  className="clue-checkbox"
                />
                <span className="clue-text">{clue}</span>
              </div>
            ))}
          </div>
        ) : (
          question.passage && <div className="passage-content">{question.passage}</div>
        )}
      </div>

      <div className="question-interactive-card">
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 6. Inequality View
export function InequalityView({ question, selectedOption, onSelectOption }) {
  const expr = question.typeData?.expression || question.questionText.split('\n')[0];
  const query = question.questionText.replace(expr, '').trim() || 'Which of the following is definitely true?';

  return (
    <div className="pattern-layout inequality-layout">
      {expr && (
        <div className="inequality-expression-card">
          <div className="expr-badge">RELATION STATEMENT</div>
          <div className="expression-display">
            {expr.split('').map((char, i) => (
              <span
                key={i}
                className={`expr-char ${/[><=≥≤≠]/.test(char) ? 'expr-operator' : /[A-Z0-9]/.test(char) ? 'expr-var' : ''}`}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">{query}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 7. Coding-Decoding View
export function CodingDecodingView({ question, selectedOption, onSelectOption }) {
  const rules = question.typeData?.rules || [];
  const [highlightWord, setHighlightWord] = useState('');

  return (
    <div className="pattern-layout coding-layout">
      {rules.length > 0 && (
        <div className="code-table-card">
          <div className="code-header">
            <Code2 size={16} />
            <span>Code Language Matrix</span>
          </div>
          <div className="code-pairs-grid">
            {rules.map((rule, idx) => (
              <div key={idx} className="code-row">
                <div className="phrase-col">
                  {rule.phrase.split(' ').map((w, wi) => (
                    <span
                      key={wi}
                      className={`word-token ${highlightWord === w.toLowerCase() ? 'highlighted-word' : ''}`}
                      onClick={() => setHighlightWord(highlightWord === w.toLowerCase() ? '' : w.toLowerCase())}
                    >
                      {w}
                    </span>
                  ))}
                </div>
                <span className="code-arrow">➜</span>
                <div className="code-col">
                  {rule.code.split(' ').map((c, ci) => (
                    <span key={ci} className="code-token">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 8. Alphanumeric Series View with position helper ribbon
export function AlphanumericSeriesView({ question, selectedOption, onSelectOption }) {
  const rawSeries = question.typeData?.series || '';
  const elements = rawSeries.split(/\s+/).filter(Boolean);
  const [hoverIndex, setHoverIndex] = useState(null);

  return (
    <div className="pattern-layout series-layout">
      {elements.length > 0 && (
        <div className="series-ribbon-card">
          <div className="series-header">
            <Hash size={16} />
            <span>Alphanumeric Sequence</span>
          </div>
          <div className="series-ribbon-track">
            <span className="direction-tag left-tag">LEFT ➡</span>
            <div className="series-elements-wrapper">
              {elements.map((el, idx) => (
                <div
                  key={idx}
                  className={`series-cell ${/[0-9]/.test(el) ? 'is-number' : /[A-Za-z]/.test(el) ? 'is-letter' : 'is-symbol'}`}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                  onClick={() => setHoverIndex(idx)}
                >
                  <span className="cell-char">{el}</span>
                  <span className="left-pos">{idx + 1}</span>
                  <span className="right-pos">{elements.length - idx}</span>
                </div>
              ))}
            </div>
            <span className="direction-tag right-tag">⬅ RIGHT</span>
          </div>
          {hoverIndex !== null && (
            <div className="series-hover-info">
              Element <b>"{elements[hoverIndex]}"</b> is <b>#{hoverIndex + 1} from Left</b> and <b>#{elements.length - hoverIndex} from Right</b>.
            </div>
          )}
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 9. Input-Output View with step arrangement
export function InputOutputView({ question, selectedOption, onSelectOption }) {
  const inputLine = question.typeData?.inputLine || '';
  const steps = question.typeData?.steps || [];

  return (
    <div className="pattern-layout io-layout">
      {(inputLine || steps.length > 0) && (
        <div className="io-machine-card">
          <div className="io-header">
            <Layers size={16} />
            <span>Machine Arrangement Steps</span>
          </div>
          <div className="io-steps-list">
            {inputLine && (
              <div className="io-step-row io-input-row">
                <span className="step-label">INPUT</span>
                <span className="step-content">{inputLine}</span>
              </div>
            )}
            {steps.map((st, idx) => (
              <div key={idx} className="io-step-row">
                <span className="step-label">{st.step}</span>
                <span className="step-content">{st.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 10. Para Jumble View with interactive sequence builder
export function ParaJumbleView({ question, selectedOption, onSelectOption }) {
  const sentences = question.typeData?.sentences || {};
  const [builtSequence, setBuiltSequence] = useState([]);

  const addLetter = (letter) => {
    if (!builtSequence.includes(letter)) {
      const next = [...builtSequence, letter];
      setBuiltSequence(next);
      const candidate = next.join('');
      const matchedKey = Object.keys(question.options).find(
        (k) => question.options[k].replace(/\s+/g, '') === candidate
      );
      if (matchedKey) onSelectOption(matchedKey);
    }
  };

  const removeLetter = (letter) => {
    setBuiltSequence(builtSequence.filter((l) => l !== letter));
  };

  const resetSequence = () => setBuiltSequence([]);

  return (
    <div className="pattern-layout jumble-layout">
      {Object.keys(sentences).length > 0 && (
        <div className="jumble-cards-container">
          <div className="jumble-header">
            <ListOrdered size={16} />
            <span>Sentences to Rearrange (Click in order to test candidate sequence)</span>
          </div>
          <div className="sentences-list">
            {Object.entries(sentences).map(([lbl, txt]) => {
              const inOrderIdx = builtSequence.indexOf(lbl);
              return (
                <div
                  key={lbl}
                  className={`sentence-card ${inOrderIdx !== -1 ? 'in-sequence' : ''}`}
                  onClick={() => (inOrderIdx !== -1 ? removeLetter(lbl) : addLetter(lbl))}
                >
                  <span className="sentence-label">
                    {inOrderIdx !== -1 ? `#${inOrderIdx + 1} (${lbl})` : lbl}
                  </span>
                  <span className="sentence-text">{txt}</span>
                </div>
              );
            })}
          </div>

          <div className="candidate-sequence-bar">
            <span>Candidate sequence:</span>
            <div className="sequence-chips">
              {builtSequence.map((l) => (
                <span key={l} className="seq-chip" onClick={() => removeLetter(l)}>
                  {l} ✕
                </span>
              ))}
              {builtSequence.length === 0 && <span className="empty-seq-hint">Click cards above in order</span>}
            </div>
            {builtSequence.length > 0 && (
              <button type="button" className="reset-seq-btn" onClick={resetSequence}>
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">
          {question.questionText.replace(/[A-E]\.\s+[\s\S]*$/i, '').trim() || 'Select the correct rearrangement:'}
        </h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 11. Error Detection View with clickable segment chips
export function ErrorDetectionView({ question, selectedOption, onSelectOption }) {
  const segments = question.typeData?.segments || [];
  const partsLabels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="pattern-layout error-layout">
      {segments.length > 0 && (
        <div className="error-segments-card">
          <div className="error-card-header">
            <AlertCircle size={16} />
            <span>Identify the part containing an error (Click part to select)</span>
          </div>
          <div className="segments-sentence-flow">
            {segments.map((seg, idx) => {
              const label = partsLabels[idx] || String.fromCharCode(65 + idx);
              const isSelected = selectedOption === label;
              return (
                <span
                  key={idx}
                  className={`segment-chip ${isSelected ? 'selected-segment' : ''}`}
                  onClick={() => onSelectOption(label)}
                  title={`Click to choose Part (${label})`}
                >
                  <span className="seg-tag">({label})</span>
                  <span className="seg-text">{seg}</span>
                  {idx < segments.length - 1 && <span className="slash-sep">/</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="question-interactive-card">
        <h2 className="question-title">Which part contains an error?</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 12. Phrase Replacement & Fillers View
export function PhraseReplacementView({ question, selectedOption, onSelectOption }) {
  const text = question.questionText;

  return (
    <div className="pattern-layout phrase-layout">
      <div className="phrase-sentence-card">
        <div className="phrase-header">
          <Sparkles size={16} />
          <span>Sentence Improvement</span>
        </div>
        <p className="sentence-display">{text}</p>
      </div>

      <div className="question-interactive-card">
        <h2 className="question-title">Choose the best replacement:</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// 13. Direction & Distance View with Compass
export function DirectionDistanceView({ question, selectedOption, onSelectOption }) {
  return (
    <div className="pattern-layout direction-layout">
      <div className="direction-guide-card">
        <div className="compass-visual">
          <Compass size={32} className="compass-icon" />
          <div className="compass-rose">
            <span className="n">N</span>
            <span className="s">S</span>
            <span className="w">W</span>
            <span className="e">E</span>
          </div>
        </div>
        <div className="direction-notes">
          <b>Direction Compass</b>
          <span>North is Up, South is Down, East is Right, West is Left. Turns follow your current heading.</span>
        </div>
      </div>

      <div className="question-interactive-card">
        <h2 className="question-title">{question.questionText}</h2>
        <OptionList
          options={question.options}
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
        />
      </div>
    </div>
  );
}

// Universal Option List
export function OptionList({ options, selectedOption, onSelectOption }) {
  return (
    <div className="answers-grid">
      {Object.entries(options || {}).map(([key, val]) => {
        const isSelected = selectedOption === key;
        return (
          <button
            key={key}
            type="button"
            className={`option-btn ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectOption(isSelected ? null : key)}
          >
            <span className="option-radio">{isSelected ? '✓' : key}</span>
            <span className="option-text">{val}</span>
          </button>
        );
      })}
    </div>
  );
}

// Master Pattern Renderer Selector
export function PatternRenderer({ question, selectedOption, onSelectOption }) {
  if (!question) return null;
  const type = question.questionType || 'general_mcq';

  switch (type) {
    case 'reading_comprehension':
      return <ReadingCompView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'cloze_test':
      return <ClozeTestView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'syllogism':
      return <SyllogismView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'statement_conclusion':
      return <StatementConclusionView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'puzzle_seating':
      return <PuzzleSeatingView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'inequality':
      return <InequalityView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'coding_decoding':
      return <CodingDecodingView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'alphanumeric_series':
      return <AlphanumericSeriesView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'input_output':
      return <InputOutputView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'para_jumble':
      return <ParaJumbleView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'error_detection':
      return <ErrorDetectionView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'phrase_replacement':
      return <PhraseReplacementView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    case 'direction_distance':
      return <DirectionDistanceView question={question} selectedOption={selectedOption} onSelectOption={onSelectOption} />;
    default:
      return (
        <div className="pattern-layout general-layout">
          {question.passage && (
            <div className="passage-card">
              <div className="passage-header-title">
                <BookOpen size={16} />
                <span>Context / Passage</span>
              </div>
              <div className="passage-content">{question.passage}</div>
            </div>
          )}
          <div className="question-interactive-card">
            <h2 className="question-title">{question.questionText}</h2>
            <OptionList
              options={question.options}
              selectedOption={selectedOption}
              onSelectOption={onSelectOption}
            />
          </div>
        </div>
      );
  }
}
