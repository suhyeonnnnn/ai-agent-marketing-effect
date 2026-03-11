/**
 * Study 1 Multi-Category Experiment Runner (with Screenshot)
 * 
 * 6 conditions × 3 agency × 4 input modes × N reps
 * Screenshot mode: dryRun → get HTML → Puppeteer render → send base64
 * 
 * Usage:
 *   cd ~/Downloads/b2a-experiment
 *   npm run dev                         # start server first
 *   node scripts/run-category.mjs smartwatch 30
 *   node scripts/run-category.mjs milk 30
 *   node scripts/run-category.mjs dress 30
 *   node scripts/run-category.mjs serum 30
 * 
 * Results: results/study1/{category}_experiment_TIMESTAMP.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CATEGORY = process.argv[2] || "smartwatch";
const REPS = parseInt(process.argv[3] || "30", 10);
const VALID = ["serum", "smartwatch", "milk", "dress"];
if (!VALID.includes(CATEGORY)) { console.error(`❌ Invalid: "${CATEGORY}". Use: ${VALID.join(", ")}`); process.exit(1); }

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
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const CONDITIONS = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific"];
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];
const ENABLE_MANIP_CHECK = false;
const TOTAL = CONDITIONS.length * AGENCIES.length * INPUT_MODES.length * REPS;

function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

// ── Puppeteer (lazy load) ──
let browser = null;
async function getBrowser() {
  if (!browser) {
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
    console.log("  📸 Puppeteer launched");
  }
  return browser;
}

async function renderScreenshot(htmlContent) {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;font-family:Arial,sans-serif;">${htmlContent}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  const buf = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
  await page.close();
  return buf.toString("base64");
}

// ── API calls ──
async function callAPI(params) {
  const res = await fetch(`${BASE_URL}/api/run-trial`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function runScreenshotTrial(params) {
  // Step 1: dryRun to get HTML (no LLM call, instant)
  const dry = await callAPI({ ...params, inputMode: "html", dryRun: true });
  const html = dry.productsHtml;
  if (!html) throw new Error("dryRun returned no productsHtml");

  // Step 2: Render HTML → screenshot
  const base64 = await renderScreenshot(html);

  // Step 3: Save screenshot to file
  const ssDir = path.join(ROOT, "results", "study1", "screenshots");
  fs.mkdirSync(ssDir, { recursive: true });
  const filename = `s1_${params.categoryId}_${params.condition}_${params.promptType}_t${params.trialId}.jpg`;
  fs.writeFileSync(path.join(ssDir, filename), Buffer.from(base64, "base64"));

  // Step 4: Run real trial with screenshot
  const result = await callAPI({ ...params, inputMode: "screenshot", screenshotBase64: base64 });
  result.screenshotPath = `results/study1/screenshots/${filename}`;
  return result;
}

// ── Main ──
async function main() {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "study1");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `${CATEGORY}_experiment_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Study 1 — Category: ${CATEGORY.toUpperCase()}`);
  console.log(`  ${CONDITIONS.length}×${AGENCIES.length}×${INPUT_MODES.length}×${REPS} = ${TOTAL} trials`);
  console.log(`  Model: ${MODEL} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Verify server
  try {
    const check = await callAPI({ trialId: 0, categoryId: CATEGORY, condition: "control", promptType: "vague", inputMode: "text_json", model: MODEL, temperature: TEMPERATURE, apiKeys: { openai: API_KEY } });
    if (check.error?.includes("API key")) { console.error("❌ Invalid API key"); process.exit(1); }
    console.log(`  ✅ Server OK — chose ${check.chosenBrand || "?"}\n`);
    fs.appendFileSync(jsonlPath, JSON.stringify({ ...check, _test: true }) + "\n");
  } catch (err) {
    console.error(`❌ Server unreachable: ${err.message}`); process.exit(1);
  }

  let done = 0, hits = 0, totalCost = 0, errors = 0, trialId = 0;
  const startTime = Date.now();

  for (const condition of CONDITIONS) {
    for (const agency of AGENCIES) {
      for (const mode of INPUT_MODES) {
        for (let rep = 0; rep < REPS; rep++) {
          trialId++;
          const seed = genSeed(trialId);
          const rate = done > 0 ? (done / ((Date.now() - startTime) / 1000)).toFixed(1) : "?";
          const eta = done > 0 ? Math.round((TOTAL - done) / (done / ((Date.now() - startTime) / 1000))) : "?";
          const pct = Math.round((done / TOTAL) * 100);
          process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${condition}×${agency}×${mode} r${rep+1} | hits:${hits} $${totalCost.toFixed(3)} | ${rate}t/s ETA:${eta}s  `);

          try {
            const params = {
              trialId, categoryId: CATEGORY, condition, promptType: agency,
              promptVariant: "default", inputMode: mode, model: MODEL,
              temperature: TEMPERATURE, seed, enableManipCheck: ENABLE_MANIP_CHECK,
              apiKeys: { openai: API_KEY },
            };

            const result = mode === "screenshot"
              ? await runScreenshotTrial(params)
              : await callAPI(params);

            if (result.error) throw new Error(result.error);
            if (result.choseTarget) hits++;
            totalCost += result.estimatedCostUsd || 0;
            result.rep = rep + 1;
            result.agency = agency;
            fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
          } catch (err) {
            errors++;
            console.error(`\n  ❌ Trial ${trialId}: ${err.message.slice(0, 100)}`);
            if (err.message.includes("429") || err.message.includes("Rate limit")) {
              console.log("  ⏳ Rate limited — 30s..."); await new Promise(r => setTimeout(r, 30000));
              rep--; trialId--; continue;
            }
            if (err.message.includes("500") || err.message.includes("ECONNREFUSED")) {
              console.log("  ⏳ Server error — 5s..."); await new Promise(r => setTimeout(r, 5000));
            }
          }
          done++;
        }
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ ${CATEGORY.toUpperCase()} — Complete!`);
  console.log(`  Trials: ${done}/${TOTAL} (${errors} errors)`);
  console.log(`  Hits: ${hits}/${done} (${done > 0 ? Math.round(hits/done*100) : 0}%)`);
  console.log(`  Cost: $${totalCost.toFixed(4)} | Time: ${totalTime}s`);
  console.log(`  Results: ${jsonlPath}`);
  console.log(`═══════════════════════════════════════════════════════`);

  // Summary by condition
  console.log(`\n── Selection Rate by Condition ──`);
  const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n")
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(t => t && !t._test);
  for (const c of CONDITIONS) {
    const sub = lines.filter(t => t.condition === c);
    if (!sub.length) continue;
    console.log(`  ${c.padEnd(18)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }
  console.log(`\n── Selection Rate by Agency ──`);
  for (const a of AGENCIES) {
    const sub = lines.filter(t => t.promptType === a || t.agency === a);
    if (!sub.length) continue;
    console.log(`  ${a.padEnd(18)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }
  console.log(`\n── Selection Rate by Mode ──`);
  for (const m of INPUT_MODES) {
    const sub = lines.filter(t => t.inputMode === m);
    if (!sub.length) continue;
    console.log(`  ${m.padEnd(18)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }

  if (browser) await browser.close();
}

main().catch(err => { console.error("\n❌ Fatal:", err.message); process.exit(1); });
