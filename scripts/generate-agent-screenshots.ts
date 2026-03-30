/**
 * Generate Agent Screenshots
 * ===========================
 * Renders the exact HTML that agents receive in screenshot mode
 * and saves them as JPEG files.
 *
 * Usage:
 *   cd b2a-experiment
 *   npx tsx scripts/generate-agent-screenshots.ts
 *
 * Output:
 *   screenshots/agent_search_{category}_{condition}_target{id}.jpg
 *   screenshots/agent_detail_{category}_{condition}_target{id}.jpg
 *   screenshots/agent_reviews_{category}_target{id}.jpg
 */

import * as fs from "fs";
import * as path from "path";

// Import project modules
import { CATEGORIES, type CategoryId } from "../lib/categories";
import {
  type Condition,
  type InputMode,
  PRODUCT_REVIEWS,
  shufflePositions,
} from "../lib/products";
import { executeTool, type ToolContext } from "../lib/tools";

// ──────────────────────────────────────────────
//  Screenshot config: 10 examples
// ──────────────────────────────────────────────

interface ScreenshotConfig {
  label: string;
  category: CategoryId;
  condition: Condition;
  page: "search" | "detail" | "reviews";
  targetProductId: number;
}

const EXAMPLES: ScreenshotConfig[] = [
  // Search results with different conditions
  { label: "01", category: "serum",      condition: "control",        page: "search",  targetProductId: 2 },
  { label: "02", category: "serum",      condition: "scarcity",       page: "search",  targetProductId: 2 },
  { label: "03", category: "smartwatch", condition: "urgency",        page: "search",  targetProductId: 3 },
  { label: "04", category: "milk",       condition: "price_anchoring", page: "search", targetProductId: 4 },
  { label: "05", category: "dress",      condition: "social_proof_a", page: "search",  targetProductId: 6 },
  // Detail pages
  { label: "06", category: "serum",      condition: "authority_a",    page: "detail",  targetProductId: 2 },
  { label: "07", category: "smartwatch", condition: "scarcity",       page: "detail",  targetProductId: 5 },
  { label: "08", category: "milk",       condition: "authority_a",    page: "detail",  targetProductId: 2 },
  // Review pages (no badge)
  { label: "09", category: "serum",      condition: "control",        page: "reviews", targetProductId: 2 },
  { label: "10", category: "dress",      condition: "control",        page: "reviews", targetProductId: 3 },
];

// ──────────────────────────────────────────────
//  Generate HTML
// ──────────────────────────────────────────────

function generateHtml(config: ScreenshotConfig): string {
  const cat = CATEGORIES[config.category];
  const ctx: ToolContext = {
    condition: config.condition,
    targetProductId: config.targetProductId,
    shuffledProducts: cat.products as any,
    seed: 42,
    nudgeSurfaces: ["search", "detail"],
    inputMode: "html" as InputMode,
    categoryId: config.category,
    catMarketing: cat.marketing,
  };

  let toolResult: string;
  switch (config.page) {
    case "search":
      toolResult = executeTool("search", { query: cat.label }, ctx);
      break;
    case "detail":
      toolResult = executeTool("view_product", { product_id: config.targetProductId }, ctx);
      break;
    case "reviews":
      toolResult = executeTool("read_reviews", { product_id: config.targetProductId }, ctx);
      break;
  }

  // Wrap in full HTML document (same as renderHtmlToScreenshot in run-trial)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>body { margin: 12px; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }</style>
</head>
<body>
${toolResult}
</body>
</html>`;
}

// ──────────────────────────────────────────────
//  Main: Save HTML files + render with Puppeteer
// ──────────────────────────────────────────────

async function main() {
  const outDir = path.join(process.cwd(), "screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("🖼  Generating agent screenshot HTMLs...\n");

  // Step 1: Save HTML files (always works)
  for (const config of EXAMPLES) {
    const html = generateHtml(config);
    const filename = `agent_${config.page}_${config.category}_${config.condition}_target${config.targetProductId}`;
    const htmlPath = path.join(outDir, `${filename}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`  ✓ ${config.label}. ${htmlPath}`);
  }

  console.log(`\n📂 HTML files saved to: ${outDir}`);
  console.log("   Open any .html file in a browser to see exactly what the agent sees.\n");

  // Step 2: Try Puppeteer rendering (may not be available)
  try {
    // @ts-ignore
    const puppeteer = await import("puppeteer");
    const browser = await (puppeteer as any).default.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    console.log("📸 Rendering screenshots with Puppeteer...\n");

    for (const config of EXAMPLES) {
      const html = generateHtml(config);
      const filename = `agent_${config.page}_${config.category}_${config.condition}_target${config.targetProductId}`;

      const page = await browser.newPage();
      await page.setViewport({ width: 900, height: 700 });
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
      await page.screenshot({
        path: path.join(outDir, `${filename}.jpg`),
        type: "jpeg",
        quality: 85,
        fullPage: true,
      });
      await page.close();
      console.log(`  ✓ ${config.label}. ${filename}.jpg`);
    }

    await browser.close();
    console.log(`\n✅ Done! ${EXAMPLES.length} screenshots saved to: ${outDir}`);
  } catch (err: any) {
    console.log("⚠  Puppeteer not available — HTML files saved, but JPG rendering skipped.");
    console.log("   To generate JPGs, install puppeteer: npm install puppeteer");
    console.log("   Or just open the .html files in your browser and take screenshots manually.\n");
  }
}

main().catch(console.error);
