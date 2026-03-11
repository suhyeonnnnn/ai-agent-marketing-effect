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
          sort_by: { type: "string", enum: ["recommended", "price_low", "price_high", "rating", "reviews"], description: "Sort order" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "filter_by",
      description: "Filter products by price or rating.",
      parameters: {
        type: "object",
        properties: {
          max_price: { type: "number", description: "Max price (USD)" },
          min_rating: { type: "number", description: "Min rating (1-5)" },
        },
        required: [],
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
          sort_by: { type: "string", enum: ["most_helpful", "most_recent", "highest_rated", "lowest_rated"], description: "How to sort reviews" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "select_product",
      description: "Finalize your purchase decision.",
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
    case "filter_by": return executeFilter(args, ctx);
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

// ── Helper: build badge text ──
function buildBadge(p: Product, ctx: ToolContext): string {
  const cm = ctx.catMarketing;
  switch (ctx.condition) {
    case "scarcity":
      return "Only 3 left in stock — order soon!";
    case "social_proof":
      return cm?.socialProofBadge || "#1 Best Seller";
    case "urgency":
      return "Deal ends in 02:34:15";
    case "authority":
      return cm?.authorityBadge || "Dermatologist Recommended";
    case "price_anchoring": {
      const origPrice = cm?.anchoringOriginalPrice || p.originalPrice;
      const savePct = Math.round((1 - p.price / origPrice) * 100);
      return `Was $${origPrice.toFixed(2)} → Now $${p.price.toFixed(2)} (Save ${savePct}%)`;
    }
    default:
      return "";
  }
}

// ── search ──
function executeSearch(args: Record<string, any>, ctx: ToolContext): string {
  let products = [...ctx.shuffledProducts];
  const sortBy = args.sort_by || "recommended";

  switch (sortBy) {
    case "price_low": products.sort((a, b) => a.price - b.price); break;
    case "price_high": products.sort((a, b) => b.price - a.price); break;
    case "rating": products.sort((a, b) => b.rating - a.rating); break;
    case "reviews": products.sort((a, b) => b.reviews - a.reviews); break;
  }

  const items = products.map((p, i) => buildProductObj(p, i + 1, ctx));

  return JSON.stringify({
    query: args.query,
    total_results: items.length,
    sort_by: sortBy,
    products: items,
  }, null, 2);
}

// ── filter_by ──
function executeFilter(args: Record<string, any>, ctx: ToolContext): string {
  let products = [...ctx.shuffledProducts];
  const filters: string[] = [];

  if (args.max_price != null) {
    products = products.filter((p) => p.price <= args.max_price);
    filters.push(`price ≤ $${args.max_price}`);
  }
  if (args.min_rating != null) {
    products = products.filter((p) => p.rating >= args.min_rating);
    filters.push(`rating ≥ ${args.min_rating}`);
  }

  const items = products.map((p, i) => buildProductObj(p, i + 1, ctx));

  return JSON.stringify({
    filters_applied: filters,
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
  // view_product returns same fields — no extra description/ingredients
  delete obj.position;

  return JSON.stringify(obj, null, 2);
}

// ── read_reviews ──
function executeReadReviews(args: Record<string, any>, ctx: ToolContext): string {
  const reviews = PRODUCT_REVIEWS[args.product_id];
  if (!reviews) return JSON.stringify({ error: "No reviews found", product_id: args.product_id });

  const product = ctx.shuffledProducts.find((p) => p.id === args.product_id)
    || PRODUCTS.find((p) => p.id === args.product_id);

  let sorted = [...reviews];
  switch (args.sort_by) {
    case "highest_rated": sorted.sort((a, b) => b.rating - a.rating); break;
    case "lowest_rated": sorted.sort((a, b) => a.rating - b.rating); break;
    default: sorted.sort((a, b) => b.helpful - a.helpful); break;
  }

  // ★ No marketing badge in reviews
  return JSON.stringify({
    product_id: args.product_id,
    brand: product?.brand,
    average_rating: product?.rating,
    total_reviews: product?.reviews,
    showing: sorted.length,
    reviews: sorted.map((r) => ({
      author: r.author,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verified_purchase: r.verified,
      helpful_votes: r.helpful,
    })),
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
