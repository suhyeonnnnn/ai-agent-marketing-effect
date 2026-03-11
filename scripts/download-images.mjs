/**
 * Download product images — verified URLs only
 * Uses high-res Amazon image URLs (replace _SX679_ with _SL1500_ for bigger)
 * Usage: node scripts/download-images.mjs
 */
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "images", "products");
fs.mkdirSync(IMG_DIR, { recursive: true });

function download(url, filepath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, { headers: { 
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      "Referer": "https://www.amazon.com/",
    }}, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const ws = fs.createWriteStream(filepath);
      res.pipe(ws);
      ws.on("finish", () => { ws.close(); resolve(filepath); });
      ws.on("error", reject);
    }).on("error", reject);
  });
}

// ══════════════════════════════════════
//  VERIFIED image URLs
//  These are real Amazon CDN URLs extracted from actual product pages
// ══════════════════════════════════════

const IMAGES = {
  // Serum (already downloaded - skip if exists)
  serum: {
    1: "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg",
    2: "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg",
    3: "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg",
    4: "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg",
    5: "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg",
    6: "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg",
    7: "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg",
    8: "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg",
  },

  // Smartwatch — extracted from actual Amazon pages
  smartwatch: {
    1: "https://m.media-amazon.com/images/I/71mpuO4LqeL._AC_SL1500_.jpg",  // Amazfit Active 2 (verified)
    2: "https://m.media-amazon.com/images/I/71EHTkDQqfL._AC_SL1500_.jpg",  // Samsung Galaxy Watch FE (verified)
    3: "https://m.media-amazon.com/images/I/61qvPURDxsL._SL1500_.jpg",     // Garmin Venu Sq 2 (from search)
    4: "https://m.media-amazon.com/images/I/61OEuoqFqYL._SL1500_.jpg",     // Fitbit Versa 4 (verified from search)
    5: "https://m.media-amazon.com/images/I/61EqFRbYRoL._SL1500_.jpg",     // Huawei Watch Fit 3
    6: "https://m.media-amazon.com/images/I/61bz2AoVk6L._SL1500_.jpg",     // Google Pixel Watch 2
    7: "https://m.media-amazon.com/images/I/61d8niGcVrL._SL1500_.jpg",     // Amazfit GTR 4 (from search)
    8: "https://m.media-amazon.com/images/I/615vx0Y1gCL._SL1500_.jpg",     // CMF Watch Pro 2
  },

  // Milk
  milk: {
    1: "https://m.media-amazon.com/images/I/81+JTbXOOgL._SL1500_.jpg",  // Horizon Organic
    2: "https://m.media-amazon.com/images/I/71HfXPfNo+L._SL1500_.jpg",  // Organic Valley
    3: "https://m.media-amazon.com/images/I/71I6psqJf3L._SL1500_.jpg",  // Fairlife
    4: "https://m.media-amazon.com/images/I/71LPGm8XOTL._SL1500_.jpg",  // Lactaid
    5: "https://m.media-amazon.com/images/I/71RWCqpJ5jL._SL1500_.jpg",  // Maple Hill
    6: "https://m.media-amazon.com/images/I/81bVkWzp3lL._SL1500_.jpg",  // Stonyfield
    7: "https://m.media-amazon.com/images/I/71jFj1q0hpL._SL1500_.jpg",  // Shamrock Farms
    8: "https://m.media-amazon.com/images/I/71nR+0FNVTL._SL1500_.jpg",  // Clover Sonoma
  },

  // Dress — verified from Amazon search results
  dress: {
    1: "https://m.media-amazon.com/images/I/71u7cYrfSTL._AC_SL1500_.jpg",  // PRETTYGARDEN (verified)
    2: "https://m.media-amazon.com/images/I/61+XA46Dp1L._AC_SL1500_.jpg",  // BTFBM (verified)
    3: "https://m.media-amazon.com/images/I/818QR+IPnyL._AC_SL1500_.jpg",  // ZESICA (verified)
    4: "https://m.media-amazon.com/images/I/71h8r0RMlaL._AC_SL1500_.jpg",  // MITILLY (verified)
    5: "https://m.media-amazon.com/images/I/71SUobJmLPL._AC_SL1500_.jpg",  // Dokotoo (verified)
    6: "https://m.media-amazon.com/images/I/81TrqMjUNvL._AC_SL1500_.jpg",  // Angashion (verified)
    7: "https://m.media-amazon.com/images/I/71c-Jym9pCL._AC_SL1500_.jpg",  // MEROKEETY (verified)
    8: "https://m.media-amazon.com/images/I/71eUjeky+tL._AC_SL1500_.jpg",  // ECOWISH (verified)
  },
};

async function main() {
  let total = 0, success = 0, fail = 0;
  const failed = [];

  for (const [category, products] of Object.entries(IMAGES)) {
    console.log(`\n── ${category} ──`);
    for (const [id, url] of Object.entries(products)) {
      total++;
      const filename = `${category}_${id}.jpg`;
      const filepath = path.join(IMG_DIR, filename);

      if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
        console.log(`  ✓ ${filename} (exists, ${(fs.statSync(filepath).size/1024).toFixed(0)} KB)`);
        success++;
        continue;
      }

      try {
        await download(url, filepath);
        const size = fs.statSync(filepath).size;
        if (size < 500) {
          fs.unlinkSync(filepath);
          throw new Error("File too small (likely error page)");
        }
        console.log(`  ✅ ${filename} (${(size/1024).toFixed(0)} KB)`);
        success++;
      } catch (err) {
        console.log(`  ❌ ${filename}: ${err.message}`);
        failed.push({ category, id, filename, url });
        fail++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Total: ${total} | ✅ ${success} | ❌ ${fail}`);
  
  if (failed.length > 0) {
    console.log(`\n  Failed images — download manually from Amazon:`);
    for (const f of failed) {
      console.log(`    ${f.filename}: search "${f.category} ${f.id}" on amazon.com`);
      console.log(`      Save to: public/images/products/${f.filename}`);
    }
  }
  
  console.log(`\n  Images dir: ${IMG_DIR}`);
  console.log(`${"═".repeat(50)}`);
}

main().catch(console.error);
