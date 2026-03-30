/**
 * Find and rerun missing/failed trials from a Study 2 JSONL result file.
 * 
 * Usage:
 *   node scripts/retry-missing-s2.mjs results/260323_2/study2/serum_experiment_*.jsonl
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
  console.error("Usage: node scripts/retry-missing-s2.mjs <jsonl-file>");
  process.exit(1);
}

const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
const lines = fs.readFileSync(fullPath, "utf-8").trim().split("\n");
const trials = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const FUNNELS = ["vague", "moderate", "specific"];
const MODES = ["text_json", "text_flat", "html", "screenshot"];

// Count trials per cell
const cellCounts = {};
for (const t of trials) {
  const funnel = t.funnel || t.agency || t.promptType;
  const key = `${t.condition}|${funnel}|${t.inputMode}`;
  cellCounts[key] = (cellCounts[key] || 0) + 1;
}

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
        missing.push({ condition: cond, funnel, inputMode: mode, have: count, need: maxReps - count });
      }
    }
  }
}

if (missing.length === 0) {
  console.log("✅ No missing trials! All cells have full reps.");
  process.exit(0);
}

const totalMissing = missing.reduce((s, m) => s + m.need, 0);
console.log(`\n❌ Missing ${totalMissing} trials in ${missing.length} cells:\n`);
for (const m of missing) {
  console.log(`  ${m.condition} × ${m.funnel} × ${m.inputMode}: have ${m.have}/${maxReps} (need ${m.need} more)`);
}

// Rerun missing trials
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const categoryId = trials[0]?.categoryId || "serum";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "8", 10);

console.log(`\n🔄 Rerunning ${totalMissing} trials (concurrency: ${CONCURRENCY})...\n`);

let done = 0, hits = 0, errors = 0;
let trialId = Math.max(...trials.map(t => t.trialId)) + 1;

// Build task list
const tasks = [];
for (const m of missing) {
  for (let r = 0; r < m.need; r++) {
    const tid = trialId++;
    tasks.push(async () => {
      const params = {
        condition: m.condition,
        agency: m.funnel,
        inputMode: m.inputMode,
        categoryId,
        model: MODEL,
        trialId: tid,
        temperature: TEMPERATURE,
        apiKeys: {},
      };

      try {
        const res = await fetch(`${BASE_URL}/api/run-study2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();

        fs.appendFileSync(fullPath, "\n" + JSON.stringify(result));
        done++;
        if (result.choseTarget) hits++;
        process.stdout.write(`  [${done}/${totalMissing}] ${m.condition}×${m.funnel}×${m.inputMode} → ${result.chosenBrand || "?"} ${result.choseTarget ? "✅" : "  "}\r`);
        return result;
      } catch (err) {
        errors++;
        console.error(`\n  ❌ Error (t${tid}): ${err.message}`);
        return null;
      }
    });
  }
}

// Run with concurrency limit
async function runParallel(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

await runParallel(tasks, CONCURRENCY);

console.log(`\n\n✅ Retry complete: ${done}/${totalMissing} trials rerun (${errors} errors, ${hits} hits)`);
console.log(`   Appended to: ${fullPath}`);
