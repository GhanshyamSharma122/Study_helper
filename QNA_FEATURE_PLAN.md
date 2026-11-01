# Q&A (Open-Ended) Feature — Implementation Plan

> Status: plan only. Nothing implemented yet. Awaiting approval to start Phase 1.

## 1. Goal

Add an open-ended **Question & Answer** practice mode alongside the existing MCQ quizzes:

- Users create Q&A sets (manual entry, or AI-generated from pasted text / PDF).
- For each question, the user types or **speaks** their answer into a text field.
- AI grades the answer **out of 10** and reports **what is missing**, while tolerating
  typos and speech-to-text (ASR) errors.
- Reuse the already-configured DeepSeek proxy (`ai_service.js`).

## 2. Constraints discovered in the repo

- Backend only: Express + Mongoose + MongoMemoryServer. Frontend is a **compiled bundle**
  (`public/dist`, gitignored source). The only editable UI surface is the standalone
  `public/practice/index.html` page and new standalone pages served by Express static.
- User identity is a client-generated UUID sent via `x-user-id` header (see `mistake.controller.js`).
- AI access is centralized in `src/utils/ai_service.js` → `handleIndividualPrompt(prompt, system?)`.
  Note: `handleIndividualPrompt` currently accepts only `prompt`; if we want a system message
  we will extend its signature (backward compatible).
- Existing patterns to mirror: `quiz.model.js`, `quiz.controller.js`, `quiz.route.js`, and
  `mcq_generator.js` (chunking + JSON parsing helpers).

## 3. Data model

### 3.1 `QnASet` (new file `src/models/qna.model.js`)

```js
{
  userId:     String,            // owner (indexed). Empty/null => shared/global.
  title:      String (required),
  subject:    String (required),
  text:       String,            // source text (for AI regeneration)
  questions: [{
    question: String (required),
    answer:   String (required), // reference / expected answer
    keywords: [String]           // optional key points for grading
  }]
}, timestamps
```

Index: `{ userId: 1, createdAt: -1 }`.

### 3.2 `QnAAttempt` (optional, Phase 2) — `src/models/qnaAttempt.model.js`

```js
{
  userId:     String (required, indexed),
  setId:      ObjectId ref QnASet,
  questionIndex: Number,
  userAnswer: String,
  score:      Number (0-10),
  missing:    [String],
  feedback:   String,
}, timestamps
```

Decision default: **store attempts** (cheap, enables progress/history). Can be dropped if
not wanted — flag in open questions.

## 4. Backend API

New router mounted at `/api/v1/qna` (`src/routes/qna.route.js`).

| Method | Path | Purpose |
|---|---|---|
| GET    | `/` | List sets for current user (plus shared). |
| POST   | `/manual` | Create set from `{ title, subject, questions:[{question,answer}] }`. |
| POST   | `/text` | AI-generate set from `{ title, subject, text, numberOfQuestions? }`. |
| POST   | `/pdf` | AI-generate set from uploaded PDF (`upload.single("pdf_file")`). |
| GET    | `/:id` | Get one set. |
| DELETE | `/:id` | Delete a set (owner only). |
| POST   | `/:id/score` | Score one answer: body `{ questionIndex, userAnswer }` → `{ score, missing, feedback }`. |
| POST   | `/:id/regenerate` | Add more AI questions from stored `text`. |
| GET    | `/:id/attempts` | List user's attempts for this set (Phase 2). |

Auth: reuse `x-user-id` header helper (same as mistakes). For shared/global sets,
allow read by anyone; write/delete require ownership.

Validation: Joi schemas mirroring `quiz.controller.js`.

## 5. AI utilities

### 5.1 `src/utils/qna_generator.js`

Mirror `mcq_generator.js`: chunk source text, call `handleIndividualPrompt`, parse JSON array.
Prompt asks for objects `{ question, answer, keywords }`. Reuse `extractJsonArray`,
`escapeRawControlChars`, `removeTrailingCommas`, `parseJsonArray` (extract to shared
helper or duplicate — prefer extracting to `src/utils/json_utils.js` to avoid drift).

### 5.2 `src/utils/qna_scorer.js`

Single prompt per answer:

```
You are a lenient grader for short-answer questions.
Question: ...
Reference answer: ...
Student answer: ...
Ignore minor spelling, grammar, and speech-to-text errors; judge conceptual coverage.
Return ONLY a JSON object:
{ "score": <integer 0-10>, "missing": [<short phrases of key points not covered>], "feedback": "<one sentence>" }
```

Parse with the same JSON helpers. Clamp score to 0-10. On parse failure, retry once;
if still failing, return `{ score: null, missing: [], feedback: "Could not grade; try again." }`
rather than throwing, so the UI never hard-fails.

### 5.3 `ai_service.js` change

Extend `handleIndividualPrompt` to accept optional `{ system }` and forward it to
`callDeepSeek({ prompt, system })` (already supported). Backward compatible.

## 6. Frontend

New standalone page `public/qna/index.html`, served at `/qna` via
`app.use("/qna", express.static("public/qna"))` (add in `app.js`), mirroring `/practice`.

Sections:
1. **List** — cards of sets with title/subject/question count; buttons "Practice", "Delete".
2. **Create** — tabs:
   - Manual: title, subject, dynamic rows (question + answer textarea), add/remove row, save.
   - From text: title, subject, textarea, count.
   - From PDF: title, subject, file input, count.
3. **Practice** — one question at a time:
   - Question text.
   - Textarea for answer.
   - 🎤 button using Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`),
     appending interim+final transcript to textarea; show listening state; handle
     `not-allowed` / unsupported browsers with a graceful fallback (button hidden).
   - Submit → POST score → show score/10, missing list, feedback; "Next" button.
   - Progress bar; finish summary with average score.

JS patterns reuse `practice/index.html` conventions (fetch, `x-user-id`, escapeHtml).

Accessibility: large tap targets, mobile-friendly (reuse responsive CSS from practice).

## 7. Wiring

- `src/app.js`: import `qnaRouter`; `app.use("/api/v1/qna", qnaRouter)`; add static line.
- Optionally add a link from `practice/index.html` header to `/qna` and back (low risk).

## 8. Testing plan

- Unit-ish: start server (`npm run dev`), hit endpoints with curl/PowerShell.
- Create manual set → fetch → score with a correct-ish answer, a wrong answer, and a
  misspelled/ASR-garbled answer; verify tolerance and missing list.
- AI generation from text (requires DeepSeek proxy running).
- Frontend smoke test in browser: create, practice, speech (if supported).
- Verify MongoMemoryServer persistence path unchanged.

## 9. Phases

- **Phase 1 (backend core):** model, generator, scorer, json helper, controller, route. (~6 files)
- **Phase 2 (wiring + attempts):** app.js, attempt model/controller. (~3 files)
- **Phase 3 (frontend):** `public/qna/index.html`. (~1 file)
- **Phase 4 (polish):** links, error handling, mobile CSS. (~2 files)
- **Phase 5:** commit & push.

Estimated: 2-3 focused sessions.

## 10. Open questions (resolved)

1. **Ownership:** GLOBAL/SHARED (like MCQ quizzes). Implemented: sets have no owner; anyone can read/edit/delete.
2. **Attempts/history:** STORED. Implemented `QnAAttempt` collection, per `x-user-id`.
3. **Editing:** YES. Implemented `PUT /:id` replacing title/subject/questions.
4. **Speech language:** fixed `en-US`.
5. **Scoring strictness:** lenient conceptual grading with typo/ASR tolerance. Verified.
6. **Main dashboard integration:** standalone `/qna` page (frontend source not in repo).

### Implementation status
- Phase 1 (backend + standalone page): DONE and pushed (commit 131af76).
- Phase 2+ (links, polish): optional follow-up.

## 11. Risks

- DeepSeek proxy may be down/slow → generation/scoring fail; scorer returns graceful
  fallback; UI shows retry.
- Reasoning model may emit malformed JSON → retry + repair helpers (proven in mcq_generator).
- MongoMemoryServer dbPath is a fixed Windows path; keep unchanged.
- No automated tests in repo (`npm test` is a placeholder) → manual verification.

---

Reply with answers/adjustments, or say "start Phase 1" to proceed.
