/**
 * Retry Failed Trials
 * 
 * JSONL 파일을 읽어서 빠진 셀(condition × agency × mode × rep)을 찾고,
 * 해당 trial만 재실행해서 같은 파일에 append.
 * 
 * Usage:
 *   node scripts/retry-failed.mjs s1 results/study1/milk_experiment_2026-03-08T21-43-44.jsonl
 *   node scripts/retry-failed.mjs s2 results/study2/serum_experiment_2026-03-09T02-55-10.jsonl
 *   node scripts/retry-failed.mjs s1 results/study1/smartwatch_experiment_2026-03-09T08-48-01.jsonl
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
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific"];
const S1_MODES = ["text_json", "text_flat", "html", "screenshot"];
const S2_MODES = ["text_json", "text_flat", "html", "screenshot"];
const REPS = 30;

const study = process.argv[2] || "s1";
const jsonlPath = path.join(ROOT, process.argv[3] || "");

if (!fs.existsSync(jsonlPath)) {
  console.error(`❌ File not found: ${jsonlPath}`);
  process.exit(1);
}

// ── Puppeteer for S1 screenshot ──
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
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;font-family:Arial,sans-serif;">${htmlContent}</body></html>`, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  const buf = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
  await page.close();
  return buf.toString("base64");
}

function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

async function main() {
  // ── Load existing data ──
  const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n");
  const data = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const testTrials = data.filter(d => d._test);
  const realTrials = data.filter(d => !d._test);

  // ── Detect category from data ──
  // Try categoryId first, then systemPrompt keywords, then brands
  let category = realTrials[0]?.categoryId || realTrials[0]?.category || "";
    if (!category) {
      const sp = realTrials[0]?.systemPrompt || "";
      if (sp.includes("smartwatch")) category = "smartwatch";
      else if (sp.includes("milk")) category = "milk";
      else if (sp.includes("dress")) category = "dress";
      else if (sp.includes("serum")) category = "serum";
      else {
        // Fallback: check brand names
        const brands = realTrials.slice(0, 5).map(t => t.targetBrand || "").join(" ");
        if (brands.includes("PRETTYGARDEN") || brands.includes("MEROKEETY") || brands.includes("ZESICA")) category = "dress";
        else if (brands.includes("Garmin") || brands.includes("Samsung") || brands.includes("Amazfit")) category = "smartwatch";
        else if (brands.includes("Fairlife") || brands.includes("Organic Valley") || brands.includes("Horizon")) category = "milk";
        else category = "serum";
      }
    }
    const modes = study === "s1" ? S1_MODES : S2_MODES;

  console.log(`\n  Study: ${study.toUpperCase()} | Category: ${category}`);
  console.log(`  File: ${jsonlPath}`);
  console.log(`  Existing trials: ${realTrials.length} (+ ${testTrials.length} test)\n`);

  // ── Find missing cells ──
  // Study 2 JSONL may not have inputMode field - detect whether it exists
  const hasInputMode = realTrials.some(t => t.inputMode);
  const existing = new Set();
  for (const t of realTrials) {
    const agency = t.agency || t.promptType || "moderate";
    const rep = t.rep || 0;
    if (hasInputMode) {
      const mode = t.inputMode || "text_json";
      existing.add(`${t.condition}|${agency}|${mode}|${rep}`);
    } else {
      // No inputMode in data - match by condition|agency|rep only
      existing.add(`${t.condition}|${agency}|${rep}`);
    }
  }

  const missing = [];
  const agencies = AGENCIES;

  if (hasInputMode) {
    for (const cond of CONDITIONS) {
      for (const agency of agencies) {
        for (const mode of modes) {
          for (let rep = 1; rep <= REPS; rep++) {
            if (!existing.has(`${cond}|${agency}|${mode}|${rep}`)) {
              missing.push({ cond, agency, mode, rep });
            }
          }
        }
      }
    }
  } else {
    // No inputMode - use text_json as default for retry
    for (const cond of CONDITIONS) {
      for (const agency of agencies) {
        for (let rep = 1; rep <= REPS; rep++) {
          if (!existing.has(`${cond}|${agency}|${rep}`)) {
            missing.push({ cond, agency, mode: "text_json", rep });
          }
        }
      }
    }
  }

  if (missing.length === 0) {
    console.log("  ✅ No missing trials! All cells complete.");
    return;
  }

  console.log(`  ❌ Missing trials: ${missing.length}`);
  // Show breakdown
  const byCond = {};
  for (const m of missing) { byCond[m.cond] = (byCond[m.cond] || 0) + 1; }
  for (const [c, n] of Object.entries(byCond)) { console.log(`     ${c}: ${n}`); }
  console.log();

  // ── Retry missing trials ──
  let done = 0, hits = 0, errors = 0;
  const startTime = Date.now();
  let trialId = realTrials.length + testTrials.length + 1000; // avoid ID collision

  for (const { cond, agency, mode, rep } of missing) {
    trialId++;
    const seed = genSeed(trialId);
    const pct = Math.round((done / missing.length) * 100);
    process.stdout.write(`\r  [${pct}%] ${done}/${missing.length} | ${cond}×${agency}×${mode} r${rep} | hits:${hits} errors:${errors}  `);

    try {
      if (study === "s1") {
        const params = {
          trialId, categoryId: category, condition: cond, promptType: agency,
          promptVariant: "default", inputMode: mode, model: MODEL,
          temperature: TEMPERATURE, seed, enableManipCheck: false,
          apiKeys: { openai: API_KEY },
        };

        let result;
        if (mode === "screenshot") {
          // dryRun → render → send
          const dry = await fetch(`${BASE_URL}/api/run-trial`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...params, inputMode: "html", dryRun: true }),
          }).then(r => r.json());
          const base64 = await renderScreenshot(dry.productsHtml);
          // Save screenshot
          const ssDir = path.join(ROOT, "results", "study1", "screenshots");
          fs.mkdirSync(ssDir, { recursive: true });
          const filename = `s1_${category}_${cond}_${agency}_t${trialId}.jpg`;
          fs.writeFileSync(path.join(ssDir, filename), Buffer.from(base64, "base64"));
          result = await fetch(`${BASE_URL}/api/run-trial`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...params, screenshotBase64: base64 }),
          }).then(r => r.json());
          result.screenshotPath = `results/study1/screenshots/${filename}`;
        } else {
          result = await fetch(`${BASE_URL}/api/run-trial`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          }).then(r => r.json());
        }

        if (result.error) throw new Error(result.error);
        if (result.choseTarget) hits++;
        result.rep = rep;
        result.agency = agency;
        fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");

      } else {
        // Study 2
        const result = await fetch(`${BASE_URL}/api/run-study2`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialId, categoryId: category, condition: cond, agency,
            inputMode: mode, model: MODEL, temperature: TEMPERATURE, seed,
            apiKeys: { openai: API_KEY },
          }),
        }).then(r => r.json());

        if (result.error) throw new Error(result.error);
        if (result.choseTarget) hits++;
        result.rep = rep;
        result.agency = agency;
        fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
      }
    } catch (err) {
      errors++;
      console.error(`\n  ❌ ${cond}×${agency}×${mode} r${rep}: ${err.message.slice(0, 80)}`);
      if (err.message.includes("429") || err.message.includes("Rate limit")) {
        console.log("  ⏳ Rate limited — 30s...");
        await new Promise(r => setTimeout(r, 30000));
      } else if (err.message.includes("500") || err.message.includes("ECONNREFUSED")) {
        console.log("  ⏳ Server error — 10s...");
        await new Promise(r => setTimeout(r, 10000));
      }
    }
    done++;
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n  ✅ Retry complete!`);
  console.log(`  Retried: ${done} | Hits: ${hits} | Errors: ${errors}`);
  console.log(`  Time: ${totalTime}s`);

  // Verify completeness
  const newLines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n");
  const newData = newLines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(d => d && !d._test);
  const expected = CONDITIONS.length * agencies.length * modes.length * REPS;
  console.log(`  Total trials now: ${newData.length}/${expected}`);
  if (newData.length >= expected) console.log("  ✅ All cells complete!");
  else console.log(`  ⚠ Still missing ${expected - newData.length} trials`);

  if (browser) await browser.close();
}

main().catch(err => { console.error("❌ Fatal:", err.message); process.exit(1); });
