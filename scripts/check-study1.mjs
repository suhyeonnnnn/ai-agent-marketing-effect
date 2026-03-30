/**
 * Check Study 1 data completeness for all categories.
 * Usage: node scripts/check-study1.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RUN_ID = process.env.RUN_ID || "260314_1";
const DIR = path.join(ROOT, "results", RUN_ID, "study1");

const FILES = {
  serum: "serum_experiment_2026-03-14T11-22-18.jsonl",
  smartwatch: "smartwatch_experiment_2026-03-14T11-50-11.jsonl",
  milk: "milk_experiment_2026-03-14T12-19-15.jsonl",
  dress: "dress_experiment_2026-03-14T12-47-38.jsonl",
};

for (const [cat, file] of Object.entries(FILES)) {
  const filepath = path.join(DIR, file);
  if (!fs.existsSync(filepath)) { console.log(`❌ ${cat}: file not found`); continue; }

  const rl = readline.createInterface({ input: fs.createReadStream(filepath), crlfDelay: Infinity });
  let total = 0, testLines = 0;
  const trialIds = new Set();

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line);
      if (d._test) { testLines++; continue; }
      total++;
      trialIds.add(d.trialId);
    } catch {}
  }

  const missing = [];
  for (let i = 1; i <= 3840; i++) {
    if (!trialIds.has(i)) missing.push(i);
  }

  const status = missing.length === 0 ? "✅" : "⚠️";
  console.log(`${status} ${cat}: ${total}/3840 trials (${missing.length} missing)${testLines ? ` [${testLines} test lines]` : ""}`);
  if (missing.length > 0 && missing.length <= 10) {
    console.log(`   Missing: ${missing.join(", ")}`);
  }
}
