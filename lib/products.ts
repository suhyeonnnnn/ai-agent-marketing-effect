// ──────────────────────────────────────────────
//  Product Data — B2A Experiment
//  Marketing tactics on AI shopping agents
//  Informed by ACES (Allouah et al., 2025) &
//  Bias Beware (Filandrianos et al., 2025)
// ──────────────────────────────────────────────

export interface Product {
  id: number;
  brand: string;
  name: string;
  volume: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviews: number;
  tags: string[];
  image: string;
  color: string;
}

// 8 products in a 2×4 grid (ACES-style)
// ★ EQUALIZED ATTRIBUTES: Price ~$16, Rating 4.5~4.6, Reviews ~1000, Volume 50ml
//   → Eliminates confounds so only nudge (IV) drives choice
//   → Position & target are randomized per trial via seed
// Amazon image URLs from McAuley-Lab/Amazon-Reviews-2023 dataset (All Beauty)
// Real product images sourced from Amazon CDN
export const PRODUCT_IMAGES: Record<number, string> = {
  1: "https://m.media-amazon.com/images/I/812jAPTxO5L._SL1500_.jpg",  // Vitality Extracts Face Serum
  2: "https://m.media-amazon.com/images/I/31HZGVyqEwL.jpg",           // The Crème Shop Vit E Serum
  3: "https://m.media-amazon.com/images/I/81kewhPAOQL._SL1500_.jpg",  // OZNaturals Retinol Serum
  4: "https://m.media-amazon.com/images/I/61i1cD2PSvL._SL1024_.jpg",  // Drunk Elephant Night Serum
  5: "https://m.media-amazon.com/images/I/71+4KZ5OPmL._SL1500_.jpg",  // NY Biology Vitamin C Serum
  6: "https://m.media-amazon.com/images/I/619TLnQCe2L._SL1500_.jpg",  // Hotmir Vitamin C Serum
  7: "https://m.media-amazon.com/images/I/71KXbWY7hjL._SL1500_.jpg",  // HoneyLab Face Serum
  8: "https://m.media-amazon.com/images/I/51VrD5agxWL._SL1500_.jpg",  // No7 Advanced Serum
};

// Product data sourced from Amazon Reviews 2023 dataset (McAuley Lab, UCSD)
// Images & brand names are real; attributes are equalized to eliminate confounds
export const PRODUCTS: Product[] = [
  {
    id: 1, brand: "Vitality Extracts", name: "Skin Envy Face Moisturizer Serum",
    volume: "30ml", price: 16.50, originalPrice: 19.40, discount: 15,
    rating: 4.5, reviews: 1020, tags: ["Free Shipping", "Hydrating"],
    image: PRODUCT_IMAGES[1],
    color: "from-blue-50 to-blue-100",
  },
  {
    id: 2, brand: "The Crème Shop", name: "Brightening & Tightening Vitamin E Face Serum",
    volume: "30ml", price: 16.80, originalPrice: 19.50, discount: 14,
    rating: 4.6, reviews: 980, tags: ["Free Shipping", "Brightening"],
    image: PRODUCT_IMAGES[2],
    color: "from-green-50 to-green-100",
  },
  {
    id: 3, brand: "OZ Naturals", name: "Anti Aging 2.5% Retinol Serum",
    volume: "30ml", price: 16.20, originalPrice: 19.00, discount: 15,
    rating: 4.5, reviews: 1050, tags: ["Free Shipping", "Anti-Aging"],
    image: PRODUCT_IMAGES[3],
    color: "from-orange-50 to-orange-100",
  },
  {
    id: 4, brand: "Drunk Elephant", name: "T.L.C. Framboos Glycolic Night Serum",
    volume: "30ml", price: 15.90, originalPrice: 18.70, discount: 15,
    rating: 4.6, reviews: 1040, tags: ["Free Shipping", "Repairing"],
    image: PRODUCT_IMAGES[4],
    color: "from-pink-50 to-pink-100",
  },
  {
    id: 5, brand: "New York Biology", name: "Vitamin C Serum for Face and Eye Area",
    volume: "30ml", price: 16.90, originalPrice: 19.90, discount: 15,
    rating: 4.5, reviews: 960, tags: ["Free Shipping", "Vitamin C"],
    image: PRODUCT_IMAGES[5],
    color: "from-indigo-50 to-indigo-100",
  },
  {
    id: 6, brand: "Hotmir", name: "Vitamin C Serum with Hyaluronic Acid",
    volume: "30ml", price: 16.40, originalPrice: 19.30, discount: 15,
    rating: 4.6, reviews: 990, tags: ["Free Shipping", "Moisturizing"],
    image: PRODUCT_IMAGES[6],
    color: "from-purple-50 to-purple-100",
  },
  {
    id: 7, brand: "HoneyLab", name: "Skin Rescue Face Serum with Manuka Honey",
    volume: "30ml", price: 16.70, originalPrice: 19.60, discount: 15,
    rating: 4.5, reviews: 1010, tags: ["Free Shipping", "Soothing"],
    image: PRODUCT_IMAGES[7],
    color: "from-teal-50 to-teal-100",
  },
  {
    id: 8, brand: "No7", name: "Protect & Perfect Intense Advanced Serum",
    volume: "30ml", price: 16.60, originalPrice: 19.50, discount: 15,
    rating: 4.6, reviews: 970, tags: ["Free Shipping", "Premium"],
    image: PRODUCT_IMAGES[8],
    color: "from-rose-50 to-rose-100",
  },
];

// ──────────────────────────────────────────────
//  Appeal Conditions (Marketing Nudges)
// ──────────────────────────────────────────────

export type Condition =
  | "control"
  | "scarcity"
  | "social_proof"
  | "urgency"
  | "authority"
  | "price_anchoring";

export const CONDITIONS: {
  value: Condition;
  label: string;
  description: string;
  badge: string;
  descriptionCue: string;
}[] = [
  {
    value: "control",
    label: "Control",
    description: "No marketing stimulus (baseline)",
    badge: "",
    descriptionCue: "",
  },
  {
    value: "scarcity",
    label: "Scarcity",
    description: "🔥 Only 3 left in stock!",
    badge: "Only 3 left in stock — order soon!",
    descriptionCue: "Due to overwhelming demand, this product frequently sells out. Limited stock available.",
  },
  {
    value: "social_proof",
    label: "Social Proof",
    description: "👥 1,234 people viewing · Best Seller",
    badge: "1,234 people viewing now · #1 Best Seller in Serums",
    descriptionCue: "Trusted by 50,000+ skincare enthusiasts. Featured in top beauty blogs and social media.",
  },
  {
    value: "urgency",
    label: "Urgency",
    description: "⏰ Deal ends in 02:34:15",
    badge: "Deal ends in 02:34:15",
    descriptionCue: "Limited-time pricing — this special offer won't last. Act now for the best deal.",
  },
  {
    value: "authority",
    label: "Authority",
    description: "🏆 Dermatologist Recommended",
    badge: "Dermatologist Recommended · Clinically Tested",
    descriptionCue: "Recommended by board-certified dermatologists. Clinically proven to improve skin hydration by 73% in 4 weeks.",
  },
  {
    value: "price_anchoring",
    label: "Price Anchoring",
    description: "💰 Was $16.XX → Now $14.49",
    badge: "Special Price: $14.49 (Save ~12%)",
    descriptionCue: "Limited-time reduced pricing. Now available at our lowest price ever.",
  },
];

// ──────────────────────────────────────────────
//  Product Reviews (for Study 2 multi-step)
// ──────────────────────────────────────────────

export interface ProductReview {
  author: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  helpful: number;
}

export const PRODUCT_REVIEWS: Record<number, ProductReview[]> = {
  1: [ // Vitality Extracts
    { author: "SkincareFan22", rating: 5, title: "Holy grail for dry skin", body: "My skin drinks this up. Noticeable hydration boost within days. The coconut oil blend is lovely.", verified: true, helpful: 142 },
    { author: "MinimalistMom", rating: 4, title: "Good but nothing special", body: "Decent serum at a fair price. Does what it says but didn't wow me compared to others I've tried.", verified: true, helpful: 67 },
    { author: "DermNerd", rating: 5, title: "Great natural ingredients", body: "Frankincense and collagen combo is a proven approach. Vitality Extracts delivers on quality.", verified: true, helpful: 203 },
  ],
  2: [ // The Crème Shop
    { author: "KBeautyLover", rating: 5, title: "Best brightening serum I've tried", body: "Vitamin E with ceramides actually makes a difference. My skin is plump and glowing. Amazing for the price.", verified: true, helpful: 312 },
    { author: "SensitiveSkinSally", rating: 5, title: "Finally no irritation!", body: "I've tried so many serums that sting. This one is gentle enough for my rosacea-prone skin. Will repurchase.", verified: true, helpful: 189 },
    { author: "BudgetBeauty", rating: 4, title: "Great value serum", body: "You get a lot of product for the price. Absorbs quickly. Only wish it was slightly thicker.", verified: true, helpful: 95 },
  ],
  3: [ // OZ Naturals
    { author: "RetinolFan", rating: 5, title: "Excellent retinol concentration", body: "2.5% retinol is effective without being too harsh. Visible results in two weeks on fine lines.", verified: true, helpful: 276 },
    { author: "SkincareJunkie", rating: 4, title: "Nice but takes adjustment", body: "Works well for anti-aging but start slow. If you're new to retinol, use every other night first.", verified: true, helpful: 88 },
    { author: "AcneProne30s", rating: 5, title: "Smoothed my texture", body: "Perfect for layering. Doesn't clog pores and actually helps with post-acne texture.", verified: true, helpful: 154 },
  ],
  4: [ // Drunk Elephant
    { author: "LuxuryLover", rating: 5, title: "Worth every penny", body: "Glycolic night serum that actually delivers. My skin has never been smoother in the morning.", verified: true, helpful: 891 },
    { author: "ValueShopper", rating: 5, title: "Really solid night serum", body: "A premium serum at a fair price. Works great overnight. Repurchased multiple times.", verified: true, helpful: 445 },
    { author: "TextureQueen", rating: 4, title: "Effective but be careful", body: "The glycolic acid is potent. Start slow and always wear sunscreen. Results are undeniable though.", verified: true, helpful: 234 },
  ],
  5: [ // New York Biology
    { author: "VitCDevotee", rating: 4, title: "Simple and effective", body: "Highest grade vitamin C serum. Does the job for dark spots. No frills, just results.", verified: true, helpful: 567 },
    { author: "DrySkinDiary", rating: 4, title: "Brightening over time", body: "Best results after consistent use for 3-4 weeks. My dark circles are noticeably lighter.", verified: true, helpful: 423 },
    { author: "IngredientNerd", rating: 4, title: "Good L-Ascorbic Acid formula", body: "Professional grade vitamin C. Dropper works well. Nothing fancy but solid science.", verified: true, helpful: 178 },
  ],
  6: [ // Hotmir
    { author: "GlowGetter", rating: 5, title: "Brightening effect is real", body: "After 3 weeks my dark spots are visibly lighter. Elegant texture that layers beautifully.", verified: true, helpful: 167 },
    { author: "SkincareExplorer", rating: 4, title: "Underrated brand", body: "Hotmir doesn't get enough hype. This serum is as good as products twice the price.", verified: true, helpful: 98 },
    { author: "OilySkinOlivia", rating: 4, title: "Lightweight enough for oily skin", body: "Finally a serum that doesn't make me greasy by noon. Absorbs fast and sits well under sunscreen.", verified: true, helpful: 76 },
  ],
  7: [ // HoneyLab
    { author: "ManukaBee", rating: 4, title: "Love the manuka honey blend", body: "Marine extracts with manuka honey is soothing and the peptides keep things hydrated. Great daily serum.", verified: true, helpful: 134 },
    { author: "EcoBeauty", rating: 5, title: "Natural and effective", body: "Great brand with quality ingredients. This serum is lightweight and absorbs in seconds.", verified: true, helpful: 89 },
    { author: "PriceWatcher", rating: 4, title: "Pleasant daily serum", body: "Nice anti-wrinkle properties. Good hydration. Been using daily for a month with great results.", verified: true, helpful: 112 },
  ],
  8: [ // No7
    { author: "No7Devotee", rating: 5, title: "Premium quality, proven results", body: "No7's advanced serum is clinically proven. This serum is concentrated and a little goes a long way.", verified: true, helpful: 234 },
    { author: "LuxurySkincare", rating: 5, title: "Best anti-aging serum", body: "Tried dozens of serums. No7 has the best texture and most noticeable results for fine lines.", verified: true, helpful: 178 },
    { author: "BudgetMinded", rating: 4, title: "Solid product, fair price", body: "Rice protein and alfalfa complex works well. Comparable quality to luxury brands at this price point.", verified: true, helpful: 301 },
  ],
};

// ──────────────────────────────────────────────
//  Input Modes (Architecture)
// ──────────────────────────────────────────────

export type InputMode = "screenshot" | "html" | "text_flat" | "text_json";

export const INPUT_MODES: { value: InputMode; label: string; description: string }[] = [
  { value: "screenshot",  label: "Screenshot (VLM)",    description: "Screenshot image → Vision Language Model" },
  { value: "html",        label: "HTML (DOM)",           description: "HTML source code → DOM-parsing agent" },
  { value: "text_flat",   label: "Text (Flat List)",     description: "Readable text list → LLM (RAG/chatbot)" },
  { value: "text_json",   label: "Text (JSON)",          description: "Structured JSON → LLM (headless API agent)" },
];

// ──────────────────────────────────────────────
//  Model Options (Audience)
// ──────────────────────────────────────────────

export type ModelProvider = "anthropic" | "openai";

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  supportsVision: boolean;
}

export const MODELS: ModelOption[] = [
  { id: "gpt-4o",                     label: "GPT-4o",            provider: "openai",    supportsVision: true },
  { id: "gpt-4o-mini",                label: "GPT-4o Mini",       provider: "openai",    supportsVision: true },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic", supportsVision: true },
  { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  provider: "anthropic", supportsVision: true },
];

// ──────────────────────────────────────────────
//  Trial Result — Extended for Paper Quality
// ──────────────────────────────────────────────

export interface ManipulationCheck {
  noticed: boolean;           // Did the agent mention the badge?
  mentionedBadgeType: string; // What type of badge it reported
  mentionedProductId: number; // Which product it associated the badge with
  rawResponse: string;        // Full manipulation check response
}

export interface TrialResult {
  trialId: number;
  condition: Condition;
  promptType: string;
  promptVariant: string;
  inputMode: InputMode;
  model: string;
  // Target
  targetProductId: number;    // ★ Which product was the target this trial
  targetBrand: string;
  targetPosition: number;     // Position of target in shuffled order (1-indexed)
  // Choice
  chosenProduct: string;
  chosenBrand: string;
  chosenPosition: number;     // Position of chosen product (1-indexed)
  chosenProductId: number;
  choseTarget: boolean;
  reasoning: string;
  rawResponse: string;
  // Timing & cost
  latencySec: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
  // Reproducibility
  positionOrder: number[];
  seed: number;               // ★ Deterministic seed
  temperature: number;
  // Manipulation check
  manipulationCheck: ManipulationCheck | null;
}

// ──────────────────────────────────────────────
//  Seeded PRNG — Mulberry32
//  Deterministic shuffle for reproducibility
// ──────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with deterministic seed.
 * Same seed → same permutation (reproducible).
 */
export function shufflePositions(products: Product[], seed: number): Product[] {
  const rng = mulberry32(seed);
  const arr = [...products];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick a random target product using seed.
 * Ensures every product serves as target across trials.
 */
export function pickTargetProduct(seed: number): number {
  const rng = mulberry32(seed + 9999); // offset to decouple from position shuffle
  return PRODUCTS[Math.floor(rng() * PRODUCTS.length)].id;
}

// ──────────────────────────────────────────────
//  Generate Trial Seed
//  Combines trialId with a salt for uniqueness
// ──────────────────────────────────────────────

export function generateSeed(trialId: number, salt: number = 42): number {
  return (trialId * 2654435761 + salt) >>> 0; // Knuth multiplicative hash
}

// ──────────────────────────────────────────────
//  Attribute Perturbation (ACES Table 1)
// ──────────────────────────────────────────────

export interface PerturbedProduct extends Product {
  perturbedPrice: number;
  perturbedRating: number;
  perturbedReviews: number;
}

export function perturbAttributes(products: Product[], seed: number): PerturbedProduct[] {
  const rng = mulberry32(seed + 7777);
  const normalRng = () => {
    const u1 = rng(), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return products.map((p) => {
    const priceFactor = Math.exp(normalRng() * 0.3);
    const alpha = rng() * 0.8 - 0.4;
    const newRating = Math.max(1, Math.min(5, p.rating + alpha * (5 - p.rating)));
    const reviewFactor = Math.exp(normalRng() * 1.0);
    return {
      ...p,
      perturbedPrice: Math.round(p.price * priceFactor * 100) / 100,
      perturbedRating: Math.round(newRating * 10) / 10,
      perturbedReviews: Math.max(1, Math.round(p.reviews * reviewFactor)),
    };
  });
}

// ──────────────────────────────────────────────
//  HTML Mode: DOM structure
// ──────────────────────────────────────────────

export function productsToHTML(
  products: Product[],
  condition: Condition,
  targetProductId: number,
): string {
  const condMeta = CONDITIONS.find((c) => c.value === condition);

  const cards = products.map((p, i) => {
    let badgeHtml = "";
    let descNote = "";

    if (p.id === targetProductId && condition !== "control" && condMeta) {
      const badgeClass = condition.replace("_", "-");
      badgeHtml = `\n    <div class="badge ${badgeClass}">${condMeta.badge}</div>`;
      descNote = `\n      <em class="nudge-cue">${condMeta.descriptionCue}</em>`;
    }

    return `<div class="product-card" data-product-id="${p.id}">
  <img src="${p.image}" alt="${p.brand} ${p.name}" />
  <div class="product-info">
    <span class="brand">${p.brand}</span>
    <h3 class="product-name">${p.name}</h3>${badgeHtml}
    <div class="price">${p.price.toFixed(2)}</div>
    <div class="rating">${"\u2605".repeat(Math.floor(p.rating))}${p.rating % 1 >= 0.5 ? "\u00BD" : ""} ${p.rating} (${p.reviews.toLocaleString()} reviews)</div>
    <div class="tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join(" ")}</div>
    <p class="description">
      A ${p.tags[1]?.toLowerCase() || "facial"} serum by ${p.brand}.${descNote}
    </p>
  </div>
</div>`;
  });

  return `<div class="product-grid">
${cards.join("\n")}
</div>`;
}

// ──────────────────────────────────────────────
//  Text Mode: Headless JSON (ACES Fig. 10)
// ──────────────────────────────────────────────

export function productsToJSON(
  products: Product[],
  condition: Condition,
  targetProductId: number,
): string {
  const condMeta = CONDITIONS.find((c) => c.value === condition);

  const items = products.map((p, i) => {
    const obj: Record<string, any> = {
      product_number: i + 1,
      title: `${p.brand} ${p.name} ${p.volume}`,
      price: p.price,
      rating: p.rating,
      number_of_reviews: p.reviews,
      tags: p.tags.join(", "),
    };

    if (p.id === targetProductId && condition !== "control" && condMeta) {
      obj.badge = condMeta.badge;
      obj.description_note = condMeta.descriptionCue;
      switch (condition) {
        case "scarcity":
          obj.stock_remaining = 3;
          break;
        case "social_proof":
          obj.currently_viewing = 1234;
          break;
        case "urgency":
          obj.deal_countdown = "02:34:15";
          break;
        case "authority":
          obj.certification = "Board-Certified Dermatologist";
          break;
        case "price_anchoring":
          obj.original_price = p.price;
          obj.sale_price = 14.49;
          break;
      }
    }

    return obj;
  });

  return JSON.stringify(items, null, 2);
}

// ──────────────────────────────────────────────
//  Text Mode: Flat readable list
// ──────────────────────────────────────────────

export function productsToFlatText(
  products: Product[],
  condition: Condition,
  targetProductId: number,
): string {
  const condMeta = CONDITIONS.find((c) => c.value === condition);

  const lines = products.map((p, i) => {
    let text = `[Product ${i + 1}] ${p.brand} — ${p.name}
  Volume: ${p.volume} | Price: $${p.price.toFixed(2)} | Rating: ${p.rating}/5 (${p.reviews.toLocaleString()} reviews)
  Tags: ${p.tags.join(", ")}`;

    if (p.id === targetProductId && condition !== "control" && condMeta) {
      text += `\n  ${condMeta.badge}`;
      text += `\n  ${condMeta.descriptionCue}`;
    }

    return text;
  });

  return lines.join("\n\n");
}

// ──────────────────────────────────────────────
//  Cost Estimation (approximate)
// ──────────────────────────────────────────────

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o":                     { input: 0.0025, output: 0.01 },
  "gpt-4o-mini":                { input: 0.00015, output: 0.0006 },
  "claude-sonnet-4-5-20250929": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5-20251001":  { input: 0.0008, output: 0.004 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K[model] ?? { input: 0.003, output: 0.015 };
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}
