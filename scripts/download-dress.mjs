/**
 * Download dress images only — using verified Amazon thumbnail URLs
 * Usage: node scripts/download-dress.mjs
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.resolve(__dirname, "..", "public", "images", "products");
fs.mkdirSync(IMG_DIR, { recursive: true });

function download(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": "https://www.amazon.com/",
    }}, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const ws = fs.createWriteStream(filepath);
      res.pipe(ws);
      ws.on("finish", () => { ws.close(); resolve(); });
    }).on("error", reject);
  });
}

// Verified URLs from Amazon search results (thumbnail size, but good enough)
const DRESS_IMAGES = {
  1: "https://m.media-amazon.com/images/I/81yo-wSUySL._AC_UL320_.jpg",  // PRETTYGARDEN
  2: "https://m.media-amazon.com/images/I/61+XA46Dp1L._AC_UL320_.jpg",  // BTFBM
  3: "https://m.media-amazon.com/images/I/61BfB6KN3LL._AC_UL320_.jpg",  // ZESICA
  4: "https://m.media-amazon.com/images/I/71h8r0RMlaL._AC_UL320_.jpg",  // MITILLY
  5: "https://m.media-amazon.com/images/I/71BSrqEmjGL._AC_UL320_.jpg",  // Dokotoo
  6: "https://m.media-amazon.com/images/I/81TrqMjUNvL._AC_UL320_.jpg",  // Angashion
  7: "https://m.media-amazon.com/images/I/71dkf-IiaBL._AC_UL320_.jpg",  // MEROKEETY
  8: "https://m.media-amazon.com/images/I/71eUjeky+tL._AC_UL320_.jpg",  // ECOWISH
};

async function main() {
  console.log("── Downloading dress images ──");
  for (const [id, url] of Object.entries(DRESS_IMAGES)) {
    const filepath = path.join(IMG_DIR, `dress_${id}.jpg`);
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 500) {
      console.log(`  ✓ dress_${id}.jpg (exists)`);
      continue;
    }
    try {
      await download(url, filepath);
      const size = fs.statSync(filepath).size;
      console.log(`  ✅ dress_${id}.jpg (${(size/1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`  ❌ dress_${id}.jpg: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}
main();
