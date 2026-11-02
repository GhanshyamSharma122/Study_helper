import { handleIndividualPrompt } from "./ai_service.js";
import { parseJsonObject } from "./json_utils.js";

const buildPrompt = ({ question, referenceAnswer, userAnswer, keywords }) => `
You are a lenient grader for open-ended short-answer questions.

Question: ${question}

Reference answer (what a correct response should cover): ${referenceAnswer}

${keywords && keywords.length ? "Key concepts expected: " + keywords.join(", ") + "\n" : ""}
Student answer (may contain typos or speech-to-text errors): ${userAnswer}

GRADING RULES:
- Ignore minor spelling, grammar, and speech-to-text errors; judge conceptual coverage.
- Accept synonyms, equivalent terminology, and clear paraphrases when they preserve the meaning of the reference answer. Do not require the student to use the reference answer's exact wording.
- Do not accept an answer merely because it is related to the topic: the required concept must still be present.
- Penalize incorrect claims and missing essential concepts. Do not infer or assume a missing concept just because the answer mentions a related idea.
- Score from 0 to 10 (integer) based on accurate conceptual coverage. Give near-full or full credit when the meaning is correct despite different terminology; reduce the score when important parts are missing or incorrect.
- "missing" must list short phrases of key points/concepts from the reference that are NOT adequately covered. Empty array if none.
- "feedback" is one short sentence of constructive feedback.

Return ONLY a valid JSON object with keys: score, missing, feedback. No prose outside JSON.
`;

export const score_answer = async ({ question, referenceAnswer, userAnswer, keywords }) => {
  const prompt = buildPrompt({ question, referenceAnswer, userAnswer, keywords });

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await handleIndividualPrompt(prompt);
      const parsed = parseJsonObject(raw);
      const score = Math.max(0, Math.min(10, Math.round(Number(parsed.score))));
      return {
        score: Number.isFinite(score) ? score : 0,
        missing: Array.isArray(parsed.missing)
          ? parsed.missing.map((m) => String(m).trim()).filter(Boolean)
          : [],
        feedback: String(parsed.feedback || "").trim(),
      };
    } catch (err) {
      lastError = err;
    }
  }

  // Graceful fallback: never hard-fail the UI.
  return {
    score: null,
    missing: [],
    feedback:
      "Could not grade this answer automatically. Please try again. (" +
      (lastError?.message || "unknown error") +
      ")",
  };
};
