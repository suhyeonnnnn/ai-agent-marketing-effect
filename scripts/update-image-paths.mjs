/**
 * Update image paths in categories.ts and products.ts to use local files.
 * 
 * Changes:
 *   "https://m.media-amazon.com/images/I/xxx.jpg"
 *   → "/images/products/{category}_{id}.jpg"
 * 
 * For Puppeteer screenshot rendering, the HTML will use absolute file:// paths.
 * For the stimulus page (Next.js), images are served from public/.
 * 
 * Usage:
 *   node scripts/update-image-paths.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "images", "products");

// Verify images exist
const categories = ["serum", "smartwatch", "milk", "dress"];
let missing = 0;
for (const cat of categories) {
  for (let id = 1; id <= 8; id++) {
    const fp = path.join(IMG_DIR, `${cat}_${id}.jpg`);
    if (!fs.existsSync(fp) || fs.statSync(fp).size < 1000) {
      console.error(`  ❌ Missing: ${cat}_${id}.jpg`);
      missing++;
    }
  }
}
if (missing > 0) {
  console.error(`\n${missing} images missing! Run: node scripts/download-product-images.mjs`);
  process.exit(1);
}
console.log("✅ All 32 product images verified\n");

// ── Update categories.ts ──
const catFile = path.join(ROOT, "lib", "categories.ts");
let catContent = fs.readFileSync(catFile, "utf-8");

// Map of amazon URL → local path for each category
const urlMap = {};

// Extract all image URLs and map them
for (const cat of categories) {
  // Find product entries for this category
  const regex = new RegExp(`id: (\\d+),.*?image: "(https?://[^"]+)"`, "gs");
  // Simpler approach: replace all amazon URLs with local paths based on position
  
  // Find the category block
  const catStart = catContent.indexOf(`id: "${cat}"`);
  if (catStart === -1) continue;
  
  for (let id = 1; id <= 8; id++) {
    // Find the specific product line with this id in this category context
    const localPath = `/images/products/${cat}_${id}.jpg`;
    // We need to be careful to only replace within the right category
    // Strategy: search for the pattern `id: N, brand: "..." ... image: "URL"`
  }
}

// Simpler approach: direct URL-to-local mapping
const IMAGE_MAP = {
  // serum
  "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg": "/images/products/serum_1.jpg",
  "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg": "/images/products/serum_2.jpg",
  "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg": "/images/products/serum_3.jpg",
  "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg": "/images/products/serum_4.jpg",
  "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg": "/images/products/serum_5.jpg",
  "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg": "/images/products/serum_6.jpg",
  "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg": "/images/products/serum_7.jpg",
  "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg": "/images/products/serum_8.jpg",
  // smartwatch
  "https://m.media-amazon.com/images/I/71T6pMOJc8L._SL1500_.jpg": "/images/products/smartwatch_1.jpg",
  "https://m.media-amazon.com/images/I/61CnTl4OFQL._SL1500_.jpg": "/images/products/smartwatch_2.jpg",
  "https://m.media-amazon.com/images/I/61oFBVbwPAL._SL1500_.jpg": "/images/products/smartwatch_3.jpg",
  "https://m.media-amazon.com/images/I/71HbfZPWHFL._SL1500_.jpg": "/images/products/smartwatch_4.jpg",
  "https://m.media-amazon.com/images/I/61z7E0PKJKL._SL1500_.jpg": "/images/products/smartwatch_5.jpg",
  "https://m.media-amazon.com/images/I/71H6EHyMBjL._SL1500_.jpg": "/images/products/smartwatch_6.jpg",
  "https://m.media-amazon.com/images/I/61CIKqnIOuL._SL1500_.jpg": "/images/products/smartwatch_7.jpg",
  "https://m.media-amazon.com/images/I/71o0J5rlD2L._SL1500_.jpg": "/images/products/smartwatch_8.jpg",
  // milk
  "https://m.media-amazon.com/images/I/81n5RFLAOAL._SL1500_.jpg": "/images/products/milk_1.jpg",
  "https://m.media-amazon.com/images/I/71vgxaUYeaL._SL1500_.jpg": "/images/products/milk_2.jpg",
  "https://m.media-amazon.com/images/I/71Y1QRqXJvL._SL1500_.jpg": "/images/products/milk_3.jpg",
  "https://m.media-amazon.com/images/I/71rQvjIR0pL._SL1500_.jpg": "/images/products/milk_4.jpg",
  "https://m.media-amazon.com/images/I/71jBfWHxbaL._SL1500_.jpg": "/images/products/milk_5.jpg",
  "https://m.media-amazon.com/images/I/71o8WkAbjUL._SL1500_.jpg": "/images/products/milk_6.jpg",
  "https://m.media-amazon.com/images/I/71wD2v0kFIL._SL1500_.jpg": "/images/products/milk_7.jpg",
  "https://m.media-amazon.com/images/I/61jQlRIcGBL._SL1500_.jpg": "/images/products/milk_8.jpg",
  // dress
  "https://m.media-amazon.com/images/I/71PSSl3VFNL._AC_UL1200_.jpg": "/images/products/dress_1.jpg",
  "https://m.media-amazon.com/images/I/71hCCAZvhYL._AC_UL1200_.jpg": "/images/products/dress_2.jpg",
  "https://m.media-amazon.com/images/I/71xmITQfqBL._AC_UL1200_.jpg": "/images/products/dress_3.jpg",
  "https://m.media-amazon.com/images/I/71BZiHr7gTL._AC_UL1200_.jpg": "/images/products/dress_4.jpg",
  "https://m.media-amazon.com/images/I/71EZ+bJEGRL._AC_UL1200_.jpg": "/images/products/dress_5.jpg",
  "https://m.media-amazon.com/images/I/71fNYGPL0VL._AC_UL1200_.jpg": "/images/products/dress_6.jpg",
  "https://m.media-amazon.com/images/I/71nHsGKaVuL._AC_UL1200_.jpg": "/images/products/dress_7.jpg",
  "https://m.media-amazon.com/images/I/71kqnLkVOFL._AC_UL1200_.jpg": "/images/products/dress_8.jpg",
};

// Replace in categories.ts
let replaced = 0;
for (const [amazonUrl, localPath] of Object.entries(IMAGE_MAP)) {
  if (catContent.includes(amazonUrl)) {
    catContent = catContent.replaceAll(amazonUrl, localPath);
    replaced++;
  }
}
fs.writeFileSync(catFile, catContent);
console.log(`categories.ts: ${replaced} URLs replaced`);

// ── Update products.ts ──
const prodFile = path.join(ROOT, "lib", "products.ts");
let prodContent = fs.readFileSync(prodFile, "utf-8");

let prodReplaced = 0;
for (const [amazonUrl, localPath] of Object.entries(IMAGE_MAP)) {
  if (prodContent.includes(amazonUrl)) {
    prodContent = prodContent.replaceAll(amazonUrl, localPath);
    prodReplaced++;
  }
}

// Also update PRODUCT_IMAGES map
fs.writeFileSync(prodFile, prodContent);
console.log(`products.ts:   ${prodReplaced} URLs replaced`);

console.log("\n✅ Done! Images now use local paths: /images/products/{cat}_{id}.jpg");
console.log("   Next.js serves from public/ → accessible at localhost:3000/images/products/...");
