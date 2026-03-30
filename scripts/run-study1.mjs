/**
 * Study 1 Experiment Runner (Clean Version)
 * 
 * One-shot product selection via API route (/api/run-trial).
 * Uses categories.ts for products + prompts (no hardcoded data).
 *
 * Design:
 *   8 conditions × 3 funnel (TOFU/MOFU/BOFU) × 4 input modes × N reps
 *   per category. N must be a multiple of 8 for balanced target rotation.
 *
 * Usage:
 *   cd ~/Downloads/b2a-experiment
 *   npm run dev
 *   node scripts/run-study1.mjs serum 32
 *   node scripts/run-study1.mjs smartwatch 32
 *
 * Results: results/{RUN_ID}/study1/{category}_experiment_TIMESTAMP.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Args ──
const CATEGORY = process.argv[2] || "serum";
const REPS = parseInt(process.argv[3] || "1", 10);
const VALID = ["serum", "smartwatch", "milk", "dress"];
if (!VALID.includes(CATEGORY)) {
  console.error(`❌ Invalid category: "${CATEGORY}". Use: ${VALID.join(", ")}`);
  process.exit(1);
}
// Note: for balanced target rotation, use multiples of 8

// ── Load .env.local ──
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
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error("❌ OPENAI_API_KEY not found"); process.exit(1); }

// ── Config ──
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const FUNNELS = ["vague", "moderate", "specific"];  // TOFU, MOFU, BOFU
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];
const TOTAL = CONDITIONS.length * FUNNELS.length * INPUT_MODES.length * REPS;

const CONCURRENCY = parseInt(process.env.CONCURRENCY || "8", 10);
const RUN_ID = process.env.RUN_ID || "260314_1";

// ── Parallel execution with concurrency limit ──
async function runParallel(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]().catch(err => ({ _error: err }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// ── Call API route ──
async function runTrial(params) {
  const res = await fetch(`${BASE_URL}/api/run-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── Main ──
async function main() {
  try {
    const res = await fetch(`${BASE_URL}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch {
    console.error("❌ Local server not running. Start with: npm run dev");
    process.exit(1);
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", RUN_ID, "study1");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `${CATEGORY}_experiment_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Study 1 (One-Shot) — Category: ${CATEGORY.toUpperCase()}`);
  console.log(`  ${CONDITIONS.length}×${FUNNELS.length}×${INPUT_MODES.length}×${REPS} = ${TOTAL} trials`);
  console.log(`  Funnels: ${FUNNELS.join(", ")}`);
  console.log(`  Modes: ${INPUT_MODES.join(", ")}`);
  console.log(`  Model: ${MODEL} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let done = 0, hits = 0, totalCost = 0, errors = 0, trialId = 0;
  const startTime = Date.now();

  for (const condition of CONDITIONS) {
    for (const funnel of FUNNELS) {
      for (const mode of INPUT_MODES) {
        const tasks = [];
        for (let rep = 0; rep < REPS; rep++) {
          trialId++;
          const tid = trialId;
          const r = rep + 1;
          tasks.push(async () => {
            const result = await runTrial({
              trialId: tid,
              categoryId: CATEGORY,
              condition,
              promptType: funnel,
              inputMode: mode,
              model: MODEL,
              temperature: TEMPERATURE,
              enableManipCheck: false,
              apiKeys: { openai: API_KEY },
            });
            result.rep = r;
            result.funnel = funnel;
            result.inputMode = mode;
            result.categoryId = CATEGORY;
            return result;
          });
        }

        const results = await runParallel(tasks, CONCURRENCY);

        for (const result of results) {
          done++;
          if (result._error) {
            errors++;
            const msg = result._error.message?.slice(0, 100) || "unknown";
            console.error(`\n  ❌ Error: ${msg}`);
            if (msg.includes("rate") || msg.includes("429")) {
              console.log("  ⏳ Rate limited, waiting 30s...");
              await new Promise(r => setTimeout(r, 30000));
            }
            continue;
          }
          if (result.error) { errors++; continue; }
          if (result.choseTarget) hits++;
          totalCost += result.estimatedCostUsd || 0;
          fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const rate = done > 0 ? (done / elapsed).toFixed(2) : "?";
        const eta = done > 0 ? Math.round((TOTAL - done) / (done / elapsed)) : "?";
        const pct = Math.round((done / TOTAL) * 100);
        process.stdout.write(
          `\r  [${pct}%] ${done}/${TOTAL} | ${condition}×${funnel}×${mode} | ` +
          `hits:${hits} $${totalCost.toFixed(3)} | ${rate}t/s ETA:${eta}s  `
        );
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ ${CATEGORY.toUpperCase()} Study 1 — Complete!`);
  console.log(`  Trials: ${done}/${TOTAL} (${errors} errors)`);
  console.log(`  Hits: ${hits}/${done} (${done > 0 ? Math.round(hits / done * 100) : 0}%)`);
  console.log(`  Cost: $${totalCost.toFixed(4)} | Time: ${totalTime}s`);
  console.log(`  Results: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════");

  const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n")
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  console.log(`\n── Selection Rate by Condition ──`);
  for (const c of CONDITIONS) {
    const sub = lines.filter(t => t.condition === c);
    if (!sub.length) continue;
    const hitN = sub.filter(t => t.choseTarget).length;
    console.log(`  ${c.padEnd(18)} ${(hitN / sub.length * 100).toFixed(1)}% (${hitN}/${sub.length})`);
  }

  console.log(`\n── Selection Rate by Funnel ──`);
  for (const f of FUNNELS) {
    const sub = lines.filter(t => (t.funnel || t.promptType) === f);
    if (!sub.length) continue;
    const hitN = sub.filter(t => t.choseTarget).length;
    console.log(`  ${f.padEnd(18)} ${(hitN / sub.length * 100).toFixed(1)}% (${hitN}/${sub.length})`);
  }

  console.log(`\n── Selection Rate by Mode ──`);
  for (const m of INPUT_MODES) {
    const sub = lines.filter(t => t.inputMode === m);
    if (!sub.length) continue;
    const hitN = sub.filter(t => t.choseTarget).length;
    console.log(`  ${m.padEnd(18)} ${(hitN / sub.length * 100).toFixed(1)}% (${hitN}/${sub.length})`);
  }

  process.exit(0);
}

main().catch(err => { console.error("\n❌ Fatal:", err.message); process.exit(1); });
