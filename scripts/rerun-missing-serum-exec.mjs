/**
 * Re-run only the 30 missing serum trials.
 * Appends results to the same JSONL file.
 * 
 * Usage:
 *   npm run dev
 *   node scripts/rerun-missing-serum-exec.mjs
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

const MISSING = [
  { trialId: 476,  condition: "control",        agency: "cautious", mode: "screenshot" },
  { trialId: 721,  condition: "scarcity",       agency: "specific", mode: "text_json" },
  { trialId: 723,  condition: "scarcity",       agency: "specific", mode: "text_json" },
  { trialId: 724,  condition: "scarcity",       agency: "specific", mode: "text_json" },
  { trialId: 725,  condition: "scarcity",       agency: "specific", mode: "text_json" },
  { trialId: 782,  condition: "scarcity",       agency: "specific", mode: "html" },
  { trialId: 948,  condition: "scarcity",       agency: "cautious", mode: "screenshot" },
  { trialId: 949,  condition: "scarcity",       agency: "cautious", mode: "screenshot" },
  { trialId: 950,  condition: "scarcity",       agency: "cautious", mode: "screenshot" },
  { trialId: 1064, condition: "social_proof_a", agency: "vague",    mode: "screenshot" },
  { trialId: 1263, condition: "social_proof_a", agency: "specific", mode: "html" },
  { trialId: 2123, condition: "urgency",        agency: "moderate", mode: "html" },
  { trialId: 2381, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2386, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2387, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2388, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2389, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2390, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2391, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2392, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2393, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2394, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2395, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2396, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2397, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2398, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2399, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2400, condition: "urgency",        agency: "cautious", mode: "screenshot" },
  { trialId: 2780, condition: "authority_a",    agency: "cautious", mode: "text_json" },
  { trialId: 3555, condition: "price_anchoring",agency: "moderate", mode: "html" },
];

async function runTrial(params) {
  const res = await fetch(`${BASE_URL}/api/run-study2`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  console.log(`=== Re-running ${MISSING.length} missing serum trials ===`);
  console.log(`Appending to: ${JSONL_PATH}\n`);

  let done = 0, hits = 0, errors = 0;

  for (const m of MISSING) {
    const seed = genSeed(m.trialId);
    try {
      const result = await runTrial({
        trialId: m.trialId, categoryId: "serum", condition: m.condition,
        agency: m.agency, inputMode: m.mode,
        model: "gpt-4o-mini", temperature: 1, seed,
        apiKeys: { openai: API_KEY },
      });
      result.agency = m.agency;
      result.inputMode = m.mode;
      result.categoryId = "serum";
      result._rerun = true;

      fs.appendFileSync(JSONL_PATH, JSON.stringify(result) + "\n");
      done++;
      if (result.choseTarget) hits++;
      console.log(`  ✅ [${done}/${MISSING.length}] t${m.trialId} ${m.condition}×${m.agency}×${m.mode} → ${result.chosenBrand} ${result.choseTarget ? "HIT" : ""}`);
    } catch (err) {
      errors++;
      console.error(`  ❌ [${done + errors}/${MISSING.length}] t${m.trialId}: ${err.message.slice(0, 100)}`);
      // Wait and retry once
      await new Promise(r => setTimeout(r, 5000));
      try {
        const result = await runTrial({
          trialId: m.trialId, categoryId: "serum", condition: m.condition,
          agency: m.agency, inputMode: m.mode,
          model: "gpt-4o-mini", temperature: 1, seed,
          apiKeys: { openai: API_KEY },
        });
        result.agency = m.agency;
        result.inputMode = m.mode;
        result.categoryId = "serum";
        result._rerun = true;
        fs.appendFileSync(JSONL_PATH, JSON.stringify(result) + "\n");
        done++;
        errors--;
        if (result.choseTarget) hits++;
        console.log(`  ✅ [${done}/${MISSING.length}] t${m.trialId} RETRY OK → ${result.chosenBrand}`);
      } catch (err2) {
        console.error(`  ❌ t${m.trialId} RETRY FAILED: ${err2.message.slice(0, 100)}`);
      }
    }

    // Small delay between trials
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Done: ${done}/${MISSING.length} | Hits: ${hits} | Errors: ${errors}`);
  console.log(`${"=".repeat(50)}`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
