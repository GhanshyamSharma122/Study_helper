import { spawn } from "node:child_process";
import path from "node:path";

export const extractTextFromImage = (imageBuffer) => new Promise((resolve, reject) => {
  const python = process.env.OCR_PYTHON || "python";
  const script = path.join(process.cwd(), "scripts", "trocr_extract.py");
  const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  const timeout = setTimeout(() => child.kill(), Number(process.env.OCR_TIMEOUT_MS) || 120000);

  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.on("error", (error) => {
    clearTimeout(timeout);
    reject(new Error(`OCR service could not start: ${error.message}`));
  });
  child.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      reject(new Error(Buffer.concat(stderr).toString().trim() || "OCR failed"));
      return;
    }
    try {
      const result = JSON.parse(Buffer.concat(stdout).toString());
      if (!result.text || !String(result.text).trim()) throw new Error("No text was detected");
      resolve(String(result.text).trim());
    } catch (error) {
      reject(new Error(`OCR returned an invalid result: ${error.message}`));
    }
  });

  child.stdin.end(imageBuffer);
});
