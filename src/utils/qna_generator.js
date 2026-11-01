import { handleIndividualPrompt } from "./ai_service.js";
import { parseJsonArray } from "./json_utils.js";

const TARGET_TOTAL = 20;
const MAX_BATCHES = 6;
const BATCH_SIZE = 10;
const CHARS_PER_CHUNK = 1500;

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
You are an expert educator creating open-ended short-answer questions.

From the source text provided below, create exactly ${count} question-and-answer pairs.

REQUIREMENTS:
1. Output MUST be a single valid JSON array. No prose, markdown fences, or explanation outside the JSON.
2. Each object must have exactly these keys: question, answer, keywords.
   - question: a clear, self-contained open-ended question.
   - answer: a concise but complete reference answer (2-5 sentences) a student should give.
   - keywords: an array of 3-6 key terms/concepts the answer should contain.
3. Vary difficulty: easy, medium, hard.
4. Do not repeat questions.
5. JSON validity: every string properly escaped; no raw line breaks; no trailing commas.

--- SOURCE TEXT ---
${chunk}
`;

const generateBatch = async (chunk, count) => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await handleIndividualPrompt(buildPrompt(chunk, count));
      const parsed = parseJsonArray(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((q) => q && typeof q === "object" && q.question && q.answer)
        .map((q) => ({
          question: String(q.question).trim(),
          answer: String(q.answer).trim(),
          keywords: Array.isArray(q.keywords)
            ? q.keywords.map((k) => String(k).trim()).filter(Boolean)
            : [],
        }));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const make_qna = async (longText, options = {}) => {
  const text = String(longText || "").trim();
  if (!text) throw new Error("No source text provided to generate questions from");

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
      errors.push(err);
      continue;
    }

    for (const q of batch) {
      const key = String(q.question || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(q);
      if (all.length >= target) break;
    }
    if (all.length >= target) break;
  }

  if (all.length === 0 && errors.length > 0) {
    throw errors[0];
  }

  return all.slice(0, target);
};