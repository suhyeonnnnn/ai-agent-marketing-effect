/**
 * Quick analysis of serum JSONL — count trials, errors, missing trialIds
 * Usage: node scripts/check-serum.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "results", "260314_1", "study2", "serum_experiment_2026-03-14T06-39-32.jsonl");

const rl = readline.createInterface({ input: fs.createReadStream(FILE), crlfDelay: Infinity });

let total = 0;
let errors = 0;
let testLines = 0;
const trialIds = new Set();
const condCounts = {};
const modeCounts = {};
const agencyCounts = {};

for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const d = JSON.parse(line);
    if (d._test) { testLines++; continue; }
    total++;
    trialIds.add(d.trialId);
    
    const cond = d.condition || "?";
    const mode = d.inputMode || "?";
    const agency = d.agency || "?";
    condCounts[cond] = (condCounts[cond] || 0) + 1;
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    agencyCounts[agency] = (agencyCounts[agency] || 0) + 1;
    
    if (d.error) errors++;
  } catch {
    errors++;
  }
}

console.log(`=== Serum Study 2 Data Check ===`);
console.log(`Total trials: ${total}`);
console.log(`Test lines: ${testLines}`);
console.log(`Parse errors: ${errors}`);
console.log(`Unique trialIds: ${trialIds.size}`);
console.log(`Expected: 3840`);
console.log(`Missing: ${3840 - trialIds.size}`);
console.log();

// Find missing trialIds
const missing = [];
for (let i = 1; i <= 3840; i++) {
  if (!trialIds.has(i)) missing.push(i);
}
if (missing.length > 0) {
  console.log(`Missing trialIds (${missing.length}):`);
  // Group into ranges for readability
  if (missing.length <= 50) {
    console.log(`  ${missing.join(", ")}`);
  } else {
    console.log(`  First 20: ${missing.slice(0, 20).join(", ")}`);
    console.log(`  Last 20: ${missing.slice(-20).join(", ")}`);
  }
}

console.log();
console.log(`By condition:`);
Object.entries(condCounts).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log();
console.log(`By input mode:`);
Object.entries(modeCounts).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log();
console.log(`By agency:`);
Object.entries(agencyCounts).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
