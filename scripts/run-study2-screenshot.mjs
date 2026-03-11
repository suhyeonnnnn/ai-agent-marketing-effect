/**
 * Study 2 Screenshot-only Runner
 * 
 * Runs only screenshot mode trials (the ones that failed earlier).
 * Requires: npm run dev (localhost:3000)
 * 
 * Usage: node scripts/run-study2-screenshot.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

const BASE_URL = "http://localhost:3000";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const REPS = 30;
const CONDITIONS = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"];
const INPUT_MODE = "screenshot";

const TOTAL = CONDITIONS.length * REPS;

const apiKeys = {
  openai: process.env.OPENAI_API_KEY || "",
  anthropic: process.env.ANTHROPIC_API_KEY || "",
  gemini: process.env.GEMINI_API_KEY || "",
};

async function main() {
  try {
    const res = await fetch(`${BASE_URL}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch {
    console.error("❌ Local server not running. Start with: npm run dev");
    process.exit(1);
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "study2");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `experiment_screenshot_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Study 2 Screenshot Mode Only");
  console.log(`  ${CONDITIONS.length} conditions × ${REPS} reps = ${TOTAL} trials`);
  console.log(`  Model: ${MODEL} | Mode: ${INPUT_MODE} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let done = 0, hits = 0, totalCost = 0, errors = 0;
  let trialId = 1000; // offset to avoid seed collision with main run

  for (const condition of CONDITIONS) {
    for (let rep = 0; rep < REPS; rep++) {
      trialId++;
      const pct = Math.round((done / TOTAL) * 100);
      process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${condition} × screenshot (rep ${rep+1}) | hits: ${hits} | cost: $${totalCost.toFixed(4)} | errors: ${errors}  `);

      try {
        const res = await fetch(`${BASE_URL}/api/run-study2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialId,
            condition,
            model: MODEL,
            temperature: TEMPERATURE,
            nudgeSurfaces: ["search", "detail"],
            inputMode: INPUT_MODE,
            apiKeys,
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.choseTarget) hits++;
        totalCost += data.estimatedCostUsd || 0;

        const slim = { ...data };
        delete slim.rawMessages;
        slim.rep = rep + 1;
        slim.inputMode = INPUT_MODE;

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
        if (err.message.includes("timeout") || err.message.includes("ECONNRESET")) {
          console.log("  ⏳ Timeout, waiting 10s...");
          await new Promise(r => setTimeout(r, 10000));
          rep--; trialId--;
          continue;
        }
        done++;
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

  if (fs.existsSync(jsonlPath) && done > 0) {
    const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").map(l => JSON.parse(l));
    console.log("\n── Selection Rate by Condition ──");
    for (const cond of CONDITIONS) {
      const sub = lines.filter(t => t.condition === cond);
      if (sub.length === 0) continue;
      const rate = sub.filter(t => t.choseTarget).length / sub.length;
      console.log(`  ${cond.padEnd(18)} ${(rate * 100).toFixed(1)}% (${sub.filter(t => t.choseTarget).length}/${sub.length})`);
    }
  }
}

main().catch(console.error);
