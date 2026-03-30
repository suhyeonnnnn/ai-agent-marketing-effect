/**
 * Re-run the 41 invalid screenshot trials (chosenProductId = 0 or null).
 * Finds invalid trials from JSONL, then re-runs them and appends to same file.
 * 
 * Usage:
 *   1. npm run dev  (start Next.js dev server)
 *   2. node scripts/rerun-invalid-screenshot.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("="); process.env[k.trim()] = v.join("=").trim();
  }
}
loadEnv();

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = "http://localhost:3000";
const RUN_ID = process.env.RUN_ID || "260314_1";
const JSONL_PATH = path.join(ROOT, "results", RUN_ID, "study2", "serum_experiment_2026-03-14T06-39-32.jsonl");

function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

// ── Step 1: Find invalid trials ──
const lines = fs.readFileSync(JSONL_PATH, "utf-8").split("\n").filter(l => l.trim());
const allTrials = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Find invalid: chosenProductId is 0, null, or -1, and not a test
const invalid = allTrials.filter(d => 
  !d._test && 
  (d.chosenProductId === 0 || d.chosenProductId === null || d.chosenProductId === -1 || d.chosenProductId === undefined)
);

console.log(`\n=== Invalid Trial Analysis ===`);
console.log(`Total trials in JSONL: ${allTrials.length}`);
console.log(`Invalid trials: ${invalid.length}`);

if (invalid.length === 0) {
  console.log("No invalid trials found. Exiting.");
  process.exit(0);
}

// Show breakdown
const byMode = {};
const byCond = {};
const byAgency = {};
for (const d of invalid) {
  byMode[d.inputMode] = (byMode[d.inputMode] || 0) + 1;
  byCond[d.condition] = (byCond[d.condition] || 0) + 1;
  byAgency[d.agency] = (byAgency[d.agency] || 0) + 1;
}
console.log("\nBy mode:", byMode);
console.log("By condition:", byCond);
console.log("By agency:", byAgency);

// Extract trial params for re-run
const toRerun = invalid.map(d => ({
  trialId: d.trialId,
  condition: d.condition,
  agency: d.agency || d.promptType,
  inputMode: d.inputMode,
  seed: d.seed || genSeed(d.trialId),
}));

console.log(`\nWill re-run ${toRerun.length} trials...\n`);

// ── Step 2: Re-run via API ──
const DELAY = 1500; // ms between trials
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTrial(params) {
  const url = `${BASE_URL}/api/run-study2`;
  const body = {
    trialId: params.trialId,
    condition: params.condition,
    model: "gpt-4o-mini",
    temperature: 1.0,
    nudgeSurfaces: ["search", "detail"],
    inputMode: params.inputMode,
    apiKeys: { openai: API_KEY },
    categoryId: "serum",
    agency: params.agency,
  };
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  
  return await res.json();
}

let success = 0;
let failed = 0;

for (let i = 0; i < toRerun.length; i++) {
  const p = toRerun[i];
  const tag = `[${i+1}/${toRerun.length}] t${p.trialId} ${p.condition}/${p.agency}/${p.inputMode}`;
  
  try {
    const result = await runTrial(p);
    
    // Mark as rerun
    result._rerun = true;
    result._rerun_reason = "invalid_screenshot";
    
    // Append to JSONL
    fs.appendFileSync(JSONL_PATH, "\n" + JSON.stringify(result));
    
    const hit = result.choseTarget ? "✅ HIT" : "   miss";
    const pid = result.chosenProductId || "INVALID";
    console.log(`${tag} → ${hit} (chose ${pid}, ${result.totalSteps || '?'} steps)`);
    
    if (result.chosenProductId && result.chosenProductId !== 0) {
      success++;
    } else {
      failed++;
      console.log(`  ⚠️  Still invalid after rerun`);
    }
  } catch (err) {
    console.error(`${tag} → ❌ ERROR: ${err.message}`);
    failed++;
  }
  
  await sleep(DELAY);
}

console.log(`\n=== Done ===`);
console.log(`Success: ${success}/${toRerun.length}`);
console.log(`Still invalid: ${failed}/${toRerun.length}`);
console.log(`\nRe-export CSV: python3 scripts/export-study2-serum-csv.py`);
