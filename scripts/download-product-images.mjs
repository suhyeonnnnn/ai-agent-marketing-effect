/**
 * Download all product images locally to avoid CDN hotlink blocking.
 * 
 * Usage:
 *   node scripts/download-product-images.mjs
 * 
 * Downloads to: public/images/products/{category}_{id}.jpg
 * Then update categories.ts image paths to use local URLs.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "images", "products");

fs.mkdirSync(IMG_DIR, { recursive: true });

// All product images from categories.ts
const IMAGES = {
  // serum
  "serum_1": "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg",
  "serum_2": "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg",
  "serum_3": "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg",
  "serum_4": "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg",
  "serum_5": "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg",
  "serum_6": "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg",
  "serum_7": "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg",
  "serum_8": "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg",
  // smartwatch
  "smartwatch_1": "https://m.media-amazon.com/images/I/71T6pMOJc8L._SL1500_.jpg",
  "smartwatch_2": "https://m.media-amazon.com/images/I/61CnTl4OFQL._SL1500_.jpg",
  "smartwatch_3": "https://m.media-amazon.com/images/I/61oFBVbwPAL._SL1500_.jpg",
  "smartwatch_4": "https://m.media-amazon.com/images/I/71HbfZPWHFL._SL1500_.jpg",
  "smartwatch_5": "https://m.media-amazon.com/images/I/61z7E0PKJKL._SL1500_.jpg",
  "smartwatch_6": "https://m.media-amazon.com/images/I/71H6EHyMBjL._SL1500_.jpg",
  "smartwatch_7": "https://m.media-amazon.com/images/I/61CIKqnIOuL._SL1500_.jpg",
  "smartwatch_8": "https://m.media-amazon.com/images/I/71o0J5rlD2L._SL1500_.jpg",
  // milk
  "milk_1": "https://m.media-amazon.com/images/I/81n5RFLAOAL._SL1500_.jpg",
  "milk_2": "https://m.media-amazon.com/images/I/71vgxaUYeaL._SL1500_.jpg",
  "milk_3": "https://m.media-amazon.com/images/I/71Y1QRqXJvL._SL1500_.jpg",
  "milk_4": "https://m.media-amazon.com/images/I/71rQvjIR0pL._SL1500_.jpg",
  "milk_5": "https://m.media-amazon.com/images/I/71jBfWHxbaL._SL1500_.jpg",
  "milk_6": "https://m.media-amazon.com/images/I/71o8WkAbjUL._SL1500_.jpg",
  "milk_7": "https://m.media-amazon.com/images/I/71wD2v0kFIL._SL1500_.jpg",
  "milk_8": "https://m.media-amazon.com/images/I/61jQlRIcGBL._SL1500_.jpg",
  // dress
  "dress_1": "https://m.media-amazon.com/images/I/71PSSl3VFNL._AC_UL1200_.jpg",
  "dress_2": "https://m.media-amazon.com/images/I/71hCCAZvhYL._AC_UL1200_.jpg",
  "dress_3": "https://m.media-amazon.com/images/I/71xmITQfqBL._AC_UL1200_.jpg",
  "dress_4": "https://m.media-amazon.com/images/I/71BZiHr7gTL._AC_UL1200_.jpg",
  "dress_5": "https://m.media-amazon.com/images/I/71EZ+bJEGRL._AC_UL1200_.jpg",
  "dress_6": "https://m.media-amazon.com/images/I/71fNYGPL0VL._AC_UL1200_.jpg",
  "dress_7": "https://m.media-amazon.com/images/I/71nHsGKaVuL._AC_UL1200_.jpg",
  "dress_8": "https://m.media-amazon.com/images/I/71kqnLkVOFL._AC_UL1200_.jpg",
};

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.amazon.com/",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on("finish", () => {
        stream.close();
        const size = fs.statSync(filepath).size;
        resolve(size);
      });
      stream.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  console.log(`Downloading ${Object.keys(IMAGES).length} product images...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const [key, url] of Object.entries(IMAGES)) {
    const filepath = path.join(IMG_DIR, `${key}.jpg`);
    
    // Skip if already downloaded
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
      console.log(`  ✅ ${key} (already exists)`);
      success++;
      continue;
    }
    
    try {
      const size = await downloadImage(url, filepath);
      console.log(`  ✅ ${key} (${Math.round(size / 1024)}KB)`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${key}: ${err.message}`);
      failed++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n${"=".repeat(40)}`);
  console.log(`  Downloaded: ${success}/${Object.keys(IMAGES).length}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Location: ${IMG_DIR}`);
  
  if (failed === 0) {
    console.log(`\n  Next: Update categories.ts image paths`);
    console.log(`  Run: node scripts/update-image-paths.mjs`);
  }
}

main();
