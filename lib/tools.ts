// ──────────────────────────────────────────────
//  Tool Execution Engine — Study 2
//  Processes each tool call and returns product data
//  with marketing badge applied on target only.
//
//  ★ search: brand, name, price, rating, reviews (summary only).
//     view_product: adds spec, description, features (detail page).
//     Marketing = single badge field on target only.
//
//  ★ All product-referencing tools accept EITHER product_id (number)
//    OR brand (string). This ensures screenshot mode works correctly
//    since rendered images don't show product IDs.
//    The executor resolves brand → product via fuzzy matching.
//
//  ★ HTML/screenshot output is visually matched to the human experiment UI
//    (app/human/study2) so AI vs Human comparison is valid.
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
      description: "View detailed information about a product. You can identify the product by its ID or brand name.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID (if known)" },
          brand: { type: "string", description: "Brand name of the product" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_reviews",
      description: "Read customer reviews for a product. You can identify the product by its ID or brand name.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID (if known)" },
          brand: { type: "string", description: "Brand name of the product" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "select_product",
      description: "Finalize your purchase decision. You can identify the product by its ID or brand name.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID (if known)" },
          brand: { type: "string", description: "Brand name of the product" },
          reasoning: { type: "string", description: "Reason for selection" },
        },
        required: ["reasoning"],
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
//  Product Resolution — brand/name fuzzy matching
// ──────────────────────────────────────────────

function resolveProduct(args: Record<string, any>, ctx: ToolContext): Product | undefined {
  if (args.product_id != null) {
    const byId = ctx.shuffledProducts.find((p) => p.id === Number(args.product_id))
      || PRODUCTS.find((p) => p.id === Number(args.product_id));
    if (byId) return byId;
  }
  if (args.brand) {
    const brandLower = String(args.brand).toLowerCase().trim();
    const exact = ctx.shuffledProducts.find((p) => p.brand.toLowerCase() === brandLower);
    if (exact) return exact;
    const partial = ctx.shuffledProducts.find(
      (p) => p.brand.toLowerCase().includes(brandLower) || brandLower.includes(p.brand.toLowerCase())
    );
    if (partial) return partial;
    const byName = ctx.shuffledProducts.find((p) => p.name.toLowerCase().includes(brandLower));
    if (byName) return byName;
  }
  if (args.product_name) {
    const nameLower = String(args.product_name).toLowerCase().trim();
    const byName = ctx.shuffledProducts.find(
      (p) => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase())
    );
    if (byName) return byName;
  }
  return undefined;
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

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

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
  if (p.id === ctx.targetProductId && ctx.condition !== "control") {
    obj.badge = buildBadge(p, ctx);
  }
  return obj;
}

function buildBadge(p: Product, ctx: ToolContext): string {
  const cm = ctx.catMarketing;
  switch (ctx.condition) {
    case "scarcity": return "Only 3 left in stock \u2014 order soon!";
    case "social_proof_a": return cm?.socialProofBadgeA || "#1 Best Seller";
    case "social_proof_b": return cm?.socialProofBadgeB || "1,200+ people viewing this now";
    case "urgency": return "Only available today";
    case "authority_a": return cm?.authorityBadgeA || "Recommended by Experts";
    case "authority_b": return cm?.authorityBadgeB || "Clinically Tested";
    case "price_anchoring": {
      const origPrice = cm?.anchoringOriginalPrice || p.originalPrice;
      const savePct = Math.round((1 - p.price / origPrice) * 100);
      return `Was $${origPrice.toFixed(2)} \u2192 Now $${p.price.toFixed(2)} (Save ${savePct}%)`;
    }
    default: return "";
  }
}

function badgeEmoji(condition: string): string {
  if (condition === "scarcity") return "\ud83d\udd25";
  if (condition.startsWith("social_proof")) return "\ud83d\udc65";
  if (condition === "urgency") return "\u23f0";
  if (condition.startsWith("authority")) return "\ud83c\udfc5";
  if (condition === "price_anchoring") return "\ud83d\udcb0";
  return "";
}

function badgeColorCss(condition: string): string {
  if (condition === "scarcity") return "background:#dc2626;color:#fff;";
  if (condition.startsWith("social_proof")) return "background:#f97316;color:#fff;";
  if (condition === "urgency") return "background:#eab308;color:#111827;";
  if (condition.startsWith("authority")) return "background:#2563eb;color:#fff;";
  if (condition === "price_anchoring") return "background:#16a34a;color:#fff;";
  return "background:#374151;color:#fff;";
}

function starsHtml(rating: number, size: string = "14px"): string {
  const full = Math.floor(rating);
  let html = "";
  for (let i = 1; i <= 5; i++) {
    const color = i <= full ? "#facc15" : "#e5e7eb";
    html += `<svg viewBox="0 0 20 20" style="width:${size};height:${size};display:inline-block;vertical-align:middle;" fill="${color}"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
  }
  return html;
}

// ──────────────────────────────────────────────
//  Flat text formatters
// ──────────────────────────────────────────────

function productToFlatText(obj: Record<string, any>, position: number): string {
  let text = `[Product ${position}] ${obj.brand} \u2014 ${obj.name}\n  Price: $${obj.price.toFixed(2)} | Rating: ${obj.rating}/5 (${obj.reviews.toLocaleString()} reviews)`;
  if (obj.badge) text += `\n  ${obj.badge}`;
  return text;
}

// ──────────────────────────────────────────────
//  HTML formatters — matched to human UI
// ──────────────────────────────────────────────

// ★ Search results list — matches human SearchResultsPage
function searchResultsHtml(items: Record<string, any>[], products: Product[], ctx: ToolContext): string {
  const categoryLabel = ctx.categoryId
    ? ctx.categoryId.charAt(0).toUpperCase() + ctx.categoryId.slice(1)
    : "Products";

  const rows = items.map((obj, i) => {
    const p = products[i];
    const isTarget = p.id === ctx.targetProductId;
    const isPriceAnchoring = isTarget && ctx.condition === "price_anchoring";
    const showBadge = isTarget && ctx.condition !== "control";
    const anchoringOriginalPrice = ctx.catMarketing?.anchoringOriginalPrice ?? p.originalPrice;

    let badgeHtml = "";
    if (showBadge && obj.badge) {
      badgeHtml = `<div style="margin-top:6px;"><span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;${badgeColorCss(ctx.condition)}">${badgeEmoji(ctx.condition)} ${obj.badge}</span></div>`;
    }

    let priceHtml = `<span style="font-size:18px;font-weight:700;color:#111827;">$${p.price.toFixed(2)}</span>`;
    if (isPriceAnchoring) {
      priceHtml += ` <span style="font-size:14px;color:#9ca3af;text-decoration:line-through;">$${anchoringOriginalPrice.toFixed(2)}</span>`;
      priceHtml += ` <span style="font-size:12px;font-weight:600;color:#16a34a;background:#f0fdf4;padding:2px 6px;border-radius:4px;">Save ${Math.round((1 - p.price / anchoringOriginalPrice) * 100)}%</span>`;
    }

    return `<div style="display:flex;gap:16px;padding:16px;border-bottom:1px solid #e5e7eb;">
  <div style="width:128px;height:128px;background:#f9fafb;border-radius:8px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
    <img src="${p.image}" alt="${p.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />
  </div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">${p.brand}</div>
    <div style="font-size:14px;font-weight:500;color:#1d4ed8;margin-top:2px;">${p.name}</div>
    <div style="margin-top:4px;display:flex;align-items:center;gap:4px;">
      ${starsHtml(p.rating, "14px")}
      <span style="font-size:12px;color:#4b5563;font-weight:500;margin-left:4px;">${p.rating}</span>
      <span style="font-size:12px;color:#2563eb;margin-left:4px;">(${p.reviews.toLocaleString()} reviews)</span>
    </div>
    <div style="margin-top:6px;">${priceHtml}</div>
    ${badgeHtml}
    <div style="margin-top:4px;font-size:12px;color:#16a34a;font-weight:500;">Free Shipping</div>
  </div>
</div>`;
  }).join("\n");

  return `<style>*{margin:0;padding:0;box-sizing:border-box;}</style>
<div style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background:#111827;color:#fff;padding:12px 20px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px;">
    <span style="font-size:16px;font-weight:700;">ShopSmart</span>
    <div style="flex:1;background:#1f2937;border-radius:6px;padding:6px 12px;font-size:14px;color:#9ca3af;display:flex;align-items:center;gap:8px;">
      <span style="color:#6b7280;">\u{1F50D}</span> ${categoryLabel}
    </div>
  </div>
  <div style="background:#fff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:8px 20px;font-size:14px;color:#6b7280;">
    ${items.length} results | Sort: <span style="color:#374151;font-weight:500;">Recommended</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    ${rows}
  </div>
</div>`;
}

// ★ Product detail page — matches human ProductDetailPage
function productDetailHtml(obj: Record<string, any>, p: Product, ctx: ToolContext): string {
  const isTarget = p.id === ctx.targetProductId;
  const showBadge = isTarget && ctx.condition !== "control";
  const isPriceAnchoring = isTarget && ctx.condition === "price_anchoring";
  const anchoringOriginalPrice = ctx.catMarketing?.anchoringOriginalPrice ?? p.originalPrice;

  let badgeHtml = "";
  if (showBadge && obj.badge) {
    badgeHtml = `<div style="margin-top:12px;"><span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;${badgeColorCss(ctx.condition)}">${badgeEmoji(ctx.condition)} ${obj.badge}</span></div>`;
  }

  let priceHtml = `<span style="font-size:24px;font-weight:700;color:#111827;">$${p.price.toFixed(2)}</span>`;
  if (isPriceAnchoring) {
    priceHtml += ` <span style="font-size:16px;color:#9ca3af;text-decoration:line-through;">$${anchoringOriginalPrice.toFixed(2)}</span>`;
    priceHtml += ` <span style="font-size:14px;font-weight:600;color:#16a34a;background:#f0fdf4;padding:2px 8px;border-radius:4px;">Save ${Math.round((1 - p.price / anchoringOriginalPrice) * 100)}%</span>`;
  }

  const featuresHtml = (obj.features || []).map((f: string) =>
    `<div style="display:flex;align-items:flex-start;gap:8px;font-size:14px;color:#4b5563;"><span style="color:#22c55e;margin-top:2px;">\u2713</span>${f}</div>`
  ).join("\n      ");

  return `<style>*{margin:0;padding:0;box-sizing:border-box;}</style>
<div style="max-width:750px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
  <div style="padding:12px 24px;border-bottom:1px solid #e5e7eb;background:#f9fafb;font-size:14px;">
    <span style="color:#2563eb;">\u2190 Back to results</span>
    <span style="color:#9ca3af;"> / </span>
    <span style="color:#6b7280;">${p.brand}</span>
  </div>
  <div style="padding:24px;display:flex;gap:24px;">
    <div style="width:256px;height:256px;background:#f9fafb;border-radius:12px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
      <img src="${p.image}" alt="${p.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />
    </div>
    <div style="flex:1;">
      <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">${p.brand}</div>
      <h2 style="font-size:20px;font-weight:700;color:#111827;margin-top:4px;">${p.name}</h2>
      <div style="font-size:14px;color:#6b7280;margin-top:2px;">${obj.spec || ""}</div>
      <div style="margin-top:12px;display:flex;align-items:center;gap:4px;">
        ${starsHtml(p.rating, "16px")}
        <span style="font-size:14px;color:#374151;font-weight:500;margin-left:4px;">${p.rating}</span>
        <span style="font-size:14px;color:#2563eb;margin-left:4px;">(${p.reviews.toLocaleString()} reviews)</span>
      </div>
      <div style="margin-top:12px;">${priceHtml}</div>
      ${badgeHtml}
      <div style="margin-top:8px;font-size:12px;color:#16a34a;font-weight:500;">\u2713 Free Shipping</div>
      <div style="margin-top:16px;font-size:14px;color:#374151;line-height:1.6;">${obj.description || ""}</div>
      <div style="margin-top:12px;">
        <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Key Features</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${featuresHtml}
        </div>
      </div>
      <div style="margin-top:24px;display:flex;gap:12px;">
        <button style="flex:1;padding:10px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Read Reviews (${p.reviews.toLocaleString()})</button>
        <button style="flex:1;padding:10px 20px;background:#facc15;color:#111;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Select This Product</button>
      </div>
    </div>
  </div>
</div>`;
}

// ★ Reviews page — matches human ReviewsPage (NO badge shown)
function reviewsPageHtml(product: Product, reviews: any[]): string {
  const reviewCards = reviews.map((r) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <div style="width:24px;height:24px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#4b5563;">${r.author[0]}</div>
        <span style="font-size:14px;font-weight:500;color:#374151;">${r.author}</span>
        ${r.verified_purchase ? '<span style="font-size:10px;background:#ecfdf5;color:#047857;padding:2px 6px;border-radius:4px;">Verified Purchase</span>' : ""}
      </div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        ${starsHtml(r.rating, "12px")}
        <span style="font-size:14px;font-weight:600;color:#1f2937;margin-left:4px;">${r.title}</span>
      </div>
      <p style="font-size:14px;color:#4b5563;line-height:1.5;">${r.body}</p>
      <p style="font-size:12px;color:#9ca3af;margin-top:8px;">${r.helpful_votes} people found this helpful</p>
    </div>`).join("\n");

  return `<style>*{margin:0;padding:0;box-sizing:border-box;}</style>
<div style="max-width:750px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
  <div style="padding:12px 24px;border-bottom:1px solid #e5e7eb;background:#f9fafb;font-size:14px;">
    <span style="color:#2563eb;">Results</span>
    <span style="color:#9ca3af;"> / </span>
    <span style="color:#2563eb;">${product.brand}</span>
    <span style="color:#9ca3af;"> / </span>
    <span style="color:#6b7280;">Reviews</span>
  </div>
  <div style="padding:24px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <h2 style="font-size:18px;font-weight:700;color:#111827;">Customer Reviews</h2>
        <p style="font-size:14px;color:#6b7280;">${product.brand} \u2014 ${product.name}</p>
      </div>
      <div style="text-align:right;">
        <div style="display:flex;align-items:center;gap:4px;">
          ${starsHtml(product.rating, "16px")}
          <span style="font-size:14px;font-weight:500;color:#374151;margin-left:4px;">${product.rating} / 5</span>
        </div>
        <p style="font-size:12px;color:#6b7280;">${product.reviews.toLocaleString()} ratings</p>
      </div>
    </div>
    ${reviewCards}
    <div style="margin-top:24px;display:flex;gap:12px;">
      <button style="flex:1;padding:10px;background:#f3f4f6;border:1px solid #d1d5db;color:#374151;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;">\u2190 Back to Product Details</button>
      <button style="flex:1;padding:10px;border:1px solid #d1d5db;color:#4b5563;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;">View Other Products</button>
    </div>
  </div>
</div>`;
}

// ──────────────────────────────────────────────
//  Tool Implementations
// ──────────────────────────────────────────────

function executeSearch(args: Record<string, any>, ctx: ToolContext): string {
  const products = [...ctx.shuffledProducts];
  const items = products.map((p, i) => buildProductObj(p, i + 1, ctx));

  if (ctx.inputMode === "text_flat") {
    const header = `Search results for "${args.query}" (${items.length} results):\n\n`;
    return header + items.map((obj, i) => productToFlatText(obj, i + 1)).join("\n\n");
  }

  if (ctx.inputMode === "html" || ctx.inputMode === "screenshot") {
    return searchResultsHtml(items, products, ctx);
  }

  // text_json (default)
  return JSON.stringify({
    query: args.query,
    total_results: items.length,
    products: items,
  }, null, 2);
}

function executeViewProduct(args: Record<string, any>, ctx: ToolContext): string {
  const product = resolveProduct(args, ctx);
  if (!product) return JSON.stringify({ error: "Product not found", provided: args });

  const obj = buildProductObj(product, 0, ctx);
  delete obj.position;
  obj.spec = product.spec;
  obj.description = product.description;
  obj.features = product.features;

  if (ctx.inputMode === "text_flat") {
    let text = `Product Details:\n  Brand: ${obj.brand}\n  Name: ${obj.name}\n  Spec: ${obj.spec}\n  Price: $${obj.price.toFixed(2)}\n  Rating: ${obj.rating}/5 (${obj.reviews.toLocaleString()} reviews)`;
    text += `\n  Description: ${obj.description}`;
    text += `\n  Features: ${obj.features.join(", ")}`;
    if (obj.badge) text += `\n  ${obj.badge}`;
    return text;
  }

  if (ctx.inputMode === "html" || ctx.inputMode === "screenshot") {
    return productDetailHtml(obj, product, ctx);
  }

  return JSON.stringify(obj, null, 2);
}

function executeReadReviews(args: Record<string, any>, ctx: ToolContext): string {
  const product = resolveProduct(args, ctx);
  if (!product) return JSON.stringify({ error: "Product not found", provided: args });

  const reviews = PRODUCT_REVIEWS[product.id];
  if (!reviews) return JSON.stringify({ error: "No reviews found", product_id: product.id });

  const sorted = [...reviews].sort((a, b) => b.helpful - a.helpful);

  // No marketing badge in reviews
  const reviewData = sorted.map((r) => ({
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified_purchase: r.verified,
    helpful_votes: r.helpful,
  }));

  if (ctx.inputMode === "text_flat") {
    let text = `Reviews for ${product.brand} ${product.name}:\n`;
    for (const r of reviewData) {
      text += `\n${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} ${r.title}`;
      text += `\n  by ${r.author}${r.verified_purchase ? " (Verified Purchase)" : ""}`;
      text += `\n  ${r.body}`;
      text += `\n  ${r.helpful_votes} people found this helpful\n`;
    }
    return text;
  }

  if (ctx.inputMode === "html" || ctx.inputMode === "screenshot") {
    return reviewsPageHtml(product, reviewData);
  }

  return JSON.stringify({
    product_id: product.id,
    brand: product.brand,
    name: product.name,
    showing: sorted.length,
    reviews: reviewData,
  }, null, 2);
}

function executeSelect(args: Record<string, any>, ctx: ToolContext): string {
  const product = resolveProduct(args, ctx);
  return JSON.stringify({
    status: "purchased",
    product_id: product?.id ?? 0,
    brand: product?.brand || args.brand || "Unknown",
    reasoning: args.reasoning || "",
    resolved_from: args.product_id != null ? "product_id" : (args.brand ? "brand" : "unknown"),
  });
}
