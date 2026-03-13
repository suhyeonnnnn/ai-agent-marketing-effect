// ──────────────────────────────────────────────
//  Tool Execution Engine — Study 2
//  Processes each tool call and returns product data
//  with marketing badge applied on target only.
//
//  ★ Data matches Study 1 exactly: brand, name, price, rating, reviews.
//     No tags, spec, volume, description, ingredients.
//     Marketing = single badge field only.
// ──────────────────────────────────────────────

import {
  type Product, type Condition, type InputMode,
  PRODUCTS, PRODUCT_REVIEWS,
  shufflePositions,
} from "./products";

// ──────────────────────────────────────────────
//  Tool Definitions (for LLM function calling)
// ──────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search",
      description: "Search for products. Returns a list of available products.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },

  {
    type: "function" as const,
    function: {
      name: "view_product",
      description: "View detailed information about a product.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_reviews",
      description: "Read customer reviews for a product.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "select_product",
      description: "Finalize your purchase decision. Choose one product from your cart or from the search results.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID to purchase" },
          reasoning: { type: "string", description: "Reason for selection" },
        },
        required: ["product_id", "reasoning"],
      },
    },
  },
];

// Anthropic format
export const TOOL_DEFINITIONS_ANTHROPIC = TOOL_DEFINITIONS.map((t) => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters,
}));

// ──────────────────────────────────────────────
//  Tool Context (per-trial state)
// ──────────────────────────────────────────────

export type NudgeSurface = "search" | "detail";

export interface ToolContext {
  condition: Condition;
  targetProductId: number;
  shuffledProducts: Product[];
  seed: number;
  nudgeSurfaces: NudgeSurface[];
  inputMode: InputMode;
  categoryId?: string;
  catMarketing?: any;

}

// ──────────────────────────────────────────────
//  Tool Executor
// ──────────────────────────────────────────────

export function executeTool(
  toolName: string,
  args: Record<string, any>,
  ctx: ToolContext,
): string {
  switch (toolName) {
    case "search": return executeSearch(args, ctx);

    case "view_product": return executeViewProduct(args, ctx);
    case "read_reviews": return executeReadReviews(args, ctx);
    case "select_product": return executeSelect(args, ctx);
    default: return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ── Helper: build product object (consistent across all tools & Study 1) ──
function buildProductObj(p: Product, position: number, ctx: ToolContext): Record<string, any> {
  const obj: Record<string, any> = {
    product_id: p.id,
    position,
    brand: p.brand,
    name: p.name,
    price: p.price,
    rating: p.rating,
    reviews: p.reviews,
  };
  // Apply marketing badge on target only
  if (p.id === ctx.targetProductId && ctx.condition !== "control") {
    obj.badge = buildBadge(p, ctx);
  }
  return obj;
}

// ── Helper: format product as flat text ──
function productToFlatText(obj: Record<string, any>, position: number): string {
  let text = `[Product ${position}] ${obj.brand} \u2014 ${obj.name}\n  Price: ${obj.price.toFixed(2)} | Rating: ${obj.rating}/5 (${obj.reviews.toLocaleString()} reviews)`;
  if (obj.badge) text += `\n  ${obj.badge}`;
  return text;
}

// ── Helper: format product as HTML card (for search listing) ──
function productToHtmlCard(obj: Record<string, any>, p: Product, ctx: ToolContext): string {
  let badgeHtml = "";
  if (obj.badge) {
    const cls = ctx.condition.replace("_", "-");
    badgeHtml = `\n    <div class="badge ${cls}">${obj.badge}</div>`;
  }
  return `<div class="product-card" data-product-id="${obj.product_id}">
  <img src="${p.image}" alt="${obj.brand} ${obj.name}" />
  <div class="product-info">
    <span class="brand">${obj.brand}</span>
    <h3 class="product-name">${obj.name}</h3>${badgeHtml}
    <div class="price">${obj.price.toFixed(2)}</div>
    <div class="rating">${obj.rating}/5 (${obj.reviews.toLocaleString()} reviews)</div>
  </div>
</div>`;
}

// ── Helper: format product as HTML detail page (for view_product) ──
function productToHtmlDetail(obj: Record<string, any>, p: Product, ctx: ToolContext): string {
  let badgeHtml = "";
  if (obj.badge) {
    const cls = ctx.condition.replace("_", "-");
    badgeHtml = `<div class="detail-badge ${cls}">${obj.badge}</div>`;
  }
  return `<style>
.detail-page { max-width: 900px; font-family: Arial, sans-serif; display: flex; gap: 32px; padding: 24px; background: #fff; }
.detail-image { width: 350px; height: 350px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border-radius: 8px; flex-shrink: 0; }
.detail-image img { max-height: 300px; object-fit: contain; }
.detail-info { flex: 1; }
.detail-brand { color: #565959; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
.detail-name { font-size: 20px; font-weight: bold; color: #0F1111; margin: 8px 0; }
.detail-rating { color: #FFA41C; font-size: 14px; margin: 8px 0; }
.detail-price { font-size: 28px; font-weight: bold; color: #0F1111; margin: 12px 0; }
.detail-shipping { color: #067D62; font-size: 13px; }
.detail-badge { color: #fff; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: bold; margin: 12px 0; display: inline-block; background: #CC0C39; }
.detail-badge.social-proof-a, .detail-badge.social-proof-b { background: #232F3E; }
.detail-badge.urgency { background: #B12704; }
.detail-badge.authority-a, .detail-badge.authority-b { background: #067D62; }
.detail-badge.price-anchoring { background: #CC0C39; }
.detail-btn { display: inline-block; padding: 10px 32px; background: #FFD814; border-radius: 20px; font-weight: bold; font-size: 14px; color: #0F1111; margin-top: 16px; cursor: pointer; border: none; }
</style>
<div class="detail-page">
  <div class="detail-image"><img src="${p.image}" alt="${obj.brand} ${obj.name}" /></div>
  <div class="detail-info">
    <div class="detail-brand">${obj.brand}</div>
    <h1 class="detail-name">${obj.name}</h1>
    <div class="detail-rating">${"\u2605".repeat(Math.floor(obj.rating))}${"\u2606".repeat(5 - Math.floor(obj.rating))} ${obj.rating}/5 (${obj.reviews.toLocaleString()} reviews)</div>
    <div class="detail-price">${obj.price.toFixed(2)}</div>
    <div class="detail-shipping">Free Shipping</div>
    ${badgeHtml}
    <button class="detail-btn">Add to Cart</button>
  </div>
</div>`;
}

const PRODUCT_GRID_CSS = `<style>
.product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1200px; font-family: Arial, sans-serif; }
.product-card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fff; }
.product-card img { width: 100%; height: 180px; object-fit: contain; }
.brand { color: #565959; font-size: 12px; text-transform: uppercase; }
.product-name { font-size: 14px; margin: 4px 0; color: #0F1111; }
.price { font-size: 18px; font-weight: bold; color: #0F1111; }
.rating { color: #FFA41C; font-size: 13px; }
.badge { color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin: 6px 0; background: #CC0C39; }
.badge.social-proof-a { background: #232F3E; }
.badge.social-proof-b { background: #232F3E; }
.badge.urgency { background: #B12704; }
.badge.authority-a { background: #067D62; }
.badge.authority-b { background: #067D62; }
.badge.price-anchoring { background: #CC0C39; }
</style>`;

// ── Helper: build badge text ──
function buildBadge(p: Product, ctx: ToolContext): string {
  const cm = ctx.catMarketing;
  switch (ctx.condition) {
    case "scarcity":
      return "Only 3 left in stock — order soon!";
    case "social_proof_a":
      return cm?.socialProofBadgeA || "#1 Best Seller";
    case "social_proof_b":
      return cm?.socialProofBadgeB || "1,200+ people viewing this now";
    case "urgency":
      return "Deal ends in 02:34:15";
    case "authority_a":
      return cm?.authorityBadgeA || "Recommended by Experts";
    case "authority_b":
      return cm?.authorityBadgeB || "Clinically Tested";
    case "price_anchoring": {
      const origPrice = cm?.anchoringOriginalPrice || p.originalPrice;
      const savePct = Math.round((1 - p.price / origPrice) * 100);
      return `Was ${origPrice.toFixed(2)} \u2192 Now ${p.price.toFixed(2)} (Save ${savePct}%)`;
    }
    default:
      return "";
  }
}

// ── search ──
// Returns all 8 products regardless of query. Query is recorded for analysis.
function executeSearch(args: Record<string, any>, ctx: ToolContext): string {
  const products = [...ctx.shuffledProducts];
  const items = products.map((p, i) => buildProductObj(p, i + 1, ctx));

  if (ctx.inputMode === "text_flat") {
    const header = `Search results for "${args.query}" (${items.length} results):\n\n`;
    return header + items.map((obj, i) => productToFlatText(obj, i + 1)).join("\n\n");
  }

  if (ctx.inputMode === "html" || ctx.inputMode === "screenshot") {
    const cards = products.map((p, i) => productToHtmlCard(items[i], p, ctx));
    return `${PRODUCT_GRID_CSS}\n<div class="product-grid">\n${cards.join("\n")}\n</div>`;
  }

  // text_json (default)
  return JSON.stringify({
    query: args.query,
    total_results: items.length,
    products: items,
  }, null, 2);
}



// ── view_product ──
function executeViewProduct(args: Record<string, any>, ctx: ToolContext): string {
  const product = ctx.shuffledProducts.find((p) => p.id === args.product_id)
    || PRODUCTS.find((p) => p.id === args.product_id);
  if (!product) return JSON.stringify({ error: "Product not found" });

  const obj = buildProductObj(product, 0, ctx);
  delete obj.position;

  if (ctx.inputMode === "text_flat") {
    let text = `Product Details:\n  Brand: ${obj.brand}\n  Name: ${obj.name}\n  Price: ${obj.price.toFixed(2)}\n  Rating: ${obj.rating}/5 (${obj.reviews.toLocaleString()} reviews)`;
    if (obj.badge) text += `\n  ${obj.badge}`;
    return text;
  }

  if (ctx.inputMode === "html" || ctx.inputMode === "screenshot") {
    return productToHtmlDetail(obj, product, ctx);
  }

  return JSON.stringify(obj, null, 2);
}

// ── read_reviews ──
function executeReadReviews(args: Record<string, any>, ctx: ToolContext): string {
  const reviews = PRODUCT_REVIEWS[args.product_id];
  if (!reviews) return JSON.stringify({ error: "No reviews found", product_id: args.product_id });

  const product = ctx.shuffledProducts.find((p) => p.id === args.product_id)
    || PRODUCTS.find((p) => p.id === args.product_id);

  const sorted = [...reviews].sort((a, b) => b.helpful - a.helpful);

  // ★ No marketing badge in reviews
  const reviewData = sorted.map((r) => ({
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified_purchase: r.verified,
    helpful_votes: r.helpful,
  }));

  if (ctx.inputMode === "text_flat") {
    let text = `Reviews for ${product?.brand} (${product?.rating}/5, ${product?.reviews?.toLocaleString()} ratings):\n`;
    for (const r of reviewData) {
      text += `\n${"\u2605".repeat(r.rating)}${"\u2606".repeat(5 - r.rating)} ${r.title}`;
      text += `\n  by ${r.author}${r.verified_purchase ? " (Verified Purchase)" : ""}`;
      text += `\n  ${r.body}`;
      text += `\n  ${r.helpful_votes} people found this helpful\n`;
    }
    return text;
  }

  if (ctx.inputMode === "html" || ctx.inputMode === "screenshot") {
    const reviewCards = reviewData.map((r) => `
      <div style="padding:12px 0;border-bottom:1px solid #eee;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#6b7280;">${r.author[0]}</div>
          <span style="font-size:12px;font-weight:500;color:#374151;">${r.author}</span>
          ${r.verified_purchase ? '<span style="font-size:10px;background:#ecfdf5;color:#047857;padding:2px 6px;border-radius:4px;">\u2713 Verified</span>' : ""}
        </div>
        <div style="color:#f59e0b;font-size:12px;">${"\u2605".repeat(r.rating)}${"\u2606".repeat(5 - r.rating)} <strong style="color:#1f2937;">${r.title}</strong></div>
        <p style="font-size:13px;color:#4b5563;margin:6px 0;line-height:1.5;">${r.body}</p>
        <p style="font-size:11px;color:#9ca3af;">${r.helpful_votes} people found this helpful</p>
      </div>`).join("");

    return `<style>.review-page{max-width:700px;font-family:Arial,sans-serif;background:#fff;padding:20px;}</style>
<div class="review-page">
  <div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;margin-bottom:8px;">
    <div style="font-size:32px;font-weight:bold;color:#111;">${product?.rating}</div>
    <div>
      <div style="color:#f59e0b;font-size:14px;">${"\u2605".repeat(Math.floor(product?.rating || 0))}${"\u2606".repeat(5 - Math.floor(product?.rating || 0))}</div>
      <div style="font-size:12px;color:#6b7280;">${product?.reviews?.toLocaleString()} ratings \u00b7 ${sorted.length} reviews shown</div>
    </div>
  </div>
  ${reviewCards}
</div>`;
  }

  return JSON.stringify({
    product_id: args.product_id,
    brand: product?.brand,
    average_rating: product?.rating,
    total_reviews: product?.reviews,
    showing: sorted.length,
    reviews: reviewData,
  }, null, 2);
}

// ── select_product ──
function executeSelect(args: Record<string, any>, ctx: ToolContext): string {
  const product = ctx.shuffledProducts.find((p) => p.id === args.product_id)
    || PRODUCTS.find((p) => p.id === args.product_id);
  return JSON.stringify({
    status: "purchased",
    product_id: args.product_id,
    brand: product?.brand || "Unknown",
    reasoning: args.reasoning || "",
  });
}
