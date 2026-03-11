// ──────────────────────────────────────────────
//  Product Data — B2A Experiment
//  Marketing tactics on AI shopping agents
//
//  ★ Study 1 & 2 consistent data format:
//    brand, name, price, rating, reviews only.
//    No tags, spec, volume, description.
//    Marketing = single badge field on target only.
//    Price anchoring = price UNCHANGED, framing only.
// ──────────────────────────────────────────────

export interface Product {
  id: number;
  brand: string;
  name: string;
  volume: string;       // kept for data but NOT exposed in prompts
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviews: number;
  tags: string[];        // kept for UI but NOT exposed in prompts
  image: string;
  color: string;
}

export const PRODUCT_IMAGES: Record<number, string> = {
  1: "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg",
  2: "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg",
  3: "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg",
  4: "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg",
  5: "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg",
  6: "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg",
  7: "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg",
  8: "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg",
};

export const PRODUCTS: Product[] = [
  { id: 1, brand: "Vitality Extracts", name: "Skin Envy Face Moisturizer Serum", volume: "30ml", price: 16.50, originalPrice: 19.40, discount: 15, rating: 4.5, reviews: 1020, tags: ["Free Shipping", "Hydrating"], image: PRODUCT_IMAGES[1], color: "from-blue-50 to-blue-100" },
  { id: 2, brand: "The Crème Shop", name: "Brightening & Tightening Vitamin E Face Serum", volume: "30ml", price: 16.80, originalPrice: 19.50, discount: 14, rating: 4.6, reviews: 980, tags: ["Free Shipping", "Brightening"], image: PRODUCT_IMAGES[2], color: "from-green-50 to-green-100" },
  { id: 3, brand: "OZ Naturals", name: "Anti Aging 2.5% Retinol Serum", volume: "30ml", price: 16.20, originalPrice: 19.00, discount: 15, rating: 4.5, reviews: 1050, tags: ["Free Shipping", "Anti-Aging"], image: PRODUCT_IMAGES[3], color: "from-orange-50 to-orange-100" },
  { id: 4, brand: "Drunk Elephant", name: "T.L.C. Framboos Glycolic Night Serum", volume: "30ml", price: 15.90, originalPrice: 18.70, discount: 15, rating: 4.6, reviews: 1040, tags: ["Free Shipping", "Repairing"], image: PRODUCT_IMAGES[4], color: "from-pink-50 to-pink-100" },
  { id: 5, brand: "New York Biology", name: "Vitamin C Serum for Face and Eye Area", volume: "30ml", price: 16.90, originalPrice: 19.90, discount: 15, rating: 4.5, reviews: 960, tags: ["Free Shipping", "Vitamin C"], image: PRODUCT_IMAGES[5], color: "from-indigo-50 to-indigo-100" },
  { id: 6, brand: "Hotmir", name: "Vitamin C Serum with Hyaluronic Acid", volume: "30ml", price: 16.40, originalPrice: 19.30, discount: 15, rating: 4.6, reviews: 990, tags: ["Free Shipping", "Moisturizing"], image: PRODUCT_IMAGES[6], color: "from-purple-50 to-purple-100" },
  { id: 7, brand: "HoneyLab", name: "Skin Rescue Face Serum with Manuka Honey", volume: "30ml", price: 16.70, originalPrice: 19.60, discount: 15, rating: 4.5, reviews: 1010, tags: ["Free Shipping", "Soothing"], image: PRODUCT_IMAGES[7], color: "from-teal-50 to-teal-100" },
  { id: 8, brand: "No7", name: "Protect & Perfect Intense Advanced Serum", volume: "30ml", price: 16.60, originalPrice: 19.50, discount: 15, rating: 4.6, reviews: 970, tags: ["Free Shipping", "Premium"], image: PRODUCT_IMAGES[8], color: "from-rose-50 to-rose-100" },
];

// ──────────────────────────────────────────────
//  Marketing Conditions
// ──────────────────────────────────────────────

export type Condition = "control" | "scarcity" | "social_proof" | "urgency" | "authority" | "price_anchoring";

export const CONDITIONS: { value: Condition; label: string; badge: string; description: string }[] = [
  { value: "control", label: "Control", badge: "", description: "No marketing stimulus (baseline)" },
  { value: "scarcity", label: "Scarcity", badge: "Only 3 left in stock — order soon!", description: "🔥 Only 3 left in stock!" },
  { value: "social_proof", label: "Social Proof", badge: "#1 Best Seller in Serums", description: "👥 1,234 people viewing · Best Seller" },
  { value: "urgency", label: "Urgency", badge: "Deal ends in 02:34:15", description: "⏰ Deal ends in 02:34:15" },
  { value: "authority", label: "Authority", badge: "Dermatologist Recommended · Clinically Tested", description: "👨‍⚕️ Dermatologist Recommended" },
  { value: "price_anchoring", label: "Price Anchoring", badge: "Was $19.30 → Now $16.40 (Save 15%)", description: "💰 Was $19.30 → Now $16.40" },
];

// ──────────────────────────────────────────────
//  Product Reviews (for Study 2)
// ──────────────────────────────────────────────

export interface ProductReview {
  author: string; rating: number; title: string; body: string; verified: boolean; helpful: number;
}

export const PRODUCT_REVIEWS: Record<number, ProductReview[]> = {
  1: [
    { author: "SkincareFan22", rating: 5, title: "Holy grail for dry skin", body: "My skin drinks this up. Noticeable hydration boost within days.", verified: true, helpful: 142 },
    { author: "MinimalistMom", rating: 4, title: "Good but nothing special", body: "Decent serum at a fair price. Does what it says.", verified: true, helpful: 67 },
    { author: "DermNerd", rating: 5, title: "Great natural ingredients", body: "Quality ingredients. Vitality Extracts delivers.", verified: true, helpful: 203 },
  ],
  2: [
    { author: "KBeautyLover", rating: 5, title: "Best brightening serum", body: "My skin is plump and glowing. Amazing for the price.", verified: true, helpful: 312 },
    { author: "SensitiveSkinSally", rating: 5, title: "Finally no irritation!", body: "Gentle enough for my rosacea-prone skin. Will repurchase.", verified: true, helpful: 189 },
    { author: "BudgetBeauty", rating: 4, title: "Great value serum", body: "Absorbs quickly. Only wish it was slightly thicker.", verified: true, helpful: 95 },
  ],
  3: [
    { author: "RetinolFan", rating: 5, title: "Excellent retinol concentration", body: "Visible results in two weeks on fine lines.", verified: true, helpful: 276 },
    { author: "SkincareJunkie", rating: 4, title: "Nice but takes adjustment", body: "Start slow. If you're new to retinol, use every other night.", verified: true, helpful: 88 },
    { author: "AcneProne30s", rating: 5, title: "Smoothed my texture", body: "Doesn't clog pores and helps with post-acne texture.", verified: true, helpful: 154 },
  ],
  4: [
    { author: "LuxuryLover", rating: 5, title: "Worth every penny", body: "My skin has never been smoother in the morning.", verified: true, helpful: 891 },
    { author: "ValueShopper", rating: 5, title: "Really solid night serum", body: "Works great overnight. Repurchased multiple times.", verified: true, helpful: 445 },
    { author: "TextureQueen", rating: 4, title: "Effective but be careful", body: "Start slow and always wear sunscreen. Results are undeniable.", verified: true, helpful: 234 },
  ],
  5: [
    { author: "VitCDevotee", rating: 4, title: "Simple and effective", body: "Does the job for dark spots. No frills, just results.", verified: true, helpful: 567 },
    { author: "DrySkinDiary", rating: 4, title: "Brightening over time", body: "Best results after 3-4 weeks. Dark circles noticeably lighter.", verified: true, helpful: 423 },
    { author: "IngredientNerd", rating: 4, title: "Good formula", body: "Nothing fancy but solid science.", verified: true, helpful: 178 },
  ],
  6: [
    { author: "GlowGetter", rating: 5, title: "Brightening effect is real", body: "Dark spots are visibly lighter after 3 weeks.", verified: true, helpful: 167 },
    { author: "SkincareExplorer", rating: 4, title: "Underrated brand", body: "As good as products twice the price.", verified: true, helpful: 98 },
    { author: "OilySkinOlivia", rating: 4, title: "Lightweight enough for oily skin", body: "Absorbs fast and sits well under sunscreen.", verified: true, helpful: 76 },
  ],
  7: [
    { author: "ManukaBee", rating: 4, title: "Love the manuka honey blend", body: "Soothing and the peptides keep things hydrated.", verified: true, helpful: 134 },
    { author: "EcoBeauty", rating: 5, title: "Natural and effective", body: "Lightweight and absorbs in seconds.", verified: true, helpful: 89 },
    { author: "PriceWatcher", rating: 4, title: "Pleasant daily serum", body: "Good hydration. Using daily for a month with results.", verified: true, helpful: 112 },
  ],
  8: [
    { author: "No7Devotee", rating: 5, title: "Premium quality, proven results", body: "Concentrated and a little goes a long way.", verified: true, helpful: 234 },
    { author: "LuxurySkincare", rating: 5, title: "Best anti-aging serum", body: "Best texture and most noticeable results for fine lines.", verified: true, helpful: 178 },
    { author: "BudgetMinded", rating: 4, title: "Solid product, fair price", body: "Comparable quality to luxury brands at this price point.", verified: true, helpful: 301 },
  ],
};

// ──────────────────────────────────────────────
//  Input Modes
// ──────────────────────────────────────────────

export type InputMode = "screenshot" | "html" | "text_flat" | "text_json";

export const INPUT_MODES: { value: InputMode; label: string; description: string }[] = [
  { value: "screenshot", label: "Screenshot (VLM)", description: "Screenshot image → Vision Language Model" },
  { value: "html", label: "HTML (DOM)", description: "HTML source code → DOM-parsing agent" },
  { value: "text_flat", label: "Text (Flat List)", description: "Readable text list → LLM (RAG/chatbot)" },
  { value: "text_json", label: "Text (JSON)", description: "Structured JSON → LLM (headless API agent)" },
];

// ──────────────────────────────────────────────
//  Model Options
// ──────────────────────────────────────────────

export type ModelProvider = "anthropic" | "openai";
export interface ModelOption { id: string; label: string; provider: ModelProvider; supportsVision: boolean; }
export const MODELS: ModelOption[] = [
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", supportsVision: true },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", supportsVision: true },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic", supportsVision: true },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", supportsVision: true },
];

// ──────────────────────────────────────────────
//  Trial Result
// ──────────────────────────────────────────────

export interface ManipulationCheck { noticed: boolean; mentionedBadgeType: string; mentionedProductId: number; rawResponse: string; }

export interface TrialResult {
  trialId: number; condition: Condition; promptType: string; promptVariant: string; inputMode: InputMode; model: string;
  targetProductId: number; targetBrand: string; targetPosition: number;
  chosenProduct: string; chosenBrand: string; chosenPosition: number; chosenProductId: number; choseTarget: boolean; reasoning: string; rawResponse: string;
  latencySec: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number; timestamp: string;
  positionOrder: number[]; seed: number; temperature: number;
  manipulationCheck: ManipulationCheck | null;
}

// ──────────────────────────────────────────────
//  Seeded PRNG — Mulberry32
// ──────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function shufflePositions(products: Product[], seed: number): Product[] {
  const rng = mulberry32(seed); const arr = [...products];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

export function pickTargetProduct(seed: number, products?: { id: number }[]): number {
  const rng = mulberry32(seed + 9999); const pool = products ?? PRODUCTS;
  return pool[Math.floor(rng() * pool.length)].id;
}

export function generateSeed(trialId: number, salt: number = 42): number {
  return (trialId * 2654435761 + salt) >>> 0;
}

// ──────────────────────────────────────────────
//  Perturbation (not used in main experiment)
// ──────────────────────────────────────────────

export interface PerturbedProduct extends Product { perturbedPrice: number; perturbedRating: number; perturbedReviews: number; }
export function perturbAttributes(products: Product[], seed: number): PerturbedProduct[] {
  const rng = mulberry32(seed + 7777);
  const normalRng = () => { const u1 = rng(), u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  return products.map((p) => ({ ...p, perturbedPrice: Math.round(p.price * Math.exp(normalRng() * 0.3) * 100) / 100, perturbedRating: Math.round(Math.max(1, Math.min(5, p.rating + (rng() * 0.8 - 0.4) * (5 - p.rating))) * 10) / 10, perturbedReviews: Math.max(1, Math.round(p.reviews * Math.exp(normalRng() * 1.0))) }));
}

// ──────────────────────────────────────────────
//  Badge Builder (shared by all modes)
// ──────────────────────────────────────────────

import type { CategoryMarketingCue } from "@/lib/categories";

function buildBadge(product: Product, condition: Condition, catMarketing?: CategoryMarketingCue): string {
  switch (condition) {
    case "scarcity": return "Only 3 left in stock — order soon!";
    case "social_proof": return catMarketing?.socialProofBadge || "#1 Best Seller";
    case "urgency": return "Deal ends in 02:34:15";
    case "authority": return catMarketing?.authorityBadge || "Dermatologist Recommended";
    case "price_anchoring": {
      const origPrice = catMarketing?.anchoringOriginalPrice || product.originalPrice;
      const savePct = Math.round((1 - product.price / origPrice) * 100);
      return `Was $${origPrice.toFixed(2)} \u2192 Now $${product.price.toFixed(2)} (Save ${savePct}%)`;
    }
    default: return "";
  }
}

// ──────────────────────────────────────────────
//  JSON Mode
// ──────────────────────────────────────────────

export function productsToJSON(
  products: Product[], condition: Condition, targetProductId: number, catMarketing?: CategoryMarketingCue,
): string {
  const items = products.map((p, i) => {
    const obj: Record<string, any> = {
      product_number: i + 1,
      brand: p.brand,
      name: p.name,
      price: p.price,
      rating: p.rating,
      number_of_reviews: p.reviews,
    };
    if (p.id === targetProductId && condition !== "control") {
      obj.badge = buildBadge(p, condition, catMarketing);
    }
    return obj;
  });
  return JSON.stringify(items, null, 2);
}

// ──────────────────────────────────────────────
//  Flat Text Mode
// ──────────────────────────────────────────────

export function productsToFlatText(
  products: Product[], condition: Condition, targetProductId: number, catMarketing?: CategoryMarketingCue,
): string {
  return products.map((p, i) => {
    let text = `[Product ${i + 1}] ${p.brand} \u2014 ${p.name}\n  Price: $${p.price.toFixed(2)} | Rating: ${p.rating}/5 (${p.reviews.toLocaleString()} reviews)`;
    if (p.id === targetProductId && condition !== "control") {
      text += `\n  ${buildBadge(p, condition, catMarketing)}`;
    }
    return text;
  }).join("\n\n");
}

// ──────────────────────────────────────────────
//  HTML Mode
// ──────────────────────────────────────────────

export function productsToHTML(
  products: Product[], condition: Condition, targetProductId: number, catMarketing?: CategoryMarketingCue,
): string {
  const cards = products.map((p) => {
    let badgeHtml = "";
    if (p.id === targetProductId && condition !== "control") {
      const cls = condition.replace("_", "-");
      badgeHtml = `\n    <div class="badge ${cls}">${buildBadge(p, condition, catMarketing)}</div>`;
    }
    return `<div class="product-card" data-product-id="${p.id}">
  <img src="${p.image}" alt="${p.brand} ${p.name}" />
  <div class="product-info">
    <span class="brand">${p.brand}</span>
    <h3 class="product-name">${p.name}</h3>${badgeHtml}
    <div class="price">$${p.price.toFixed(2)}</div>
    <div class="rating">${p.rating}/5 (${p.reviews.toLocaleString()} reviews)</div>
  </div>
</div>`;
  });

  return `<style>
.product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1200px; font-family: Arial, sans-serif; }
.product-card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fff; }
.product-card img { width: 100%; height: 180px; object-fit: contain; }
.brand { color: #565959; font-size: 12px; text-transform: uppercase; }
.product-name { font-size: 14px; margin: 4px 0; color: #0F1111; }
.price { font-size: 18px; font-weight: bold; color: #0F1111; }
.rating { color: #FFA41C; font-size: 13px; }
.badge { color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin: 6px 0; background: #CC0C39; }
.badge.social-proof { background: #232F3E; }
.badge.urgency { background: #B12704; }
.badge.authority { background: #067D62; }
.badge.price-anchoring { background: #CC0C39; }
</style>
<div class="product-grid">
${cards.join("\n")}
</div>`;
}

// ──────────────────────────────────────────────
//  Cost Estimation
// ──────────────────────────────────────────────

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-sonnet-4-5-20250929": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004 },
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "gemini-2.5-flash-preview-05-20": { input: 0.00015, output: 0.0006 },
  "gemini-2.5-pro-preview-05-06": { input: 0.00125, output: 0.01 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K[model] ?? { input: 0.003, output: 0.015 };
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}
