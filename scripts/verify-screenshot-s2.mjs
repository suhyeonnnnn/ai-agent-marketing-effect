/**
 * Verify Study 2 screenshot mode — runs 1 actual trial via the SAME API
 * that run-study2-category.mjs uses, then extracts and saves screenshots
 * from rawMessages for manual inspection.
 * 
 * Usage:
 *   npm run dev  (server must be running with latest code)
 *   node scripts/verify-screenshot-s2.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3000";

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

async function main() {
  console.log("=== Study 2 Screenshot Verification ===\n");

  // Test all 4 categories
  const categories = ["serum", "smartwatch", "milk", "dress"];
  let allPassed = true;

  for (const cat of categories) {
    console.log(`── ${cat.toUpperCase()} ──`);
    console.log("  Calling /api/run-study2 (screenshot mode)...");

    const res = await fetch(`${BASE_URL}/api/run-study2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trialId: 99990, categoryId: cat, condition: "social_proof_a",
        agency: "vague", inputMode: "screenshot",
        model: "gpt-4o-mini", temperature: 1, seed: 12345,
        apiKeys: { openai: API_KEY },
      }),
    });

    if (!res.ok) {
      console.error(`  ❌ HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      allPassed = false;
      continue;
    }

    const result = await res.json();
    if (result.error) {
      console.error(`  ❌ API error: ${result.error}`);
      allPassed = false;
      continue;
    }

    console.log(`  Chosen: ${result.chosenBrand} | Hit: ${result.choseTarget} | Steps: ${result.totalSteps}`);

    // Extract screenshots from rawMessages
    let imgIdx = 0;
    let hasImages = false;
    for (const msg of result.rawMessages || []) {
      if (!Array.isArray(msg.content)) continue;
      for (const item of msg.content) {
        if (item.type !== "image_url") continue;
        const url = item.image_url?.url || "";
        if (!url.startsWith("data:image")) continue;
        imgIdx++;
        const b64 = url.split(",")[1];
        const buf = Buffer.from(b64, "base64");
        const ssPath = path.join(ROOT, "results", `verify_s2_${cat}_img${imgIdx}.jpg`);
        fs.writeFileSync(ssPath, buf);
        console.log(`  Saved: verify_s2_${cat}_img${imgIdx}.jpg (${Math.round(buf.length / 1024)}KB)`);
        hasImages = true;
      }
    }

    if (!hasImages) {
      console.error(`  ❌ No screenshot images found in rawMessages!`);
      allPassed = false;
    } else {
      console.log(`  ✅ ${imgIdx} screenshots extracted`);
    }
    console.log();
  }

  // Final verdict
  console.log("=".repeat(55));
  if (allPassed) {
    console.log("  ✅ ALL CATEGORIES PASSED — SAFE TO RE-RUN STUDY 2");
  } else {
    console.log("  ❌ SOME CATEGORIES FAILED — DO NOT RE-RUN");
  }
  console.log("=".repeat(55));
  console.log("\n  Open results/verify_s2_*.jpg files to visually confirm images!");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
