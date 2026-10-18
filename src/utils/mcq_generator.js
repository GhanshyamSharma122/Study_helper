import { handleIndividualPrompt } from "./ai_service.js";

// Generation is done in small batches so each JSON response stays well within
// the model's reliable output limits. Batches are built from chunks of the
// source text so the whole document gets covered without repeating questions.
const TARGET_TOTAL = 100;
const MAX_BATCHES = 10;
const BATCH_SIZE = 20;
const CHARS_PER_CHUNK = 1500;

/**
 * Pull the first balanced JSON array out of a model response.
 * Handles code fences and any surrounding prose the model may add.
 */
const extractJsonArray = (text) => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not find a JSON array in the model response");
  }
  return cleaned.slice(start, end + 1);
};

/**
 * The DeepSeek web model sometimes emits raw newlines/tabs inside string
 * literals, which makes the JSON invalid. Walk the text and escape any raw
 * control characters that appear inside a string, leaving escaped sequences
 * and structural characters untouched.
 */
const escapeRawControlChars = (json) => {
  let out = "";
  let inString = false;

  for (let i = 0; i < json.length; i += 1) {
    const ch = json[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    // Inside a string literal.
    if (ch === "\\") {
      out += ch + (json[i + 1] || "");
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") { out += "\\r"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }

    out += ch;
  }

  return out;
};

/**
 * Best-effort repair for common model mistakes, applied only when the raw
 * text fails to parse. Removes trailing commas before a closing bracket.
 */
const removeTrailingCommas = (json) => json.replace(/,\s*([}\]])/g, "$1");

const parseJsonArray = (text) => {
  const raw = extractJsonArray(text);

  const attempts = [
    raw,
    escapeRawControlChars(raw),
    removeTrailingCommas(escapeRawControlChars(raw)),
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Failed to parse model response as JSON: ${lastError.message}`);
};

const splitIntoSentences = (text) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const matches = normalized.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  return (matches || [normalized]).map((s) => s.trim()).filter(Boolean);
};

const chunkSentences = (sentences, count) => {
  if (sentences.length <= count) return sentences.slice();
  const perChunk = Math.ceil(sentences.length / count);
  const chunks = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    chunks.push(sentences.slice(i, i + perChunk).join(" "));
  }
  return chunks;
};

const buildPrompt = (chunk, count) => `
You are an expert MCQ generator for educational quizzes.

From the source text provided below, create exactly ${count} multiple-choice questions.

REQUIREMENTS:
1. Output MUST be a single valid JSON array. Do not include any prose, markdown fences, or explanation outside the JSON.
2. Each object must have exactly these keys: question, option1, option2, option3, option4, correctOption.
   - question: a clear, self-contained question.
   - option1..option4: four distinct answer choices.
   - correctOption: an integer 1, 2, 3, or 4 indicating which option is correct (never the answer text).
3. Difficulty mix: approximately 2 easy : 3 medium : 4 hard questions.
4. Do not repeat questions or ask about the same fact twice.
5. JSON validity: every string must be properly escaped. Never put a raw line break, tab, or unescaped double quote inside a string value. Do not use trailing commas.

CRITICAL - ANSWER OPTION BALANCE (follow strictly):
- Keep all four options for each question at a SIMILAR length and level of detail.
- The correct answer must NOT be systematically the longest or most detailed option.
- Randomize the position of the correct answer: distribute correctOption across 1, 2, 3, and 4 as evenly as possible (about 25% each).
- Sometimes the correct answer should be the SHORTEST option; other times a longer one. Vary this from question to question.
- Distractors (wrong options) must be plausible and close in length/specificity to the correct answer. Never make a distractor obviously absurd.
- Do not use "All of the above" or "None of the above".
- Ensure the four options are grammatically parallel so that length or detail does not reveal the answer.

--- SOURCE TEXT ---
${chunk}
`;

const generateBatch = async (chunk, count) => {
  let lastError;

  // A batch is retried once: the web model occasionally emits slightly
  // malformed JSON that only a fresh attempt can fix.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await handleIndividualPrompt(buildPrompt(chunk, count));
      const parsed = parseJsonArray(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
};

export const make_mcqs = async (longText, options = {}) => {
  const text = String(longText || "").trim();
  if (!text) {
    throw new Error("No source text provided to generate questions from");
  }

  const requestedCount = Number(options.count ?? options.numberOfQuestions);
  const target =
    Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.floor(requestedCount)
      : TARGET_TOTAL;

  const sentences = splitIntoSentences(text);
  const desiredBatches = Math.max(1, Math.ceil(target / BATCH_SIZE));
  const availableChunks = Math.max(
    1,
    Math.ceil(text.length / CHARS_PER_CHUNK),
    Math.ceil(sentences.length / 6)
  );
  const batchCount = Math.min(MAX_BATCHES, desiredBatches, availableChunks);
  const chunks = chunkSentences(sentences, batchCount);
  const perBatch = Math.min(BATCH_SIZE, Math.ceil(target / batchCount));

  const all = [];
  const seen = new Set();
  const errors = [];

  for (const chunk of chunks) {
    let batch = [];
    try {
      batch = await generateBatch(chunk, perBatch);
    } catch (err) {
      // Skip a failed batch rather than failing the whole generation.
      errors.push(err);
      continue;
    }

    for (const q of batch) {
      if (!q || typeof q !== "object") continue;
      const key = String(q.question || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(q);
    }
  }

  if (all.length === 0 && errors.length > 0) {
    throw errors[0];
  }

  return all;
};
