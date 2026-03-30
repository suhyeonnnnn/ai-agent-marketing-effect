/**
 * Control Test — Study 1 + Study 2 Brand Bias Check
 * 
 * Study 1: single-turn (search → select)
 * Study 2: multi-step (search → view → review → select)
 * Both: control condition, vague, text_json, 60 reps
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
const REPS = 80;
const CONDITION = "control";
const AGENCY = "vague";
const INPUT_MODE = "text_json";
const CATEGORY = "serum";

const apiKeys = {
  openai: process.env.OPENAI_API_KEY || "",
  anthropic: process.env.ANTHROPIC_API_KEY || "",
};

function printResults(label, brandCounts, total, hitCount) {
  console.log(`\n  🎯 ${label} Brand Selection Distribution (expected: 12.5% each):`);
  console.log(`  ${"Brand".padEnd(20)} ${"Count".padStart(6)} ${"Pct".padStart(8)}`);
  console.log(`  ${"-".repeat(36)}`);
  const sorted = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
  for (const [brand, count] of sorted) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(count / total * 40));
    const flag = count / total > 0.2 ? " ⚠️" : count / total < 0.05 ? " ⚠️LOW" : "";
    console.log(`  ${brand.padEnd(20)} ${String(count).padStart(6)} ${(pct + "%").padStart(8)} ${bar}${flag}`);
  }
  const expected = total / 8;
  const chiSq = sorted.reduce((sum, [, count]) => sum + Math.pow(count - expected, 2) / expected, 0);
  const pApprox = chiSq > 14.07 ? "< 0.05 ⚠️" : "> 0.05 ✅";
  console.log(`  Chi-sq: ${chiSq.toFixed(2)} (df=7, p ${pApprox})`);
  if (hitCount !== undefined) {
    const hitRate = ((hitCount / total) * 100).toFixed(1);
    console.log(`  Hit rate (choseTarget): ${hitCount}/${total} = ${hitRate}% (baseline: 12.5%)`);
  }
  
  return { sorted, chiSq };
}

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

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Control Test — Study 1 + Study 2");
  console.log(`  condition: ${CONDITION} | agency: ${AGENCY} | mode: ${INPUT_MODE}`);
  console.log(`  ${REPS} reps each | Model: ${MODEL} | Category: ${CATEGORY}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Study 1 ──
  console.log("  ── Study 1 (single-turn) ──");
  const s1Path = path.join(outDir, `s1_control_${ts}.jsonl`);
  let s1Done = 0, s1Cost = 0, s1Errors = 0, s1Hits = 0;
  let s1TrialId = 8000;
  const s1Brands = {};
  const s1Positions = {};

  for (let rep = 0; rep < REPS; rep++) {
    s1TrialId++;
    process.stdout.write(`\r  [${Math.round(rep/REPS*100)}%] ${rep}/${REPS} | cost: $${s1Cost.toFixed(4)} | errors: ${s1Errors}  `);

    try {
      const res = await fetch(`${BASE_URL}/api/run-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialId: s1TrialId,
          condition: CONDITION,
          promptType: AGENCY,
          inputMode: INPUT_MODE,
          model: MODEL,
          temperature: TEMPERATURE,
          categoryId: CATEGORY,
          enableManipCheck: false,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      s1Cost += data.estimatedCostUsd || 0;
      const brand = data.chosenBrand || `id_${data.chosenProductId}`;
      s1Brands[brand] = (s1Brands[brand] || 0) + 1;
      const pos = data.chosenPosition || 0;
      s1Positions[`P${pos}`] = (s1Positions[`P${pos}`] || 0) + 1;
      if (data.choseTarget) s1Hits++;

      const slim = { ...data }; delete slim.rawResponse;
      slim.rep = rep + 1;
      fs.appendFileSync(s1Path, JSON.stringify(slim) + "\n");
      s1Done++;
    } catch (err) {
      s1Errors++;
      if (err.message.includes("429")) {
        console.log("\n  ⏳ Rate limited, waiting 30s...");
        await new Promise(r => setTimeout(r, 30000));
        rep--; s1TrialId--;
        continue;
      }
      s1Done++;
    }
  }

  console.log(`\n  Study 1: ${s1Done}/${REPS} trials, ${s1Cost.toFixed(4)}, ${s1Errors} errors`);
  printResults("Study 1 (single-turn)", s1Brands, s1Done, s1Hits);
  const posStr = Object.entries(s1Positions).sort().map(([k,v]) => `${k}:${v}`).join(" ");
  console.log(`  Position: ${posStr}`);

  // ── Study 2 ──
  console.log("\n  ── Study 2 (multi-step) ──");
  const s2Path = path.join(outDir, `s2_control_${ts}.jsonl`);
  let s2Done = 0, s2Cost = 0, s2Errors = 0, s2Hits = 0;
  let s2TrialId = 9000;
  const s2Brands = {};
  const s2Positions = {};

  for (let rep = 0; rep < REPS; rep++) {
    s2TrialId++;
    process.stdout.write(`\r  [${Math.round(rep/REPS*100)}%] ${rep}/${REPS} | cost: $${s2Cost.toFixed(4)} | errors: ${s2Errors}  `);

    try {
      const res = await fetch(`${BASE_URL}/api/run-study2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialId: s2TrialId,
          condition: CONDITION,
          agency: AGENCY,
          model: MODEL,
          temperature: TEMPERATURE,
          nudgeSurfaces: ["search", "detail"],
          inputMode: INPUT_MODE,
          categoryId: CATEGORY,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      s2Cost += data.estimatedCostUsd || 0;
      const brand = data.chosenBrand || `id_${data.chosenProductId}`;
      s2Brands[brand] = (s2Brands[brand] || 0) + 1;
      const pos = data.chosenPosition || 0;
      s2Positions[`P${pos}`] = (s2Positions[`P${pos}`] || 0) + 1;
      if (data.choseTarget) s2Hits++;

      const slim = { ...data }; delete slim.rawMessages;
      slim.rep = rep + 1;
      fs.appendFileSync(s2Path, JSON.stringify(slim) + "\n");
      s2Done++;
    } catch (err) {
      s2Errors++;
      if (err.message.includes("429")) {
        console.log("\n  ⏳ Rate limited, waiting 30s...");
        await new Promise(r => setTimeout(r, 30000));
        rep--; s2TrialId--;
        continue;
      }
      s2Done++;
    }
  }

  console.log(`\n  Study 2: ${s2Done}/${REPS} trials, ${s2Cost.toFixed(4)}, ${s2Errors} errors`);
  printResults("Study 2 (multi-step)", s2Brands, s2Done, s2Hits);
  const posStr2 = Object.entries(s2Positions).sort().map(([k,v]) => `${k}:${v}`).join(" ");
  console.log(`  Position: ${posStr2}`);

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  printResults(`Study 1 (single-turn) (n=${s1Done})`, s1Brands, s1Done, s1Hits);
  console.log(`  Position: ${posStr}`);
  printResults(`Study 2 (multi-step) (n=${s2Done})`, s2Brands, s2Done, s2Hits);
  console.log(`  Position: ${posStr2}`);
  console.log(`\n  Total cost: $${(s1Cost + s2Cost).toFixed(4)}`);
  console.log("═══════════════════════════════════════════════════════");
}

main().catch(console.error);
