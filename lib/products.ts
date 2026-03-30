// ──────────────────────────────────────────────
//  Product Data — B2A Experiment
//  Marketing tactics on AI shopping agents
//
//  ★ search: brand, name, price, rating, reviews (summary).
//    view_product: adds spec, description, features (detail).
//    Marketing = single badge field on target only.
//    Price anchoring = price UNCHANGED, framing only.
// ──────────────────────────────────────────────

export interface Product {
  id: number;
  brand: string;
  name: string;
  volume: string;       // kept for data but NOT exposed in prompts
  spec: string;          // exposed in view_product detail page
  description: string;   // exposed in view_product detail page
  features: string[];    // exposed in view_product detail page
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
  1: "/images/products/serum_1.jpg",
  2: "/images/products/serum_2.jpg",
  3: "/images/products/serum_3.jpg",
  4: "/images/products/serum_4.jpg",
  5: "/images/products/serum_5.jpg",
  6: "/images/products/serum_6.jpg",
  7: "/images/products/serum_7.jpg",
  8: "/images/products/serum_8.jpg",
};

export const PRODUCTS: Product[] = [
  { id: 1, brand: "Veladerm", name: "Gentle Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a gentle, lightweight formula. Absorbs quickly and is suitable for dry, sensitive skin. Ideal for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Lightweight texture", "Suitable for daily use"], price: 16.40, originalPrice: 19.30, discount: 15, rating: 4.5, reviews: 1000, tags: ["Free Shipping", "Hydrating"], image: PRODUCT_IMAGES[1], color: "from-blue-50 to-blue-100" },
  { id: 2, brand: "Lumiveil", name: "Silky Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a silky, smooth formula. Formulated for dry, sensitive skin types. Perfect addition to your everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Silky smooth texture", "Suitable for daily use"], price: 16.80, originalPrice: 19.70, discount: 15, rating: 4.6, reviews: 960, tags: ["Free Shipping", "Brightening"], image: PRODUCT_IMAGES[2], color: "from-green-50 to-green-100" },
  { id: 3, brand: "Puraflora", name: "Light Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a light, refreshing formula. Safe for dry, sensitive skin with a non-irritating texture. Designed for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Light refreshing feel", "Suitable for daily use"], price: 16.20, originalPrice: 19.00, discount: 15, rating: 4.5, reviews: 1050, tags: ["Free Shipping", "Anti-Aging"], image: PRODUCT_IMAGES[3], color: "from-orange-50 to-orange-100" },
  { id: 4, brand: "Dewbloom", name: "Pure Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a pure, clean formula. Gentle enough for dry, sensitive skin. Works well as part of an everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Pure clean formula", "Suitable for daily use"], price: 16.30, originalPrice: 19.10, discount: 15, rating: 4.5, reviews: 1030, tags: ["Free Shipping", "Repairing"], image: PRODUCT_IMAGES[4], color: "from-pink-50 to-pink-100" },
  { id: 5, brand: "Solbright", name: "Clear Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a clear, fast-absorbing formula. Suitable for dry, sensitive skin. An essential part of everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Clear fast-absorbing", "Suitable for daily use"], price: 16.90, originalPrice: 19.90, discount: 15, rating: 4.6, reviews: 920, tags: ["Free Shipping", "Vitamin C"], image: PRODUCT_IMAGES[5], color: "from-indigo-50 to-indigo-100" },
  { id: 6, brand: "Hydraveil", name: "Calm Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a calm, soothing formula for deep moisture. Formulated for dry, sensitive skin. Lightweight enough for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Calm soothing feel", "Suitable for daily use"], price: 16.50, originalPrice: 19.40, discount: 15, rating: 4.5, reviews: 980, tags: ["Free Shipping", "Moisturizing"], image: PRODUCT_IMAGES[6], color: "from-purple-50 to-purple-100" },
  { id: 7, brand: "Mellowskin", name: "Mild Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a mild, comforting formula for soothing moisture. Designed for dry, sensitive skin that needs gentle care. Great for everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Mild comforting feel", "Suitable for daily use"], price: 16.70, originalPrice: 19.60, discount: 15, rating: 4.6, reviews: 970, tags: ["Free Shipping", "Soothing"], image: PRODUCT_IMAGES[7], color: "from-teal-50 to-teal-100" },
  { id: 8, brand: "Glowture", name: "Smooth Moisture Face Serum", volume: "30ml", spec: "30ml", description: "A hydrating face serum with a smooth, velvety formula. Safe for dry, sensitive skin with a gentle texture. Fits seamlessly into everyday skincare routine.", features: ["Hydrating formula for dry skin", "Gentle on sensitive skin", "Smooth velvety texture", "Suitable for daily use"], price: 16.60, originalPrice: 19.50, discount: 15, rating: 4.6, reviews: 980, tags: ["Free Shipping", "Premium"], image: PRODUCT_IMAGES[8], color: "from-rose-50 to-rose-100" },
];

// ──────────────────────────────────────────────
//  Marketing Conditions
// ──────────────────────────────────────────────

export type Condition = "control" | "scarcity" | "social_proof_a" | "social_proof_b" | "urgency" | "authority_a" | "authority_b" | "price_anchoring";

export const CONDITIONS: { value: Condition; label: string; badge: string; description: string }[] = [
  { value: "control", label: "Control", badge: "", description: "No marketing stimulus (baseline)" },
  { value: "scarcity", label: "Scarcity", badge: "Only 3 left in stock — order soon!", description: "🔥 Only 3 left in stock!" },
  { value: "social_proof_a", label: "Social Proof A (Best Seller)", badge: "#1 Best Seller", description: "👥 #1 Best Seller" },
  { value: "social_proof_b", label: "Social Proof B (Popularity)", badge: "1,200+ people viewing this now", description: "👥 1,200+ viewing" },
  { value: "urgency", label: "Urgency", badge: "Only available today", description: "⏰ Only available today" },
  { value: "authority_a", label: "Authority A (Endorsement)", badge: "Recommended by Experts", description: "👨‍⚕️ Recommended by Experts" },
  { value: "authority_b", label: "Authority B (Certification)", badge: "Clinically Tested", description: "🏅 Clinically Tested" },
  { value: "price_anchoring", label: "Price Anchoring", badge: "Was $19.30 → Now $16.40 (Save 15%)", description: "💰 Was $19.30 → Now $16.40" },
];

// ──────────────────────────────────────────────
//  Product Reviews (for Study 2)
// ──────────────────────────────────────────────

export interface ProductReview {
  author: string; rating: number; title: string; body: string; verified: boolean; helpful: number;
}

// ★ Reviews: unique text per product, equalized tone/persuasiveness, helpful votes ~450 per product
export const PRODUCT_REVIEWS: Record<number, ProductReview[]> = {
  1: [
    { author: "SkincareFan22", rating: 5, title: "Holy grail for dry skin", body: "My skin drinks this up. Noticeable hydration boost within days.", verified: true, helpful: 168 },
    { author: "DermNerd", rating: 5, title: "Great natural ingredients", body: "Quality ingredients. Feels premium on the skin.", verified: true, helpful: 150 },
    { author: "MinimalistMom", rating: 4, title: "Good but nothing special", body: "Decent serum at a fair price. Does what it says.", verified: true, helpful: 132 },
  ],
  2: [
    { author: "KBeautyLover", rating: 5, title: "Skin feels plump and glowing", body: "Love the brightening effect. Great for the price.", verified: true, helpful: 172 },
    { author: "SensitiveSkinSally", rating: 5, title: "Finally no irritation", body: "Gentle enough for my rosacea-prone skin. Will repurchase.", verified: true, helpful: 146 },
    { author: "BudgetBeauty", rating: 4, title: "Great value serum", body: "Absorbs quickly. Only wish it was slightly thicker.", verified: true, helpful: 134 },
  ],
  3: [
    { author: "RetinolFan", rating: 5, title: "Excellent nourishing formula", body: "Visible results in two weeks on fine lines.", verified: true, helpful: 166 },
    { author: "AcneProne30s", rating: 5, title: "Smoothed my texture", body: "Doesn't clog pores and helps with overall texture.", verified: true, helpful: 152 },
    { author: "SkincareJunkie", rating: 4, title: "Nice daily serum", body: "Absorbs well. Good for everyday use.", verified: true, helpful: 130 },
  ],
  4: [
    { author: "TextureQueen", rating: 5, title: "Smoothing results are real", body: "My skin has never been smoother in the morning.", verified: true, helpful: 170 },
    { author: "ValueShopper", rating: 5, title: "Really solid serum", body: "Works great as part of my routine. Repurchased.", verified: true, helpful: 148 },
    { author: "GentleSkinGlow", rating: 4, title: "Effective and gentle", body: "Good for sensitive skin. Results are clear.", verified: true, helpful: 132 },
  ],
  5: [
    { author: "VitCDevotee", rating: 5, title: "Simple and effective", body: "Does the job for dark spots. No frills, just results.", verified: true, helpful: 164 },
    { author: "DrySkinDiary", rating: 5, title: "Brightening over time", body: "Best results after 3-4 weeks of consistent use.", verified: true, helpful: 154 },
    { author: "IngredientNerd", rating: 4, title: "Good formula overall", body: "Well-formulated with solid active ingredients.", verified: true, helpful: 128 },
  ],
  6: [
    { author: "GlowGetter", rating: 5, title: "Deep hydration achieved", body: "My dull skin looks revived after just a week.", verified: true, helpful: 174 },
    { author: "SkincareExplorer", rating: 5, title: "Impressive quality", body: "Performs well for the price point. Lightweight feel.", verified: true, helpful: 144 },
    { author: "OilySkinOlivia", rating: 4, title: "Lightweight enough for me", body: "Absorbs fast and sits well under sunscreen.", verified: true, helpful: 136 },
  ],
  7: [
    { author: "ManukaBee", rating: 5, title: "Love the soothing effect", body: "Calming and the skin feels hydrated all day.", verified: true, helpful: 168 },
    { author: "EcoBeauty", rating: 5, title: "Natural and effective", body: "Lightweight and absorbs in seconds. No residue.", verified: true, helpful: 150 },
    { author: "PriceWatcher", rating: 4, title: "Pleasant daily serum", body: "Good hydration. Using daily for a month with results.", verified: true, helpful: 130 },
  ],
  8: [
    { author: "SkinPerfector", rating: 5, title: "Quality serum, proven results", body: "Concentrated and a little goes a long way.", verified: true, helpful: 166 },
    { author: "DailyCareUser", rating: 5, title: "Great for fine lines", body: "Noticeable improvement in texture after a few weeks.", verified: true, helpful: 152 },
    { author: "BudgetMinded", rating: 4, title: "Solid product, fair price", body: "Good quality at this price point. No complaints.", verified: true, helpful: 134 },
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
    case "social_proof_a": return catMarketing?.socialProofBadgeA || "#1 Best Seller";
    case "social_proof_b": return catMarketing?.socialProofBadgeB || "1,200+ people viewing this now";
    case "urgency": return "Only available today";
    case "authority_a": return catMarketing?.authorityBadgeA || "Recommended by Experts";
    case "authority_b": return catMarketing?.authorityBadgeB || "Clinically Tested";
    case "price_anchoring": {
      const origPrice = catMarketing?.anchoringOriginalPrice || product.originalPrice;
      const savePct = Math.round((1 - product.price / origPrice) * 100);
      const origStr = "$" + origPrice.toFixed(2);
      const nowStr = "$" + product.price.toFixed(2);
      return `Was ${origStr} \u2192 Now ${nowStr} (Save ${savePct}%)`;
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
      product_id: p.id,
      position: i + 1,
      brand: p.brand,
      name: p.name,
      price: p.price,
      rating: p.rating,
      reviews: p.reviews,
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

// ★ Helper: SVG star for HTML mode (matches human UI)
function starSvg(filled: boolean, size: string = "12px"): string {
  const color = filled ? "#facc15" : "#e5e7eb";
  return `<svg viewBox="0 0 20 20" style="width:${size};height:${size};display:inline-block;vertical-align:middle;" fill="${color}"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
}

function starsRow(rating: number, size: string = "12px"): string {
  return [1,2,3,4,5].map(s => starSvg(s <= Math.floor(rating), size)).join("");
}

function badgeColorStyle(condition: string): string {
  if (condition === "scarcity") return "background:#dc2626;color:#fff;";
  if (condition.startsWith("social_proof")) return "background:#f97316;color:#fff;";
  if (condition === "urgency") return "background:#eab308;color:#111827;";
  if (condition.startsWith("authority")) return "background:#2563eb;color:#fff;";
  if (condition === "price_anchoring") return "background:#16a34a;color:#fff;";
  return "background:#374151;color:#fff;";
}

function badgeEmojiChar(condition: string): string {
  if (condition === "scarcity") return "\ud83d\udd25";
  if (condition.startsWith("social_proof")) return "\ud83d\udc65";
  if (condition === "urgency") return "\u23f0";
  if (condition.startsWith("authority")) return "\ud83c\udfc5";
  if (condition === "price_anchoring") return "\ud83d\udcb0";
  return "";
}

// ★ HTML Mode — visually matched to human UI ProductGrid (4x2 grid)
export function productsToHTML(
  products: Product[], condition: Condition, targetProductId: number, catMarketing?: CategoryMarketingCue, categoryLabel?: string,
): string {
  const cards = products.map((p) => {
    const isTarget = p.id === targetProductId;
    const isPriceAnchoring = isTarget && condition === "price_anchoring";
    const showBadge = isTarget && condition !== "control";
    const anchoringOriginalPrice = catMarketing?.anchoringOriginalPrice ?? p.originalPrice;

    let badgeHtml = "";
    if (showBadge) {
      const text = buildBadge(p, condition, catMarketing);
      badgeHtml = `<div style="margin-top:6px;"><span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;${badgeColorStyle(condition)}">${badgeEmojiChar(condition)} ${text}</span></div>`;
    }

    const priceStr = "$" + p.price.toFixed(2);
    const origPriceStr = "$" + anchoringOriginalPrice.toFixed(2);
    let priceHtml = `<span style="font-size:14px;font-weight:700;color:#111827;">${priceStr}</span>`;
    if (isPriceAnchoring) {
      priceHtml += ` <span style="font-size:10px;color:#9ca3af;text-decoration:line-through;">${origPriceStr}</span>`;
      priceHtml += ` <span style="font-size:9px;font-weight:600;color:#16a34a;background:#f0fdf4;padding:1px 4px;border-radius:4px;">Save ${Math.round((1 - p.price / anchoringOriginalPrice) * 100)}%</span>`;
    }

    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
  <div style="width:100%;height:112px;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;background:#f9fafb;overflow:hidden;">
    <img src="${p.image}" alt="${p.name}" style="max-height:100%;object-fit:contain;" />
  </div>
  <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">${p.brand}</div>
  <div style="font-size:12px;font-weight:500;color:#1f2937;margin-top:2px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.name}</div>
  <div style="margin-top:6px;display:flex;align-items:center;gap:2px;">
    ${starsRow(p.rating, "12px")}
    <span style="font-size:10px;color:#4b5563;font-weight:500;margin-left:2px;">${p.rating}</span>
    <span style="font-size:10px;color:#2563eb;margin-left:2px;">(${p.reviews.toLocaleString()})</span>
  </div>
  <div style="margin-top:6px;">${priceHtml}</div>
  ${badgeHtml}
  <div style="margin-top:6px;font-size:9px;color:#16a34a;font-weight:500;">Free Shipping</div>
</div>`;
  });

  return `<style>*{margin:0;padding:0;box-sizing:border-box;}</style>
<div style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background:#111827;color:#fff;padding:12px 20px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px;">
    <span style="font-size:16px;font-weight:700;">ShopSmart</span>
    <div style="flex:1;background:#1f2937;border-radius:6px;padding:6px 12px;font-size:14px;color:#9ca3af;display:flex;align-items:center;gap:8px;">
      <span style="color:#6b7280;">\ud83d\udd0d</span> ${categoryLabel || "Products"}
    </div>
    <div style="display:flex;align-items:center;gap:12px;color:#9ca3af;">
      <span>\ud83d\udc64</span>
      <span>\ud83d\uded2</span>
    </div>
  </div>
  <div style="background:#fff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:8px 20px;font-size:14px;color:#6b7280;">
    ${products.length} results | Sort: <span style="color:#374151;font-weight:500;">Recommended</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:16px;">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
      ${cards.join("\n      ")}
    </div>
  </div>
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
