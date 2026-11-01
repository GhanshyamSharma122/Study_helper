/**
 * Shared helpers for extracting/parsing JSON from model responses.
 * Used by mcq_generator and qna_generator/scorer.
 */

export const extractJsonArray = (text) => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not find a JSON array in the model response");
  }
  return cleaned.slice(start, end + 1);
};

export const escapeRawControlChars = (json) => {
  let out = "";
  let inString = false;

  for (let i = 0; i < json.length; i += 1) {
    const ch = json[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

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

export const removeTrailingCommas = (json) => json.replace(/,\s*([}\]])/g, "$1");

export const parseJsonArray = (text) => {
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

/**
 * Extract the first balanced JSON object from a model response.
 */
export const extractJsonObject = (text) => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not find a JSON object in the model response");
  }
  return cleaned.slice(start, end + 1);
};

export const parseJsonObject = (text) => {
  const raw = extractJsonObject(text);

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