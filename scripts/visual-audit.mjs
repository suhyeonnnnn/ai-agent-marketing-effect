/**
 * Comprehensive visual test: renders ALL tool outputs for ALL categories × conditions.
 * 
 * Generates a single HTML page with every combination:
 *   4 categories × 8 conditions × 3 page types (search, detail, review) = 96 renders
 * 
 * Saves to: results/visual_audit.html (open in browser to inspect)
 * 
 * Usage:
 *   npm run dev
 *   node scripts/visual-audit.mjs
 *   open results/visual_audit.html
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3000";
const OUT = path.join(ROOT, "results", "visual_audit.html");

const CATEGORIES = ["serum", "smartwatch", "milk", "dress"];

// Inline local images as base64 in HTML (same as experiment scripts)
function inlineImages(html) {
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
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];

async function callTool(cat, cond, toolName, toolArgs, targetProductId) {
  const res = await fetch(`${BASE_URL}/api/execute-tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryId: cat, condition: cond, inputMode: "html",
      toolName, toolArgs, seed: 12345,
      targetProductId,
      renderScreenshot: true,  // Apply same base64 inlining as experiment
    }),
  });
  if (!res.ok) return `<p style="color:red;">ERROR: ${res.status}</p>`;
  const data = await res.json();
  return data.result || `<p style="color:red;">No result</p>`;
}

async function main() {
  console.log("=== Visual Audit: All Categories × Conditions × Pages ===\n");

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
  .section { margin: 20px 0; padding: 16px; background: #fff; border: 1px solid #ddd; border-radius: 8px; }
  .section-header { font-size: 18px; font-weight: bold; margin-bottom: 12px; padding: 8px; background: #333; color: #fff; border-radius: 4px; }
  .page-type { font-size: 14px; font-weight: bold; color: #555; margin: 12px 0 4px; padding: 4px 8px; background: #eee; border-radius: 4px; }
  .render-box { border: 1px solid #ccc; padding: 8px; margin: 4px 0 16px; border-radius: 4px; background: #fafafa; overflow: auto; max-height: 600px; }
  .badge-highlight { background: #fff3cd; border-left: 4px solid #ffc107; padding: 4px 8px; margin: 4px 0; font-size: 12px; }
  .nav { position: fixed; top: 0; left: 0; right: 0; background: #333; color: #fff; padding: 8px 16px; z-index: 1000; display: flex; gap: 8px; flex-wrap: wrap; }
  .nav a { color: #ffc107; text-decoration: none; font-size: 12px; }
  .nav a:hover { text-decoration: underline; }
  .content { margin-top: 50px; }
</style>
</head><body>
<div class="nav">
  <strong>Visual Audit</strong>`;

  // Nav links
  for (const cat of CATEGORIES) {
    for (const cond of CONDITIONS) {
      html += ` <a href="#${cat}-${cond}">${cat}/${cond}</a>`;
    }
  }
  html += `</div><div class="content">`;

  let count = 0;
  const total = CATEGORIES.length * CONDITIONS.length;

  for (const cat of CATEGORIES) {
    for (const cond of CONDITIONS) {
      count++;
      const id = `${cat}-${cond}`;
      console.log(`  [${count}/${total}] ${cat} × ${cond}...`);

      html += `<div class="section" id="${id}">`;
      html += `<div class="section-header">${cat.toUpperCase()} — ${cond} (target=product 1)</div>`;

      // 1. Search page
      html += `<div class="page-type">🔍 SEARCH (8 products)</div>`;
      const searchHtml = await callTool(cat, cond, "search", { query: cat }, 1);
      html += `<div class="render-box">${searchHtml}</div>`;

      // 2. Detail page — target product (should have badge)
      html += `<div class="page-type">📋 VIEW_PRODUCT (product 1 = TARGET → should show badge)</div>`;
      const detailTarget = await callTool(cat, cond, "view_product", { product_id: 1 }, 1);
      html += `<div class="render-box">${detailTarget}</div>`;

      // 3. Detail page — non-target product (should NOT have badge)
      html += `<div class="page-type">📋 VIEW_PRODUCT (product 2 = NON-TARGET → NO badge)</div>`;
      const detailOther = await callTool(cat, cond, "view_product", { product_id: 2 }, 1);
      html += `<div class="render-box">${detailOther}</div>`;

      // 4. Review page — target product
      html += `<div class="page-type">⭐ READ_REVIEWS (product 1 = TARGET)</div>`;
      const reviewTarget = await callTool(cat, cond, "read_reviews", { product_id: 1 }, 1);
      html += `<div class="render-box">${reviewTarget}</div>`;

      // 5. Review page — non-target
      html += `<div class="page-type">⭐ READ_REVIEWS (product 2 = NON-TARGET)</div>`;
      const reviewOther = await callTool(cat, cond, "read_reviews", { product_id: 2 }, 1);
      html += `<div class="render-box">${reviewOther}</div>`;

      html += `</div>`;
    }
  }

  html += `</div></body></html>`;
  fs.writeFileSync(OUT, html);
  console.log(`\n✅ Done! ${count} sections generated.`);
  console.log(`   Open: ${OUT}`);
  console.log(`   or: open results/visual_audit.html`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
