/**
 * Quick Test: Study 2 — 4 input modes × 1 trial each
 * 
 * Usage:
 *   cd ~/Downloads/b2a-experiment
 *   npm run dev                    # terminal 1
 *   node scripts/quick-test-s2.mjs # terminal 2
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local
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

const BASE_URL = "http://localhost:3000";
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];

async function runTrial(params) {
  const res = await fetch(`${BASE_URL}/api/run-study2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Study 2 Quick Test — 4 input modes × 1 trial");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const mode of INPUT_MODES) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  INPUT MODE: ${mode}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      const result = await runTrial({
        trialId: Math.floor(Math.random() * 10000),
        categoryId: "serum",
        condition: "social_proof_a",
        agency: "moderate",
        inputMode: mode,
        model: "gpt-4o-mini",
        temperature: 1.0,
        apiKeys: { openai: API_KEY },
      });

      // Print key info
      console.log(`\n  ✅ Trial complete`);
      console.log(`  Target:  #${result.targetProductId} ${result.targetBrand} (position ${result.targetPosition})`);
      console.log(`  Chosen:  #${result.chosenProductId} ${result.chosenBrand} (position ${result.chosenPosition})`);
      console.log(`  Hit:     ${result.choseTarget ? '🎯 YES' : '❌ NO'}`);
      console.log(`  Steps:   ${result.totalSteps}`);
      console.log(`  Viewed:  [${result.productsViewed.join(', ')}]`);
      console.log(`  Reviews: [${result.reviewsRead.join(', ')}]`);
      console.log(`  Cost:    $${result.estimatedCostUsd?.toFixed(4)} (${result.inputTokens}+${result.outputTokens} tokens)`);
      console.log(`  Time:    ${result.latencySec}s`);
      console.log(`  Reason:  ${result.reasoning?.slice(0, 150)}`);

      // Print tool call sequence
      console.log(`\n  Tool Calls:`);
      for (const tc of result.toolCalls) {
        const argsStr = JSON.stringify(tc.args);
        const resultPreview = tc.result?.slice(0, 300);
        console.log(`    [Step ${tc.step}] ${tc.tool}(${argsStr})`);
        console.log(`      → ${resultPreview}${tc.result?.length > 300 ? '...' : ''}`);
      }

      // Print system prompt
      console.log(`\n  System Prompt:`);
      console.log(`    ${result.systemPrompt?.slice(0, 300)}...`);

      // Print user prompt
      console.log(`\n  User Prompt:`);
      console.log(`    ${result.userPrompt}`);

      // Save full raw result
      const outPath = path.join(ROOT, `results/study2/quick_test_${mode}.json`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(`\n  📁 Full raw result saved: ${outPath}`);

    } catch (err) {
      console.error(`\n  ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════════════════`);
  console.log(`  Done! Raw results in results/study2/quick_test_*.json`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
