/**
 * JSONL → CSV Converter for B2A Experiment
 * 
 * Usage:
 *   node scripts/export-csv.mjs results/260323/study1/serum_experiment_*.jsonl
 *   node scripts/export-csv.mjs results/260323/study2/serum_experiment_*.jsonl
 *
 * Output: same path with .csv extension
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/export-csv.mjs <jsonl-file>");
  process.exit(1);
}

const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
if (!fs.existsSync(fullPath)) {
  console.error(`❌ File not found: ${fullPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(fullPath, "utf-8").trim().split("\n");
const rows = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

if (rows.length === 0) {
  console.error("❌ No valid JSON lines found");
  process.exit(1);
}

// Detect study type
const isStudy2 = rows[0].toolCalls !== undefined;

// Column definitions
const STUDY1_COLS = [
  "trialId", "condition", "categoryId", "promptType", "funnel", "inputMode", "model",
  "targetProductId", "targetBrand", "targetPosition",
  "chosenProductId", "chosenBrand", "chosenPosition", "chosenPrice", "chosenRating",
  "choseTarget", "reasoning",
  "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
  "seed", "temperature", "rep",
];

const STUDY2_COLS = [
  "trialId", "condition", "categoryId", "funnel", "inputMode", "model",
  "targetProductId", "targetBrand", "targetPosition",
  "chosenProductId", "chosenBrand", "chosenPosition", "chosenPrice", "chosenRating",
  "choseTarget", "reasoning",
  "totalSteps", "attentionActions", "considerationActions", "selectionActions",
  "productsViewed", "reviewsRead",
  "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
  "seed", "temperature", "rep",
];

const cols = isStudy2 ? STUDY2_COLS : STUDY1_COLS;

function escapeCSV(val) {
  if (val === null || val === undefined) return "";
  const s = Array.isArray(val) ? val.join(";") : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const header = cols.join(",");
const csvRows = rows.map(r => {
  // Map agency → funnel if needed
  if (!r.funnel && r.agency) r.funnel = r.agency;
  if (!r.funnel && r.promptType) r.funnel = r.promptType;
  return cols.map(c => escapeCSV(r[c])).join(",");
});

const csvContent = [header, ...csvRows].join("\n");
const outputPath = fullPath.replace(/\.jsonl$/, ".csv");
fs.writeFileSync(outputPath, csvContent);

console.log(`✅ Exported ${rows.length} rows × ${cols.length} columns`);
console.log(`   Study: ${isStudy2 ? "2 (multi-step)" : "1 (one-shot)"}`);
console.log(`   Output: ${outputPath}`);
