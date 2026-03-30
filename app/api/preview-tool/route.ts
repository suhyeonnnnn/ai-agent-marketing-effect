import { NextRequest, NextResponse } from "next/server";
import { executeTool, type ToolContext } from "@/lib/tools";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { type Condition, shufflePositions } from "@/lib/products";

/**
 * GET /api/preview-tool?tool=search&condition=scarcity&category=serum&seed=42
 * Returns rendered HTML that the agent would see in screenshot/html mode.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tool = params.get("tool") || "search";
  const condition = (params.get("condition") || "control") as Condition;
  const categoryId = (params.get("category") || "serum") as CategoryId;
  const seed = parseInt(params.get("seed") || "42");
  const productId = parseInt(params.get("product_id") || "1");

  const cat = CATEGORIES[categoryId];
  if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  // Shuffle products with seed (same as experiment)
  const shuffled = shufflePositions(cat.products as any, seed);

  // Pick target: first product in shuffled order
  const targetProductId = shuffled[Math.floor((seed * 2654435761 >>> 0) / 4294967296 * shuffled.length)]?.id || shuffled[0].id;

  const ctx: ToolContext = {
    condition,
    targetProductId,
    shuffledProducts: shuffled as any,
    seed,
    nudgeSurfaces: ["search", "detail"],
    inputMode: "screenshot",
    categoryId,
    catMarketing: cat.marketing,
  };

  let html = "";
  switch (tool) {
    case "search":
      html = executeTool("search", { query: cat.label }, ctx);
      break;
    case "view_product":
      html = executeTool("view_product", { product_id: productId }, ctx);
      break;
    case "read_reviews":
      html = executeTool("read_reviews", { product_id: productId }, ctx);
      break;
    default:
      return NextResponse.json({ error: "Invalid tool" }, { status: 400 });
  }

  // Wrap in full HTML page for rendering
  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style>
</head><body>${html}</body></html>`;

  return new NextResponse(fullHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
