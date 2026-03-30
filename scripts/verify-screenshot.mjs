/**
 * Minimal test: exactly replicate what run-category.mjs does for 1 screenshot trial.
 * Saves the screenshot to results/verify_screenshot.jpg for manual inspection.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3000";

// Exact same function from run-category.mjs
function resolveLocalImages(html) {
  const publicDir = path.join(ROOT, "public");
  return html.replace(/src="(\/images\/[^"]+)"/g, (match, p1) => {
    const absPath = path.join(publicDir, p1);
    try {
      const buf = fs.readFileSync(absPath);
      const b64 = buf.toString("base64");
      return `src="data:image/jpeg;base64,${b64}"`;
    } catch (e) {
      console.error(`  ❌ Failed to read: ${absPath} — ${e.message}`);
      return match;
    }
  });
}

async function main() {
  console.log("=== Screenshot Verification Test ===\n");
  
  // Step 1: dryRun to get HTML (same as run-category.mjs)
  console.log("1. Getting HTML via dryRun...");
  const res = await fetch(`${BASE_URL}/api/run-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trialId: 0, categoryId: "dress", condition: "authority_a",
      promptType: "vague", inputMode: "html", dryRun: true,
      model: "gpt-4o-mini", temperature: 1, seed: 12345,
      apiKeys: { openai: "dummy" },
    }),
  });
  const data = await res.json();
  const html = data.productsHtml;
  
  if (!html) { console.error("❌ No HTML returned"); process.exit(1); }
  
  // Count image types in raw HTML
  const localPaths = (html.match(/src="\/images\/products\/[^"]+"/g) || []);
  console.log(`   Raw HTML: ${localPaths.length} local image paths`);
  
  // Step 2: Resolve images to base64 (same as run-category.mjs)
  console.log("2. Resolving images to base64...");
  const resolved = resolveLocalImages(html);
  
  const b64Count = (resolved.match(/src="data:image\/jpeg;base64,/g) || []).length;
  const remainingLocal = (resolved.match(/src="\/images\/products\/[^"]+"/g) || []).length;
  console.log(`   After resolve: ${b64Count} base64 images, ${remainingLocal} unresolved paths`);
  
  if (b64Count !== 8) {
    console.error(`   ❌ Expected 8 base64 images, got ${b64Count}!`);
    if (remainingLocal > 0) {
      console.error(`   ${remainingLocal} images failed to resolve!`);
    }
  }
  
  // Step 3: Render with Puppeteer (same as run-category.mjs)
  console.log("3. Rendering with Puppeteer...");
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--allow-file-access-from-files"] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;font-family:Arial,sans-serif;">${resolved}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  
  // Check if images loaded in Puppeteer
  const imgStatus = await page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    return Array.from(imgs).map(img => ({
      alt: img.alt.substring(0, 30),
      width: img.naturalWidth,
      height: img.naturalHeight,
      loaded: img.naturalWidth > 0,
      srcType: img.src.startsWith("data:") ? "base64" : img.src.substring(0, 50),
    }));
  });
  
  console.log("   Image status in Puppeteer:");
  let allLoaded = true;
  for (const img of imgStatus) {
    const status = img.loaded ? "✅" : "❌";
    console.log(`     ${status} ${img.alt}... ${img.width}x${img.height} (${img.srcType})`);
    if (!img.loaded) allLoaded = false;
  }
  
  // Step 4: Save screenshot
  const ssPath = path.join(ROOT, "results", "verify_screenshot.jpg");
  await page.screenshot({ path: ssPath, type: "jpeg", quality: 85, fullPage: true });
  const ssSize = fs.statSync(ssPath).size;
  console.log(`\n4. Screenshot saved: ${ssPath} (${Math.round(ssSize / 1024)}KB)`);
  
  await page.close();
  await browser.close();
  
  // Final verdict
  console.log("\n" + "=".repeat(50));
  if (allLoaded && b64Count === 8) {
    console.log("  ✅ ALL IMAGES LOADED — SAFE TO RE-RUN EXPERIMENT");
  } else {
    console.log("  ❌ IMAGES NOT LOADED — DO NOT RE-RUN");
  }
  console.log("=".repeat(50));
  console.log("\n  Open results/verify_screenshot.jpg to visually confirm!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
