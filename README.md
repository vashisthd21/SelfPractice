# ExamLens

ExamLens converts question-paper PDFs into interactive exams and evaluates attempts against an answer-key PDF.

## Current capabilities

- Variable question count — no hard-coded 30-question assumption
- Flexible section headings such as `Section A`, `Section 1`, `Part A`
- Question formats such as `1.`, `1)`, `Q1`, `Q1.` and standalone question numbers
- 2–8 answer choices, including A–H and numeric `(1)`–`(8)` option labels
- Numeric option labels are normalized to A–H internally
- Shared passage/context for comprehension, cloze, puzzles, coding-decoding, alphanumeric series, input-output, etc.
- Question-specific statement blocks such as syllogism questions
- Nested labelled statements followed by a second A–E answer-choice block (e.g. para-jumble questions)
- Blank-question formats such as cloze blanks
- Compact answer keys such as `1B 2E 3B`, spaced keys such as `1 B`, `Q1:B`, and punctuation variants
- Answer-key validation against the options actually detected in each question
- Missing/invalid answer-key review before scoring
- Deterministic scoring with configurable positive and negative marks
- Timed exam, question palette, mark-for-review, mobile-friendly exam UI
- Result analytics, section accuracy and question review

## Sample PDFs included

The project includes both the English sample and the Reasoning sample used during parser validation:

- `Set-1_Eng.pdf`
- `Set-1_Eng_Ans.pdf`
- `Set-1_reas.pdf`
- `Set-1_reas-ans.pdf`

The Reasoning answer key intentionally contains `Q5 = F`, while Q5 has only A–E options. ExamLens detects this mismatch and asks the user to correct/confirm it instead of silently scoring it. The supplied answer key lists Q1–Q30 and explicitly flags Q5 F as not present in the options. 

## Run

From the project root:

```powershell
npm.cmd install
npm.cmd run install:all
npm.cmd run dev
```

Then open `http://localhost:5173`.

If PowerShell blocks `npm.ps1`, use `npm.cmd` as above or configure the user execution policy with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Architecture

```text
Question PDF
   ↓
PDF text extraction
   ↓
Flexible structural parser
   ↓
Questions + options + sections + context
   ↓
Preview / correction
   ↓
Interactive timed exam
   ↓
Submit
   ↓
Answer-key PDF
   ↓
Flexible answer-key parser
   ↓
Missing / invalid key validation
   ↓
Deterministic evaluation
   ↓
Result + analytics
```

The parser is deliberately deterministic and does not use an LLM for scoring. OCR can be added later for scanned PDFs through the PDF extraction layer.
