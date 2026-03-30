/**
 * S1 vs S2 Control Comparison Test
 * 
 * Runs both Study 1 (single-turn) and Study 2 (multi-step) control conditions
 * to compare brand selection distribution.
 * 
 * Study 1: POST /api/run-experiment (single-turn, search only)
 * Study 2: POST /api/run-study2 (multi-step, search + view + review)
 * 
 * Both: control × text_json × vague × 30 reps
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
const CONDITION = "control";
const AGENCY = "vague";
const INPUT_MODE = "text_json";
const CATEGORY = "serum";

const apiKeys = {
  openai: process.env.OPENAI_API_KEY || "",
  anthropic: process.env.ANTHROPIC_API_KEY || "",
};

const ID_TO_BRAND = {1:'Veladerm',2:'Lumiveil',3:'Puraflora',4:'Dewbloom',5:'Solbright',6:'Hydraveil',7:'Mellowskin',8:'Glowture'};

// ── Run Study 1 trials ──
async function runStudy1(reps) {
  const results = [];
  for (let rep = 0; rep < reps; rep++) {
    const trialId = 8000 + rep + 1;
    process.stdout.write(`\r  S1: [${Math.round(rep/reps*100)}%] ${rep}/${reps}`);
    try {
      const res = await fetch(`${BASE_URL}/api/run-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialId,
          condition: CONDITION,
          promptType: AGENCY,
          promptVariant: "default",
          model: MODEL,
          temperature: TEMPERATURE,
          inputMode: INPUT_MODE,
          categoryId: CATEGORY,
          enableManipCheck: false,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      results.push(data);
    } catch (err) {
      console.error(`\n  ❌ S1 Trial ${trialId}: ${err.message}`);
      if (err.message.includes("429")) {
        await new Promise(r => setTimeout(r, 30000));
        rep--; continue;
      }
    }
  }
  return results;
}

// ── Run Study 2 trials ──
async function runStudy2(reps) {
  const results = [];
  for (let rep = 0; rep < reps; rep++) {
    const trialId = 9000 + rep + 1;
    process.stdout.write(`\r  S2: [${Math.round(rep/reps*100)}%] ${rep}/${reps}`);
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
          nudgeSurfaces: ["search", "detail"],
          inputMode: INPUT_MODE,
          categoryId: CATEGORY,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      results.push(data);
    } catch (err) {
      console.error(`\n  ❌ S2 Trial ${trialId}: ${err.message}`);
      if (err.message.includes("429")) {
        await new Promise(r => setTimeout(r, 30000));
        rep--; continue;
      }
    }
  }
  return results;
}

// ── Print distribution ──
function printDistribution(label, results) {
  const counts = {};
  for (const d of results) {
    const brand = d.chosenBrand || `id_${d.chosenProductId}`;
    counts[brand] = (counts[brand] || 0) + 1;
  }
  const n = results.length;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  console.log(`\n  ${label} (n=${n}):`);
  console.log(`  ${"Brand".padEnd(15)} ${"Count".padStart(6)} ${"Pct".padStart(8)}  Bar`);
  console.log(`  ${"-".repeat(50)}`);
  for (const [brand, count] of sorted) {
    const pct = (count / n * 100).toFixed(1);
    const bar = "█".repeat(Math.round(count / n * 30));
    const flag = count / n > 0.2 ? " ⚠️" : count / n < 0.05 ? " ⚠️LOW" : "";
    console.log(`  ${brand.padEnd(15)} ${String(count).padStart(6)} ${(pct + "%").padStart(8)}  ${bar}${flag}`);
  }
  
  // Chi-squared
  const expected = n / 8;
  const chiSq = sorted.reduce((sum, [, c]) => sum + Math.pow(c - expected, 2) / expected, 0);
  // Add 0 counts for missing brands
  const missingCount = 8 - sorted.length;
  const chiSqTotal = chiSq + missingCount * Math.pow(expected, 2) / expected;
  const sig = chiSqTotal > 14.07 ? "< 0.05 ⚠️" : "> 0.05 ✅";
  console.log(`  Chi-sq: ${chiSqTotal.toFixed(2)} (df=7, p ${sig})`);
  
  // Position analysis
  const posCounts = {};
  for (const d of results) {
    const pos = d.chosenPosition || 0;
    posCounts[pos] = (posCounts[pos] || 0) + 1;
  }
  console.log(`  Position: ${Object.entries(posCounts).sort((a,b)=>a[0]-b[0]).map(([p,c])=>`P${p}:${c}`).join(' ')}`);
}

// ── Main ──
async function main() {
  try {
    await fetch(BASE_URL);
  } catch {
    console.error("❌ Server not running. Start with: npm run dev");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  S1 vs S2 Control Comparison");
  console.log(`  ${CONDITION} × ${INPUT_MODE} × ${AGENCY} × ${REPS} reps each`);
  console.log(`  Model: ${MODEL} | Category: ${CATEGORY}`);
  console.log("═══════════════════════════════════════════════════════");

  console.log("\n── Running Study 1 (single-turn) ──");
  const s1 = await runStudy1(REPS);
  console.log(`\r  S1: Done (${s1.length} trials)          `);
  
  console.log("\n── Running Study 2 (multi-step) ──");
  const s2 = await runStudy2(REPS);
  console.log(`\r  S2: Done (${s2.length} trials)          `);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  
  printDistribution("Study 1 (single-turn)", s1);
  printDistribution("Study 2 (multi-step)", s2);
  
  // Save results
  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "control_test");
  fs.mkdirSync(outDir, { recursive: true });
  
  const s1Path = path.join(outDir, `s1_control_${ts}.jsonl`);
  const s2Path = path.join(outDir, `s2_control_${ts}.jsonl`);
  for (const d of s1) fs.appendFileSync(s1Path, JSON.stringify(d) + "\n");
  for (const d of s2) fs.appendFileSync(s2Path, JSON.stringify(d) + "\n");
  
  console.log(`\n  Saved: ${s1Path}`);
  console.log(`  Saved: ${s2Path}`);
  console.log("═══════════════════════════════════════════════════════");
}

main().catch(console.error);
