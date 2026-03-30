/**
 * Find what condition/agency/mode the missing 30 trials belong to,
 * then re-run only those.
 * 
 * Usage: node scripts/rerun-missing-serum.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "results", "260314_1", "study2", "serum_experiment_2026-03-14T06-39-32.jsonl");

const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific", "cautious"];
const MODES = ["text_json", "text_flat", "html", "screenshot"];
const REPS = 30;

// Reconstruct trialId → (condition, agency, mode, rep) mapping
// This must match the loop order in run-study2-category.mjs
function getTrialParams(trialId) {
  let id = 0;
  for (const condition of CONDITIONS) {
    for (const agency of AGENCIES) {
      for (const mode of MODES) {
        for (let rep = 0; rep < REPS; rep++) {
          id++;
          if (id === trialId) {
            return { condition, agency, mode, rep: rep + 1 };
          }
        }
      }
    }
  }
  return null;
}

// Missing trialIds from check-serum output
const MISSING = [476, 721, 723, 724, 725, 782, 948, 949, 950, 1064, 1263, 2123, 2381, 2386, 2387, 2388, 2389, 2390, 2391, 2392, 2393, 2394, 2395, 2396, 2397, 2398, 2399, 2400, 2780, 3555];

console.log(`=== Missing ${MISSING.length} Serum Trials ===\n`);
console.log("TrialId | Condition | Agency | Mode | Rep");
console.log("--------|-----------|--------|------|----");

const byMode = {};
for (const tid of MISSING) {
  const p = getTrialParams(tid);
  if (p) {
    console.log(`  ${tid.toString().padStart(4)} | ${p.condition.padEnd(16)} | ${p.agency.padEnd(8)} | ${p.mode.padEnd(10)} | ${p.rep}`);
    byMode[p.mode] = (byMode[p.mode] || 0) + 1;
  }
}

console.log("\nBy mode:");
Object.entries(byMode).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log(`\nTotal missing: ${MISSING.length}`);
console.log(`Estimated cost: ~$${(MISSING.length * 0.013).toFixed(2)}`);
