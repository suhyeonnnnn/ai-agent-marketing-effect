/**
 * Study 2 Full Experiment Runner
 * 
 * Calls the local Next.js API route which uses the full
 * agent.ts + tools.ts pipeline (function calling loop).
 * 
 * 6 conditions × 30 reps = 180 trials
 * Model: GPT-4o Mini (moderate agency, text_json mode fixed)
 * 
 * Usage:
 *   1. Make sure `npm run dev` is running (localhost:3000)
 *   2. node scripts/run-study2-full.mjs
 * 
 * Results saved to: results/study2/experiment_TIMESTAMP.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Load .env.local for API keys ──
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) { console.error("❌ .env.local not found"); process.exit(1); }
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    process.env[key.trim()] = rest.join("=").trim();
  }
}
loadEnv();

// ── Config ──
const BASE_URL = "http://localhost:3000";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const REPS = 30;
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];
const NUDGE_SURFACES = ["search", "detail"];

const TOTAL = CONDITIONS.length * INPUT_MODES.length * REPS;

// ── Get API keys from env ──
const apiKeys = {
  openai: process.env.OPENAI_API_KEY || "",
  anthropic: process.env.ANTHROPIC_API_KEY || "",
  gemini: process.env.GEMINI_API_KEY || "",
};

// ── Main ──
async function main() {
  // Verify server is running
  try {
    const res = await fetch(`${BASE_URL}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (err) {
    console.error("❌ Local server not running. Start with: npm run dev");
    process.exit(1);
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "study2");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `experiment_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Study 2 Full Experiment (Multi-Step Agent)");
  console.log(`  ${CONDITIONS.length} conditions × ${INPUT_MODES.length} modes × ${REPS} reps = ${TOTAL} trials`);
  console.log(`  Model: ${MODEL} | Modes: ${INPUT_MODES.join(", ")} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let done = 0, hits = 0, totalCost = 0, errors = 0;
  let trialId = 0;

  for (const condition of CONDITIONS) {
    for (const inputMode of INPUT_MODES) {
      for (let rep = 0; rep < REPS; rep++) {
        trialId++;
        const pct = Math.round((done / TOTAL) * 100);
        process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${condition} × ${inputMode} (rep ${rep+1}) | hits: ${hits} | cost: ${totalCost.toFixed(4)} | errors: ${errors}  `);

        try {
          const res = await fetch(`${BASE_URL}/api/run-study2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trialId,
              condition,
              model: MODEL,
              temperature: TEMPERATURE,
              nudgeSurfaces: NUDGE_SURFACES,
              inputMode,
              apiKeys,
            }),
          });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.choseTarget) hits++;
        totalCost += data.estimatedCostUsd || 0;

        // Save without rawMessages (too large)
        const slim = { ...data };
        delete slim.rawMessages; // save space
        slim.rep = rep + 1;

        fs.appendFileSync(jsonlPath, JSON.stringify(slim) + "\n");
        done++;
      } catch (err) {
        errors++;
        console.error(`\n  ❌ Trial ${trialId} error: ${err.message}`);
        
        if (err.message.includes("Rate limit") || err.message.includes("429")) {
          console.log("  ⏳ Rate limited, waiting 30s...");
          await new Promise(r => setTimeout(r, 30000));
          rep--; trialId--;
          continue;
        }
        
        // Timeout — Study 2 can take long due to multi-step
        if (err.message.includes("timeout") || err.message.includes("ECONNRESET")) {
          console.log("  ⏳ Timeout, waiting 10s and retrying...");
          await new Promise(r => setTimeout(r, 10000));
          rep--; trialId--;
          continue;
        }
        
        done++;
      }
      }
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ Complete!`);
  console.log(`  Trials: ${done}/${TOTAL} (${errors} errors)`);
  console.log(`  Target hits: ${hits}/${done} (${done > 0 ? Math.round(hits/done*100) : 0}%)`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Results: ${jsonlPath}`);
  console.log(`═══════════════════════════════════════════════════════`);

  // Quick summary
  if (fs.existsSync(jsonlPath)) {
    const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").map(l => JSON.parse(l));
    
    // Cleanup puppeteer if screenshot mode was used
    try {
      const resp = await fetch(`${BASE_URL}/api/cleanup`, { method: "POST" }).catch(() => {});
    } catch {}

    console.log("\n── Selection Rate by Condition ──");
    for (const cond of CONDITIONS) {
      const sub = lines.filter(t => t.condition === cond);
      const rate = sub.filter(t => t.choseTarget).length / sub.length;
      console.log(`  ${cond.padEnd(18)} ${(rate * 100).toFixed(1)}% (${sub.filter(t => t.choseTarget).length}/${sub.length})`);
    }

    console.log("\n── Selection Rate by Input Mode ──");
    for (const mode of INPUT_MODES) {
      const sub = lines.filter(t => t.inputMode === mode);
      const rate = sub.filter(t => t.choseTarget).length / sub.length;
      console.log(`  ${mode.padEnd(18)} ${(rate * 100).toFixed(1)}% (${sub.filter(t => t.choseTarget).length}/${sub.length})`);
    }

    console.log("\n── Condition × Input Mode (selection rate %) ──");
    console.log(`  ${"Condition".padEnd(18)} ${INPUT_MODES.map(m=>m.padEnd(12)).join("")}`);
    for (const cond of CONDITIONS) {
      const row = INPUT_MODES.map(m => {
        const sub = lines.filter(t => t.condition === cond && t.inputMode === m);
        return sub.length > 0 ? (sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)+"%" : "N/A";
      });
      console.log(`  ${cond.padEnd(18)} ${row.map(r=>r.padEnd(12)).join("")}`);
    }

    console.log("\n── Behavioral Metrics by Condition ──");
    console.log(`  ${"Condition".padEnd(18)} ${"Steps".padEnd(8)} ${"Viewed".padEnd(8)} ${"Reviews".padEnd(8)}`);
    for (const cond of CONDITIONS) {
      const sub = lines.filter(t => t.condition === cond);
      const avgSteps = (sub.reduce((s,t) => s + t.totalSteps, 0) / sub.length).toFixed(1);
      const avgViewed = (sub.reduce((s,t) => s + (t.productsViewed?.length || 0), 0) / sub.length).toFixed(1);
      const avgReviews = (sub.reduce((s,t) => s + (t.reviewsRead?.length || 0), 0) / sub.length).toFixed(1);
      console.log(`  ${cond.padEnd(18)} ${avgSteps.padEnd(8)} ${avgViewed.padEnd(8)} ${avgReviews.padEnd(8)}`);
    }

    // First view rank of target
    console.log("\n── Target First-View Rank by Condition ──");
    for (const cond of CONDITIONS) {
      const sub = lines.filter(t => t.condition === cond);
      const ranks = sub.map(t => {
        const viewOrder = (t.toolCalls || [])
          .filter(c => c.tool === "view_product")
          .map(c => c.args?.product_id)
          .filter((v, i, a) => a.indexOf(v) === i); // unique, first occurrence
        const idx = viewOrder.indexOf(t.targetProductId);
        return idx >= 0 ? idx + 1 : null;
      }).filter(r => r !== null);
      const avgRank = ranks.length > 0 ? (ranks.reduce((s,r) => s+r, 0) / ranks.length).toFixed(1) : "N/A";
      const viewedTarget = ranks.length;
      console.log(`  ${cond.padEnd(18)} avg rank: ${avgRank.padEnd(6)} (${viewedTarget}/${sub.length} viewed target)`);
    }
  }
}

main().catch(console.error);
