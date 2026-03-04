// ──────────────────────────────────────────────
//  Server-side Results Store
//  Saves each trial as append to JSONL + 
//  maintains a full JSON file per batch
// ──────────────────────────────────────────────

import fs from "fs";
import path from "path";

const RESULTS_DIR = path.join(process.cwd(), "results");
const STUDY1_DIR = path.join(RESULTS_DIR, "study1");
const STUDY2_DIR = path.join(RESULTS_DIR, "study2");

function ensureDir(dir?: string) {
  const d = dir || RESULTS_DIR;
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

/**
 * Append a single trial to a JSONL file (one JSON object per line).
 * File name: results/trials_YYYY-MM-DD.jsonl
 * 
 * JSONL is append-safe — no corruption risk even if the process crashes mid-batch.
 */
export function appendTrial(trial: Record<string, any>): void {
  const study = trial.study === 2 ? "study2" : "study1";
  const dir = study === "study2" ? STUDY2_DIR : STUDY1_DIR;
  ensureDir(dir);
  const date = new Date().toISOString().slice(0, 10);
  const filePath = path.join(dir, `trials_${date}.jsonl`);
  const line = JSON.stringify(trial) + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

/**
 * Save a complete batch summary after all trials finish.
 * File name: results/batch_YYYY-MM-DDTHH-MM-SS.json
 */
export function saveBatch(trials: Record<string, any>[]): void {
  ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(RESULTS_DIR, `batch_${timestamp}.json`);
  const data = {
    meta: {
      savedAt: new Date().toISOString(),
      totalTrials: trials.length,
      conditions: [...new Set(trials.map((t) => t.condition))],
      models: [...new Set(trials.map((t) => t.model))],
    },
    trials,
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * List all saved result files.
 */
export function listResultFiles(): string[] {
  ensureDir();
  return fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".jsonl") || f.endsWith(".json"));
}
