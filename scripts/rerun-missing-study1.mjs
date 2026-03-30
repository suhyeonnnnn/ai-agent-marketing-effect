/**
 * Re-run 2 missing Study 1 trials (smartwatch #470, dress #3618)
 * Usage: node scripts/rerun-missing-study1.mjs
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

function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

// Reconstruct trialId → params mapping (must match run-category.mjs loop order)
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific", "cautious"];
const MODES = ["text_json", "text_flat", "html", "screenshot"];
const REPS = 30;

function getTrialParams(trialId) {
  let id = 0;
  for (const condition of CONDITIONS) {
    for (const agency of AGENCIES) {
      for (const mode of MODES) {
        for (let rep = 0; rep < REPS; rep++) {
          id++;
          if (id === trialId) return { condition, agency, mode, rep: rep + 1 };
        }
      }
    }
  }
  return null;
}

// Puppeteer for screenshot mode
let browser = null;
async function renderScreenshot(htmlContent) {
  if (!browser) {
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
  }
  const publicDir = path.join(ROOT, "public");
  const resolved = htmlContent.replace(/src="(\/images\/[^"]+)"/g, (match, p1) => {
    try {
      const buf = fs.readFileSync(path.join(publicDir, p1));
      return `src="data:image/jpeg;base64,${buf.toString("base64")}"`;
    } catch { return match; }
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 450 });
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:12px;background:#fff;font-family:Arial,sans-serif;font-size:12px;">${resolved}</body></html>`, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  const buf = await page.screenshot({ type: "jpeg", quality: 50, fullPage: true });
  await page.close();
  return buf.toString("base64");
}

async function callAPI(params) {
  const res = await fetch(`${BASE_URL}/api/run-trial`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const MISSING = [
  { cat: "smartwatch", trialId: 470, file: "smartwatch_experiment_2026-03-14T11-50-11.jsonl" },
  { cat: "dress",      trialId: 3618, file: "dress_experiment_2026-03-14T12-47-38.jsonl" },
];

async function main() {
  console.log(`=== Re-running ${MISSING.length} missing Study 1 trials ===\n`);

  for (const m of MISSING) {
    const p = getTrialParams(m.trialId);
    console.log(`  t${m.trialId}: ${m.cat} × ${p.condition} × ${p.agency} × ${p.mode}`);

    const seed = genSeed(m.trialId);
    const params = {
      trialId: m.trialId, categoryId: m.cat, condition: p.condition,
      promptType: p.agency, promptVariant: "default", inputMode: p.mode,
      model: "gpt-4o-mini", temperature: 1, seed,
      enableManipCheck: false, apiKeys: { openai: API_KEY },
    };

    let result;
    if (p.mode === "screenshot") {
      // dryRun → render → send
      const dry = await callAPI({ ...params, inputMode: "html", dryRun: true });
      const base64 = await renderScreenshot(dry.productsHtml);
      result = await callAPI({ ...params, inputMode: "screenshot", screenshotBase64: base64 });
    } else {
      result = await callAPI(params);
    }

    result.agency = p.agency;
    result._rerun = true;

    const jsonlPath = path.join(ROOT, "results", RUN_ID, "study1", m.file);
    fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
    console.log(`  ✅ → ${result.chosenBrand} ${result.choseTarget ? "HIT" : ""}\n`);
  }

  if (browser) await browser.close();
  console.log("Done!");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
