/**
 * Quick test: verify screenshot mode renders product images correctly.
 * Runs 1 trial of screenshot mode and saves the screenshot for inspection.
 * 
 * Usage:
 *   npm run dev   # server must be running
 *   node scripts/test-screenshot-images.mjs
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

const BASE_URL = "http://localhost:3000";
const API_KEY = process.env.OPENAI_API_KEY;

// Test Study 1 screenshot: dryRun → get HTML → render → verify
async function testStudy1Screenshot() {
  console.log("=== Study 1 Screenshot Test ===\n");
  
  // Step 1: dryRun to get HTML
  const res = await fetch(`${BASE_URL}/api/run-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trialId: 99999, categoryId: "serum", condition: "social_proof_a",
      promptType: "moderate", inputMode: "html", dryRun: true,
      model: "gpt-4o-mini", temperature: 1, seed: 12345,
      apiKeys: { openai: API_KEY },
    }),
  });
  const dryResult = await res.json();
  const html = dryResult.productsHtml;
  
  if (!html) {
    console.error("❌ dryRun returned no HTML");
    return;
  }
  console.log(`  HTML length: ${html.length} chars`);
  
  // Check if HTML contains local image paths
  const localImages = (html.match(/\/images\/products\/[^"]+/g) || []);
  const amazonImages = (html.match(/https:\/\/m\.media-amazon\.com[^"]+/g) || []);
  console.log(`  Local image paths: ${localImages.length}`);
  console.log(`  Amazon URLs (should be 0): ${amazonImages.length}`);
  
  if (amazonImages.length > 0) {
    console.error("  ❌ Still using Amazon URLs!");
    return;
  }
  
  // Step 2: Render with Puppeteer
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--allow-file-access-from-files"] 
  });
  
  // Resolve local paths to file:// URLs
  const publicDir = path.join(ROOT, "public");
  const resolvedHtml = html.replace(/src="(\/images\/[^"]+)"/g, (match, p1) => {
    const absPath = path.join(publicDir, p1);
    return `src="file://${absPath}"`;
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;font-family:Arial,sans-serif;">${resolvedHtml}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 });
  
  const ssPath = path.join(ROOT, "results", "test_screenshot_with_images.jpg");
  await page.screenshot({ path: ssPath, type: "jpeg", quality: 85, fullPage: true });
  await page.close();
  await browser.close();
  
  const size = fs.statSync(ssPath).size;
  console.log(`\n  ✅ Screenshot saved: ${ssPath}`);
  console.log(`  Size: ${Math.round(size / 1024)}KB`);
  console.log(`\n  Open it and verify product images are visible!`);
}

// Test Study 2 screenshot: run 1 actual trial
async function testStudy2Screenshot() {
  console.log("\n=== Study 2 Screenshot Test ===\n");
  
  const res = await fetch(`${BASE_URL}/api/run-study2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trialId: 99998, categoryId: "dress", condition: "authority_a",
      agency: "vague", inputMode: "screenshot",
      model: "gpt-4o-mini", temperature: 1, seed: 12345,
      apiKeys: { openai: API_KEY },
    }),
  });
  const result = await res.json();
  
  console.log(`  Chosen: ${result.chosenBrand} (id=${result.chosenProductId})`);
  console.log(`  Target hit: ${result.choseTarget}`);
  console.log(`  Steps: ${result.totalSteps}`);
  console.log(`  Screenshot paths: ${JSON.stringify(result.screenshotPaths)}`);
  
  // Extract base64 images from rawMessages and save
  let imgCount = 0;
  for (const msg of result.rawMessages || []) {
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === "image_url" && item.image_url?.url?.startsWith("data:")) {
          imgCount++;
          const b64 = item.image_url.url.split(",")[1];
          const imgPath = path.join(ROOT, "results", `test_s2_screenshot_${imgCount}.jpg`);
          fs.writeFileSync(imgPath, Buffer.from(b64, "base64"));
          console.log(`  Saved: test_s2_screenshot_${imgCount}.jpg (${Math.round(Buffer.from(b64, "base64").length / 1024)}KB)`);
        }
      }
    }
  }
  
  if (imgCount === 0) {
    console.log("  ⚠️ No screenshots found in rawMessages");
  } else {
    console.log(`\n  ✅ ${imgCount} screenshots saved. Open them and verify images are visible!`);
  }
}

async function main() {
  await testStudy1Screenshot();
  await testStudy2Screenshot();
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
