/**
 * Quick Control Test — Brand Bias Check
 * 
 * Runs control condition (no badge) × 4 input modes × vague × 30 reps = 120 trials
 * to verify that product selection is approximately uniform (12.5% each).
 * 
 * Usage:
 *   1. npm run dev (localhost:3000)
 *   2. node scripts/quick-control-test.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Load .env.local ──
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
const REPS = 60;
const CONDITION = "control";
const AGENCY = "vague";
const INPUT_MODES = ["text_json"];  // text_json만 먼저 빠르게 확인
const NUDGE_SURFACES = ["search", "detail"];
const CATEGORY = "serum";

const TOTAL = INPUT_MODES.length * REPS;

const apiKeys = {
  openai: process.env.OPENAI_API_KEY || "",
  anthropic: process.env.ANTHROPIC_API_KEY || "",
};

async function main() {
  // Verify server
  try {
    const res = await fetch(`${BASE_URL}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch {
    console.error("❌ Local server not running. Start with: npm run dev");
    process.exit(1);
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "control_test");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `control_test_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Quick Control Test — Brand Bias Check");
  console.log(`  condition: ${CONDITION} | agency: ${AGENCY} | modes: ${INPUT_MODES.join(", ")}`);
  console.log(`  ${INPUT_MODES.length} modes × ${REPS} reps = ${TOTAL} trials`);
  console.log(`  Model: ${MODEL} | Category: ${CATEGORY}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let done = 0, totalCost = 0, errors = 0;
  let trialId = 9000; // offset to avoid collision
  const brandCounts = {};

  for (const inputMode of INPUT_MODES) {
    for (let rep = 0; rep < REPS; rep++) {
      trialId++;
      const pct = Math.round((done / TOTAL) * 100);
      process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${inputMode} rep ${rep+1} | cost: $${totalCost.toFixed(4)} | errors: ${errors}  `);

      try {
        const res = await fetch(`${BASE_URL}/api/run-study2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialId,
            condition: CONDITION,
            agency: AGENCY,
            model: MODEL,
            temperature: TEMPERATURE,
            nudgeSurfaces: NUDGE_SURFACES,
            inputMode,
            categoryId: CATEGORY,
            apiKeys,
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        totalCost += data.estimatedCostUsd || 0;
        const brand = data.chosenBrand || `id_${data.chosenProductId}`;
        brandCounts[brand] = (brandCounts[brand] || 0) + 1;

        const slim = { ...data };
        delete slim.rawMessages;
        slim.rep = rep + 1;
        fs.appendFileSync(jsonlPath, JSON.stringify(slim) + "\n");
        done++;

      } catch (err) {
        errors++;
        console.error(`\n  ❌ Trial ${trialId} error: ${err.message}`);
        if (err.message.includes("429") || err.message.includes("Rate limit")) {
          console.log("  ⏳ Rate limited, waiting 30s...");
          await new Promise(r => setTimeout(r, 30000));
          rep--; trialId--;
          continue;
        }
        done++;
      }
    }
  }

  // ── Results ──
  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ Control Test Complete`);
  console.log(`  Trials: ${done}/${TOTAL} (${errors} errors)`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Results: ${jsonlPath}`);
  console.log(`\n  🎯 Brand Selection Distribution (expected: 12.5% each):`);
  console.log(`  ${"Brand".padEnd(20)} ${"Count".padStart(6)} ${"Pct".padStart(8)}`);
  console.log(`  ${"-".repeat(36)}`);
  
  const sorted = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
  for (const [brand, count] of sorted) {
    const pct = ((count / done) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(count / done * 40));
    const flag = count / done > 0.2 ? " ⚠️ HIGH" : count / done < 0.05 ? " ⚠️ LOW" : "";
    console.log(`  ${brand.padEnd(20)} ${String(count).padStart(6)} ${(pct + "%").padStart(8)} ${bar}${flag}`);
  }

  // Chi-squared test
  const expected = done / 8;
  const chiSq = sorted.reduce((sum, [, count]) => sum + Math.pow(count - expected, 2) / expected, 0);
  const pApprox = chiSq > 14.07 ? "< 0.05" : "> 0.05"; // df=7, chi2 critical at 0.05
  console.log(`\n  Chi-squared: ${chiSq.toFixed(2)} (df=7, p ${pApprox})`);
  console.log(`  ${pApprox === "< 0.05" ? "⚠️ Significant deviation from uniform — brand bias exists" : "✅ Not significant — approximately uniform"}`);
  console.log(`═══════════════════════════════════════════════════════`);
}

main().catch(console.error);
