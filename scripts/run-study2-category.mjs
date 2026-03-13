/**
 * Study 2 Multi-Category Experiment Runner
 * 
 * Multi-step agent with tool calls.
 * 6 conditions × 3 agency × 4 input modes × N reps per category
 * Screenshot mode: agent.ts handles per-step rendering via Puppeteer
 * 
 * Usage:
 *   cd ~/Downloads/b2a-experiment
 *   npm run dev
 *   node scripts/run-study2-category.mjs smartwatch 30
 * 
 * Results: results/study2/{category}_experiment_TIMESTAMP.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CATEGORY = process.argv[2] || "smartwatch";
const REPS = parseInt(process.argv[3] || "30", 10);
const VALID = ["serum", "smartwatch", "milk", "dress"];
if (!VALID.includes(CATEGORY)) { console.error(`❌ Invalid: "${CATEGORY}". Use: ${VALID.join(", ")}`); process.exit(1); }

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) { console.error("❌ .env.local not found"); process.exit(1); }
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("="); process.env[k.trim()] = v.join("=").trim();
  }
}
loadEnv();
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error("❌ OPENAI_API_KEY not found"); process.exit(1); }

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific"];
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];  // ★ screenshot included
const TOTAL = CONDITIONS.length * AGENCIES.length * INPUT_MODES.length * REPS;

const CONCURRENCY = parseInt(process.env.CONCURRENCY || "8", 10);

function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

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

async function runTrial(params) {
  const res = await fetch(`${BASE_URL}/api/run-study2`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "study2");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `${CATEGORY}_experiment_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Study 2 (Multi-Step) — Category: ${CATEGORY.toUpperCase()}`);
  console.log(`  ${CONDITIONS.length}×${AGENCIES.length}×${INPUT_MODES.length}×${REPS} = ${TOTAL} trials`);
  console.log(`  Modes: ${INPUT_MODES.join(", ")}`);
  console.log(`  Model: ${MODEL} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let done = 0, hits = 0, totalCost = 0, errors = 0, trialId = 0;
  const startTime = Date.now();

  for (const condition of CONDITIONS) {
    for (const agency of AGENCIES) {
      for (const mode of INPUT_MODES) {
        // Build batch of tasks for this cell (all reps)
        const tasks = [];
        for (let rep = 0; rep < REPS; rep++) {
          trialId++;
          const tid = trialId;
          const seed = genSeed(tid);
          const r = rep + 1;
          tasks.push(async () => {
            const result = await runTrial({
              trialId: tid, categoryId: CATEGORY, condition, agency, inputMode: mode,
              model: MODEL, temperature: TEMPERATURE, seed,
              apiKeys: { openai: API_KEY },
            });
            result.rep = r;
            result.agency = agency;
            result.inputMode = mode;
            result.categoryId = CATEGORY;
            return result;
          });
        }

        // Run batch in parallel
        const results = await runParallel(tasks, CONCURRENCY);

        for (const result of results) {
          done++;
          if (result._error) {
            errors++;
            console.error(`\n  ❌ Error: ${result._error.message?.slice(0, 100)}`);
            continue;
          }
          if (result.error) { errors++; continue; }
          if (result.choseTarget) hits++;
          totalCost += result.estimatedCostUsd || 0;
          fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
        }

        const rate = done > 0 ? (done / ((Date.now() - startTime) / 1000)).toFixed(2) : "?";
        const eta = done > 0 ? Math.round((TOTAL - done) / (done / ((Date.now() - startTime) / 1000))) : "?";
        const pct = Math.round((done / TOTAL) * 100);
        process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${condition}×${agency}×${mode} | hits:${hits} ${totalCost.toFixed(3)} | ${rate}t/s ETA:${eta}s  `);
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ ${CATEGORY.toUpperCase()} Study 2 — Complete!`);
  console.log(`  Trials: ${done}/${TOTAL} (${errors} errors)`);
  console.log(`  Hits: ${hits}/${done} (${done > 0 ? Math.round(hits/done*100) : 0}%)`);
  console.log(`  Cost: $${totalCost.toFixed(4)} | Time: ${totalTime}s`);
  console.log(`  Results: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════");

  const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n")
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  
  console.log(`\n── Selection Rate by Condition ──`);
  for (const c of CONDITIONS) {
    const sub = lines.filter(t => t.condition === c);
    if (!sub.length) continue;
    console.log(`  ${c.padEnd(18)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }
  
  console.log(`\n── Selection Rate by Agency ──`);
  for (const a of AGENCIES) {
    const sub = lines.filter(t => t.agency === a);
    if (!sub.length) continue;
    console.log(`  ${a.padEnd(18)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }
  
  console.log(`\n── Selection Rate by Mode ──`);
  for (const m of INPUT_MODES) {
    const sub = lines.filter(t => t.inputMode === m);
    if (!sub.length) continue;
    console.log(`  ${m.padEnd(18)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }
}

main().catch(err => { console.error("\n❌ Fatal:", err.message); process.exit(1); });
