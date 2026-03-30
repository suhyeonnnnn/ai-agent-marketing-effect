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
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific", "cautious"];
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];
const ENABLE_MANIP_CHECK = false;
const TOTAL = CONDITIONS.length * AGENCIES.length * INPUT_MODES.length * REPS;

const CONCURRENCY = parseInt(process.env.CONCURRENCY || "8", 10);  // parallel requests
const RUN_ID = process.env.RUN_ID || "260314_1";  // experiment run folder

function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

// ── Parallel execution with concurrency limit ──
async function runParallel(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]().catch(err => ({ _error: err }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// ── Puppeteer (lazy load) ──
let browser = null;
async function getBrowser() {
  if (!browser) {
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
    console.log("  📸 Puppeteer launched");
  }
  return browser;
}

// Convert local image paths to inline base64 data URIs
function resolveLocalImages(html) {
  const publicDir = path.join(ROOT, "public");
  return html.replace(/src="(\/images\/[^"]+)"/g, (match, p1) => {
    const absPath = path.join(publicDir, p1);
    try {
      const buf = fs.readFileSync(absPath);
      const b64 = buf.toString("base64");
      return `src="data:image/jpeg;base64,${b64}"`;
    } catch {
      return match;
    }
  });
}

// Image verification
const IMAGE_LOG = path.join(ROOT, "results", RUN_ID, "image_verification_s1.log");
let imgCheckCount = 0;
let imgFailCount = 0;

function logImgCheck(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.mkdirSync(path.dirname(IMAGE_LOG), { recursive: true }); } catch {}
  try { fs.appendFileSync(IMAGE_LOG, line); } catch {}
}

async function renderScreenshot(htmlContent) {
  const b = await getBrowser();
  const resolved = resolveLocalImages(htmlContent);

  // Pre-render check
  const b64Count = (resolved.match(/src="data:image\/jpeg;base64,/g) || []).length;
  const unresolvedCount = (resolved.match(/src="\/images\/products\/[^"]+"/g) || []).length;
  if (unresolvedCount > 0) {
    logImgCheck(`\u26a0\ufe0f UNRESOLVED: ${unresolvedCount} images still have /images/ paths (${b64Count} resolved)`);
    console.error(`  \u26a0\ufe0f ${unresolvedCount} images unresolved!`);
  }

  const page = await b.newPage();
  await page.setViewport({ width: 600, height: 450 });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:12px;background:#fff;font-family:Arial,sans-serif;font-size:12px;">${resolved}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});

  // Post-render check
  imgCheckCount++;
  const imgStatus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map(img => ({
      ok: img.naturalWidth > 0,
      alt: img.alt?.substring(0, 40) || "no-alt",
    }));
  });
  const total = imgStatus.length;
  const loaded = imgStatus.filter(i => i.ok).length;
  const failed = imgStatus.filter(i => !i.ok);

  if (failed.length > 0) {
    imgFailCount++;
    const names = failed.map(i => i.alt).join(", ");
    logImgCheck(`\u274c FAILED: ${failed.length}/${total} images not loaded [${names}]`);
    console.error(`  \u274c IMAGE FAIL: ${failed.length}/${total} not loaded`);
  } else if (imgCheckCount % 100 === 0) {
    logImgCheck(`\u2705 CHECK #${imgCheckCount}: ${loaded}/${total} OK (${imgFailCount} failures so far)`);
  }

  // First screenshot: always verify and log
  if (imgCheckCount === 1) {
    logImgCheck(`\u2705 FIRST SCREENSHOT: ${loaded}/${total} images loaded, b64=${b64Count}, unresolved=${unresolvedCount}`);
    console.log(`  \ud83d\uddbc\ufe0f First screenshot: ${loaded}/${total} images loaded`);
  }

  const buf = await page.screenshot({ type: "jpeg", quality: 50, fullPage: true });
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
  const ssDir = path.join(ROOT, "results", RUN_ID, "study1", "screenshots");
  fs.mkdirSync(ssDir, { recursive: true });
  const filename = `s1_${params.categoryId}_${params.condition}_${params.promptType}_t${params.trialId}.jpg`;
  fs.writeFileSync(path.join(ssDir, filename), Buffer.from(base64, "base64"));

  // Step 4: Run real trial with screenshot
  const result = await callAPI({ ...params, inputMode: "screenshot", screenshotBase64: base64 });
  result.screenshotPath = `results/${RUN_ID}/study1/screenshots/${filename}`;
  return result;
}

// ── Main ──
async function main() {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", RUN_ID, "study1");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `${CATEGORY}_experiment_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Study 1 — Category: ${CATEGORY.toUpperCase()}`);
  console.log(`  ${CONDITIONS.length}×${AGENCIES.length}×${INPUT_MODES.length}×${REPS} = ${TOTAL} trials`);
  console.log(`  Model: ${MODEL} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════\n");

  console.log(`  Concurrency: ${CONCURRENCY}`);

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
        // Build batch of tasks for this cell (all reps)
        const tasks = [];
        for (let rep = 0; rep < REPS; rep++) {
          trialId++;
          const tid = trialId;
          const seed = genSeed(tid);
          const r = rep + 1;
          tasks.push(async () => {
            const params = {
              trialId: tid, categoryId: CATEGORY, condition, promptType: agency,
              promptVariant: "default", inputMode: mode, model: MODEL,
              temperature: TEMPERATURE, seed, enableManipCheck: ENABLE_MANIP_CHECK,
              apiKeys: { openai: API_KEY },
            };
            const result = mode === "screenshot"
              ? await runScreenshotTrial(params)
              : await callAPI(params);
            result.rep = r;
            result.agency = agency;
            return result;
          });
        }

        // Run batch in parallel
        const results = await runParallel(tasks, CONCURRENCY);

        for (const result of results) {
          done++;
          if (result._error) {
            errors++;
            console.error(`\n  ❌ Error: ${result._error.message?.slice(0, 100)}`);
            continue;
          }
          if (result.error) { errors++; continue; }
          if (result.choseTarget) hits++;
          totalCost += result.estimatedCostUsd || 0;
          fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
        }

        const rate = done > 0 ? (done / ((Date.now() - startTime) / 1000)).toFixed(1) : "?";
        const eta = done > 0 ? Math.round((TOTAL - done) / (done / ((Date.now() - startTime) / 1000))) : "?";
        const pct = Math.round((done / TOTAL) * 100);
        process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${condition}×${agency}×${mode} | hits:${hits} ${totalCost.toFixed(3)} | ${rate}t/s ETA:${eta}s  `);
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
  process.exit(0);
}

main().catch(err => { console.error("\n❌ Fatal:", err.message); process.exit(1); });
