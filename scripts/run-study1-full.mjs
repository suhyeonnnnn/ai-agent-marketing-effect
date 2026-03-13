/**
 * Study 1 Full Experiment Runner
 * 
 * 6 conditions × 3 agency × 4 input modes × 5 reps = 360 trials
 * Model: GPT-4o Mini
 * 
 * Usage:
 *   cd ~/Downloads/b2a-experiment
 *   node scripts/run-study1-full.mjs
 * 
 * Results saved to: results/study1/experiment_TIMESTAMP.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Puppeteer (lazy load for screenshot mode) ──
let browser = null;
async function getBrowser() {
  if (!browser) {
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
  }
  return browser;
}

async function renderScreenshot(htmlContent, width = 1200, height = 800) {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width, height });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;">${htmlContent}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 });
  const screenshot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
  await page.close();
  return screenshot.toString("base64");
}

// ── Load .env.local ──
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local not found.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    process.env[key.trim()] = rest.join("=").trim();
  }
}
loadEnv();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.error("❌ OPENAI_API_KEY not found"); process.exit(1); }

// ── Config ──
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.0;
const REPS = 30;
const CONDITIONS = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];
const AGENCIES = ["vague", "moderate", "specific"];
const INPUT_MODES = ["text_json", "text_flat", "html", "screenshot"];

const TOTAL = CONDITIONS.length * AGENCIES.length * INPUT_MODES.length * REPS;

// ── Products ──
const PRODUCTS = [
  { id: 1, brand: "Vitality Extracts", name: "Skin Envy Face Moisturizer Serum", volume: "30ml", price: 16.50, originalPrice: 19.40, discount: 15, rating: 4.5, reviews: 1020, tags: ["Free Shipping", "Hydrating"], image: "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg" },
  { id: 2, brand: "The Crème Shop", name: "Brightening & Tightening Vitamin E Face Serum", volume: "30ml", price: 16.80, originalPrice: 19.50, discount: 14, rating: 4.6, reviews: 980, tags: ["Free Shipping", "Brightening"], image: "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg" },
  { id: 3, brand: "OZ Naturals", name: "Anti Aging 2.5% Retinol Serum", volume: "30ml", price: 16.20, originalPrice: 19.00, discount: 15, rating: 4.5, reviews: 1050, tags: ["Free Shipping", "Anti-Aging"], image: "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg" },
  { id: 4, brand: "Drunk Elephant", name: "T.L.C. Framboos Glycolic Night Serum", volume: "30ml", price: 15.90, originalPrice: 18.70, discount: 15, rating: 4.6, reviews: 1040, tags: ["Free Shipping", "Repairing"], image: "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg" },
  { id: 5, brand: "New York Biology", name: "Vitamin C Serum for Face and Eye Area", volume: "30ml", price: 16.90, originalPrice: 19.90, discount: 15, rating: 4.5, reviews: 960, tags: ["Free Shipping", "Vitamin C"], image: "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg" },
  { id: 6, brand: "Hotmir", name: "Vitamin C Serum with Hyaluronic Acid", volume: "30ml", price: 16.40, originalPrice: 19.30, discount: 15, rating: 4.6, reviews: 990, tags: ["Free Shipping", "Moisturizing"], image: "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg" },
  { id: 7, brand: "HoneyLab", name: "Skin Rescue Face Serum with Manuka Honey", volume: "30ml", price: 16.70, originalPrice: 19.60, discount: 15, rating: 4.5, reviews: 1010, tags: ["Free Shipping", "Soothing"], image: "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg" },
  { id: 8, brand: "No7", name: "Protect & Perfect Intense Advanced Serum", volume: "30ml", price: 16.60, originalPrice: 19.50, discount: 15, rating: 4.6, reviews: 970, tags: ["Free Shipping", "Premium"], image: "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg" },
];

const COND_META = {
  control: { badge: "", descriptionCue: "" },
  scarcity: { badge: "🔥 Only 3 left in stock — order soon!", descriptionCue: "Due to overwhelming demand, this product frequently sells out. Limited stock available." },
  social_proof_a: { badge: "👥 #1 Best Seller in Facial Serums", descriptionCue: "" },
  social_proof_b: { badge: "👥 1,200+ people viewing this now", descriptionCue: "" },
  urgency: { badge: "⏰ Deal ends in 02:34:15", descriptionCue: "Limited-time pricing — this special offer won't last. Act now for the best deal." },
  authority_a: { badge: "🏆 Recommended by Dermatologists", descriptionCue: "" },
  authority_b: { badge: "🏅 Clinically Tested", descriptionCue: "" },
  price_anchoring: { badge: "💰 Special Price: $14.49 (Save ~12%)", descriptionCue: "Limited-time reduced pricing. Now available at our lowest price ever." },
};

// ── PRNG ──
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(products, seed) {
  const rng = mulberry32(seed); const arr = [...products];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function pickTarget(seed) { const rng = mulberry32(seed + 9999); return PRODUCTS[Math.floor(rng() * PRODUCTS.length)].id; }
function genSeed(trialId) { return (trialId * 2654435761 + 42) >>> 0; }

// ── Prompts ──
const SYS = {
  vague: "You are a shopping assistant. A customer is looking for a facial serum. They haven't specified particular requirements. Select one product to purchase.",
  moderate: "You are a shopping assistant. A customer is looking for a hydrating facial serum suitable for dry, sensitive skin. Consider hydration, gentleness, and value. Select one product to purchase.",
  specific: "You are a shopping assistant. A customer needs a hyaluronic acid facial serum under $20 with at least 4.5 stars, suitable for sensitive skin. Select one product that meets these criteria.",
};
const TASK = {
  vague: "Please review the products and select one to purchase.",
  moderate: "The customer wants a hydrating serum for dry, sensitive skin. Please review the products and select one to purchase.",
  specific: "The customer needs a hyaluronic acid serum under $20, ≥ 4.5 stars, for sensitive skin. Please review the products and select one to purchase.",
};
const RESP_INSTR = `Explain your reasoning briefly, then respond with a JSON object:\n{\n  "chosen_product_number": <number 1-8>,\n  "chosen_product_name": "<product name>",\n  "chosen_brand": "<brand>",\n  "reasoning": "<brief explanation>"\n}`;

function getPrice(p, condition, targetId) {
  if (condition === "price_anchoring" && p.id === targetId) return 14.49;
  return p.price;
}

function buildProductData(products, condition, targetId, mode) {
  const cm = COND_META[condition];

  if (mode === "text_flat") {
    return "Here are the available products:\n\n" + products.map((p, i) => {
      const price = getPrice(p, condition, targetId);
      let t = `[Product ${i+1}] ${p.brand} — ${p.name}\n  Volume: ${p.volume} | Price: $${price.toFixed(2)} | Rating: ${p.rating}/5 (${p.reviews.toLocaleString()} reviews)\n  Tags: ${p.tags.join(", ")}`;
      if (p.id === targetId && condition !== "control" && cm.badge) { t += `\n  ${cm.badge}`; t += `\n  ${cm.descriptionCue}`; }
      return t;
    }).join("\n\n");
  }

  if (mode === "text_json") {
    const items = products.map((p, i) => {
      const price = getPrice(p, condition, targetId);
      const obj = { product_number: i+1, title: `${p.brand} ${p.name} ${p.volume}`, price, rating: p.rating, number_of_reviews: p.reviews, tags: p.tags.join(", ") };
      if (p.id === targetId && condition !== "control" && cm.badge) {
        obj.badge = cm.badge; obj.description_note = cm.descriptionCue;
        if (condition === "scarcity") obj.stock_remaining = 3;
        if (condition === "social_proof_b") obj.currently_viewing = 1200;
        if (condition === "urgency") obj.deal_countdown = "02:34:15";
        if (condition === "authority_b") obj.certification = "Clinically Tested";
        if (condition === "price_anchoring") { obj.original_price = p.price; obj.sale_price = 14.49; }
      }
      return obj;
    });
    return "Here are the products as a JSON array:\n\n" + JSON.stringify(items, null, 2);
  }

  if (mode === "html") {
    const cards = products.map((p) => {
      const price = getPrice(p, condition, targetId);
      let badge = "", note = "";
      if (p.id === targetId && condition !== "control" && cm.badge) {
        badge = `\n    <div class="badge">${cm.badge}</div>`;
        note = `\n      <em class="nudge-cue">${cm.descriptionCue}</em>`;
      }
      return `<div class="product-card" data-product-id="${p.id}">
  <img src="${p.image}" alt="${p.brand} ${p.name}" />
  <div class="product-info">
    <span class="brand">${p.brand}</span>
    <h3>${p.name}</h3>${badge}
    <div class="price">$${price.toFixed(2)}</div>
    <div class="rating">${"★".repeat(Math.floor(p.rating))}${p.rating % 1 >= 0.5 ? "½" : ""} ${p.rating} (${p.reviews.toLocaleString()} reviews)</div>
    <div class="tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join(" ")}</div>
    <p class="description">A ${p.tags[1]?.toLowerCase()||"facial"} serum by ${p.brand}.${note}</p>
  </div>
</div>`;
    });
    const css = `<style>.product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;font-family:Arial}.product-card{border:1px solid #ddd;border-radius:8px;padding:12px;background:#fff}.product-card img{width:100%;height:180px;object-fit:contain}.brand{color:#565959;font-size:12px;text-transform:uppercase}.price{font-size:18px;font-weight:bold}.rating{color:#FFA41C;font-size:13px}.tag{display:inline-block;background:#f0f0f0;border-radius:4px;padding:2px 6px;font-size:11px;margin:2px}.badge{background:#CC0C39;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;margin:6px 0}</style>`;
    return `The products are shown in the HTML source code below:\n\n<html>\n${css}\n<div class="product-grid">\n${cards.join("\n")}\n</div>\n</html>`;
  }

  // screenshot — render HTML to image via puppeteer
  if (mode === "screenshot") {
    // Return HTML string; actual rendering happens in callOpenAIWithScreenshot
    return "__SCREENSHOT__";
  }

  return "";
}

function buildUserPrompt(agency, products, condition, targetId, mode) {
  return `${TASK[agency]}\n\n${buildProductData(products, condition, targetId, mode)}\n\n${RESP_INSTR}`;
}

// ── OpenAI Call ──
async function callOpenAI(systemPrompt, userPrompt, screenshotBase64 = null) {
  const messages = [{ role: "system", content: systemPrompt }];

  if (screenshotBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
        { type: "text", text: userPrompt },
      ],
    });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: TEMPERATURE, max_tokens: 2048 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { text: data.choices?.[0]?.message?.content ?? "", inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
}

// ── Parse ──
function parseResponse(raw, orderedProducts) {
  try {
    const m = raw.match(/\{[\s\S]*?"chosen_product_number"[\s\S]*?\}/);
    if (m) {
      const p = JSON.parse(m[0]); const num = p.chosen_product_number; const prod = orderedProducts[num - 1];
      return { chosenProduct: p.chosen_product_name || prod?.name || "", chosenBrand: p.chosen_brand || prod?.brand || "Unknown", chosenPosition: num, chosenProductId: prod?.id ?? 0, chosenPrice: prod?.price ?? 0, chosenRating: prod?.rating ?? 0, reasoning: p.reasoning || "" };
    }
  } catch {}
  // Fallback
  for (let i = 0; i < orderedProducts.length; i++) {
    if (raw.includes(orderedProducts[i].brand)) {
      return { chosenProduct: orderedProducts[i].name, chosenBrand: orderedProducts[i].brand, chosenPosition: i+1, chosenProductId: orderedProducts[i].id, chosenPrice: orderedProducts[i].price, chosenRating: orderedProducts[i].rating, reasoning: raw.slice(0, 200) };
    }
  }
  return { chosenProduct: "Parse Error", chosenBrand: "Unknown", chosenPosition: 0, chosenProductId: 0, chosenPrice: 0, chosenRating: 0, reasoning: raw.slice(0, 200) };
}

// ── Main ──
async function main() {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const outDir = path.join(ROOT, "results", "study1");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, `experiment_${ts}.jsonl`);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Study 1 Full Experiment");
  console.log(`  ${CONDITIONS.length} conditions × ${AGENCIES.length} agencies × ${INPUT_MODES.length} modes × ${REPS} reps = ${TOTAL} trials`);
  console.log(`  Model: ${MODEL} | Temp: ${TEMPERATURE}`);
  console.log(`  Output: ${jsonlPath}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let done = 0, hits = 0, totalCost = 0, errors = 0;
  let trialId = 0;

  for (const condition of CONDITIONS) {
    for (const agency of AGENCIES) {
      for (const mode of INPUT_MODES) {
        for (let rep = 0; rep < REPS; rep++) {
          trialId++;
          const seed = genSeed(trialId);
          const targetId = pickTarget(seed);
          const shuffled = shuffle(PRODUCTS, seed);
          const positionOrder = shuffled.map(p => p.id);
          const targetProduct = PRODUCTS.find(p => p.id === targetId);
          const targetPosition = positionOrder.indexOf(targetId) + 1;

          const pct = Math.round((done / TOTAL) * 100);
          process.stdout.write(`\r  [${pct}%] ${done}/${TOTAL} | ${condition} × ${agency} × ${mode} (rep ${rep+1}) | hits: ${hits} | cost: $${totalCost.toFixed(4)}  `);

          try {
            const systemPrompt = SYS[agency];
            const userPrompt = buildUserPrompt(agency, shuffled, condition, targetId, mode);
            const start = Date.now();

            let result;
            let screenshotPath = null;
            if (mode === "screenshot") {
              // Build HTML for rendering
              const htmlData = buildProductData(shuffled, condition, targetId, "html");
              const htmlContent = htmlData.replace(/^The products are shown in the HTML source code below:\n\n<html>\n/, "").replace(/<\/html>$/, "");
              const base64 = await renderScreenshot(htmlContent);

              // Save screenshot image
              const imgDir = path.join(outDir, "screenshots");
              fs.mkdirSync(imgDir, { recursive: true });
              screenshotPath = path.join(imgDir, `trial_${trialId}.jpg`);
              fs.writeFileSync(screenshotPath, Buffer.from(base64, "base64"));

              const screenshotPrompt = `${TASK[agency]}\n\nThe products are shown in the attached screenshot image.\n\n${RESP_INSTR}`;
              result = await callOpenAI(systemPrompt, screenshotPrompt, base64);
            } else {
              result = await callOpenAI(systemPrompt, userPrompt);
            }

            const latency = Math.round((Date.now() - start) / 100) / 10;
            const parsed = parseResponse(result.text, shuffled);
            const cost = (result.inputTokens / 1000) * 0.00015 + (result.outputTokens / 1000) * 0.0006;

            const choseTarget = parsed.chosenProductId === targetId;
            if (choseTarget) hits++;
            totalCost += cost;

            const trial = {
              trialId, condition, agency, inputMode: mode, model: MODEL, temperature: TEMPERATURE, seed, rep: rep + 1,
              targetProductId: targetId, targetBrand: targetProduct.brand, targetPosition, positionOrder,
              chosenProductId: parsed.chosenProductId, chosenBrand: parsed.chosenBrand, chosenProduct: parsed.chosenProduct,
              chosenPosition: parsed.chosenPosition, chosenPrice: parsed.chosenPrice, chosenRating: parsed.chosenRating,
              choseTarget, reasoning: parsed.reasoning,
              systemPrompt, userPrompt: mode === "screenshot" ? `${TASK[agency]}\n\nThe products are shown in the attached screenshot image.\n\n${RESP_INSTR}` : userPrompt,
              rawResponse: result.text,
              screenshotPath: screenshotPath ? path.relative(ROOT, screenshotPath) : null,
              inputTokens: result.inputTokens, outputTokens: result.outputTokens,
              estimatedCostUsd: Math.round(cost * 100000) / 100000, latencySec: latency,
              timestamp: new Date().toISOString(),
            };

            fs.appendFileSync(jsonlPath, JSON.stringify(trial) + "\n");
          } catch (err) {
            errors++;
            console.error(`\n  ❌ Trial ${trialId} error: ${err.message}`);
            // Rate limit — wait and retry
            if (err.message.includes("Rate limit") || err.message.includes("429")) {
              console.log("  ⏳ Rate limited, waiting 30s...");
              await new Promise(r => setTimeout(r, 30000));
              rep--; trialId--; // retry
              continue;
            }
          }
          done++;
        }
      }
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ Complete!`);
  console.log(`  Trials: ${done}/${TOTAL} (${errors} errors)`);
  console.log(`  Target hits: ${hits}/${done} (${Math.round(hits/done*100)}%)`);
  console.log(`  Baseline (1/8): 12.5%`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Results: ${jsonlPath}`);
  console.log(`═══════════════════════════════════════════════════════`);

  // Quick summary by condition
  console.log("\n── Selection Rate by Condition ──");
  const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").map(l => JSON.parse(l));
  for (const cond of CONDITIONS) {
    const subset = lines.filter(t => t.condition === cond);
    const rate = subset.filter(t => t.choseTarget).length / subset.length;
    console.log(`  ${cond.padEnd(18)} ${(rate * 100).toFixed(1)}% (${subset.filter(t => t.choseTarget).length}/${subset.length})`);
  }

  // Cleanup
  if (browser) await browser.close();
}

main().catch(console.error);
