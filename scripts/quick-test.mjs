/**
 * Quick Test: 1 trial만 돌려서 결과 확인
 * 
 * Usage:
 *   node scripts/quick-test.mjs s1 text_json serum scarcity
 *   node scripts/quick-test.mjs s1 text_flat smartwatch authority
 *   node scripts/quick-test.mjs s1 html dress price_anchoring
 *   node scripts/quick-test.mjs s1 screenshot milk social_proof
 *   node scripts/quick-test.mjs s2 text_json serum authority
 *   node scripts/quick-test.mjs s2 text_flat milk price_anchoring moderate
 * 
 * Args:
 *   [1] study:    s1 | s2
 *   [2] mode:     text_json | text_flat | html | screenshot
 *   [3] category: serum | smartwatch | milk | dress
 *   [4] condition: control | scarcity | social_proof | urgency | authority | price_anchoring
 *   [5] agency:   vague | moderate | specific (default: vague)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const study    = process.argv[2] || "s1";
const mode     = process.argv[3] || "text_json";
const category = process.argv[4] || "serum";
const condition= process.argv[5] || "scarcity";
const agency   = process.argv[6] || "vague";

const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
const outDir = path.join(ROOT, "results", study === "s2" ? "study2" : "study1");
fs.mkdirSync(outDir, { recursive: true });
const jsonlPath = path.join(outDir, `quick_${study}_${mode}_${category}_${condition}_${ts}.jsonl`);

// ── Puppeteer for screenshot ──
async function renderScreenshot(htmlContent) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;font-family:Arial,sans-serif;">${htmlContent}</body></html>`, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  const buf = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
  await page.close();
  await browser.close();
  return buf.toString("base64");
}

async function main() {
  console.log(`\n  ${study.toUpperCase()} | ${mode} | ${category} | ${condition} | agency=${agency}\n`);

  if (study === "s1") {
    const params = {
      condition, promptType: agency, inputMode: mode,
      model: "gpt-4o-mini", trialId: 1, temperature: 1.0, categoryId: category,
      apiKeys: { openai: API_KEY },
    };

    if (mode === "screenshot") {
      const dry = await fetch(`${BASE_URL}/api/run-trial`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, inputMode: "html", dryRun: true }),
      }).then(r => r.json());
      const base64 = await renderScreenshot(dry.productsHtml);
      params.screenshotBase64 = base64;

      // Save screenshot to file
      const ssDir = path.join(ROOT, "results", "study1", "screenshots");
      fs.mkdirSync(ssDir, { recursive: true });
      const filename = `s1_${category}_${condition}_${agency}_t1.jpg`;
      fs.writeFileSync(path.join(ssDir, filename), Buffer.from(base64, "base64"));
      console.log(`  📸 Saved: screenshots/${filename}`);
    }

    const res = await fetch(`${BASE_URL}/api/run-trial`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const d = await res.json();
    if (d.error) { console.error("❌", d.error); process.exit(1); }

    console.log(`  target:  ${d.targetBrand} (pos ${d.targetPosition})`);
    console.log(`  chosen:  ${d.chosenBrand} (pos ${d.chosenPosition})`);
    console.log(`  hit:     ${d.choseTarget ? "✅ YES" : "❌ no"}`);
    console.log(`  reason:  ${d.reasoning?.substring(0, 120)}`);
    console.log(`  tokens:  ${d.inputTokens} in / ${d.outputTokens} out`);
    console.log(`  cost:    $${d.estimatedCostUsd?.toFixed(5)}`);

    fs.writeFileSync(jsonlPath, JSON.stringify(d, null, 2));

  } else {
    const res = await fetch(`${BASE_URL}/api/run-study2`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition, model: "gpt-4o-mini", trialId: 1, temperature: 1.0,
        categoryId: category, agency, inputMode: mode,
        apiKeys: { openai: API_KEY },
      }),
    });
    const d = await res.json();
    if (d.error) { console.error("❌", d.error); process.exit(1); }

    console.log(`  target:  ${d.targetBrand} (pos ${d.targetPosition})`);
    console.log(`  chosen:  ${d.chosenBrand} (pos ${d.chosenPosition})`);
    console.log(`  hit:     ${d.choseTarget ? "✅ YES" : "❌ no"}`);
    console.log(`  steps:   ${d.totalSteps}`);
    console.log(`  tools:   ${d.toolCalls?.map(t => t.tool).join(" → ")}`);
    console.log(`  reason:  ${d.reasoning?.substring(0, 120)}`);
    console.log(`  tokens:  ${d.inputTokens} in / ${d.outputTokens} out`);
    console.log(`  cost:    $${d.estimatedCostUsd?.toFixed(5)}`);

    fs.writeFileSync(jsonlPath, JSON.stringify(d, null, 2));
  }

  console.log(`\n  → ${jsonlPath}\n`);
}

main().catch(err => { console.error("❌ Fatal:", err.message); process.exit(1); });
