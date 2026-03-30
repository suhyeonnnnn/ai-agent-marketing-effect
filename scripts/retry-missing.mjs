/**
 * Find and rerun missing/failed trials from a Study 1 JSONL result file.
 * 
 * Usage:
 *   node scripts/retry-missing.mjs results/260323_2/study1/serum_experiment_*.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local
function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) { console.error("❌ .env.local not found"); process.exit(1); }
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("=");
    process.env[k.trim()] = v.join("=").trim();
  }
}
loadEnv();

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/retry-missing.mjs <jsonl-file>");
  process.exit(1);
}

const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
const lines = fs.readFileSync(fullPath, "utf-8").trim().split("\n");
const trials = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Extract experiment params
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const FUNNELS = ["vague", "moderate", "specific"];
const MODES = ["text_json", "text_flat", "html", "screenshot"];

// Count trials per cell
const cellCounts = {};
for (const t of trials) {
  const funnel = t.funnel || t.promptType;
  const key = `${t.condition}|${funnel}|${t.inputMode}`;
  cellCounts[key] = (cellCounts[key] || 0) + 1;
}

// Determine expected reps
const maxReps = Math.max(...Object.values(cellCounts));
console.log(`\nFound ${trials.length} trials, expected reps/cell: ${maxReps}`);

// Find missing cells
const missing = [];
for (const cond of CONDITIONS) {
  for (const funnel of FUNNELS) {
    for (const mode of MODES) {
      const key = `${cond}|${funnel}|${mode}`;
      const count = cellCounts[key] || 0;
      if (count < maxReps) {
        const deficit = maxReps - count;
        missing.push({ condition: cond, funnel, inputMode: mode, have: count, need: deficit });
      }
    }
  }
}

if (missing.length === 0) {
  console.log("✅ No missing trials! All cells have full reps.");
  process.exit(0);
}

console.log(`\n❌ Missing ${missing.reduce((s, m) => s + m.need, 0)} trials in ${missing.length} cells:\n`);
for (const m of missing) {
  console.log(`  ${m.condition} × ${m.funnel} × ${m.inputMode}: have ${m.have}/${maxReps} (need ${m.need} more)`);
}

// Rerun missing trials
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const categoryId = trials[0]?.categoryId || "serum";

console.log(`\n🔄 Rerunning ${missing.reduce((s, m) => s + m.need, 0)} missing trials...\n`);

let done = 0, hits = 0, errors = 0;
const totalMissing = missing.reduce((s, m) => s + m.need, 0);
const startTrialId = Math.max(...trials.map(t => t.trialId)) + 1;
let trialId = startTrialId;

for (const m of missing) {
  for (let r = 0; r < m.need; r++) {
    const params = {
      condition: m.condition,
      promptType: m.funnel,
      inputMode: m.inputMode,
      categoryId,
      model: MODEL,
      trialId: trialId++,
      temperature: TEMPERATURE,
    };

    try {
      const res = await fetch(`${BASE_URL}/api/run-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      
      // Append to JSONL
      fs.appendFileSync(fullPath, "\n" + JSON.stringify(result));
      
      done++;
      if (result.choseTarget) hits++;
      process.stdout.write(`  [${done}/${totalMissing}] ${m.condition}×${m.funnel}×${m.inputMode} → ${result.chosenBrand} ${result.choseTarget ? "✅" : "  "}\r`);
    } catch (err) {
      errors++;
      console.error(`\n  ❌ Error: ${err.message}`);
    }
  }
}

console.log(`\n\n✅ Retry complete: ${done} trials rerun (${errors} errors, ${hits} hits)`);
console.log(`   Appended to: ${fullPath}`);
