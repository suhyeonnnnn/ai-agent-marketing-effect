import { NextRequest, NextResponse } from "next/server";
import { executeTool, type ToolContext } from "@/lib/tools";
import { CATEGORIES } from "@/lib/categories";
import { type Condition, type InputMode } from "@/lib/products";

export async function POST(req: NextRequest) {
  const { category, condition, page, targetProductId, inputMode } = await req.json();

  const cat = CATEGORIES[category as keyof typeof CATEGORIES];
  if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const ctx: ToolContext = {
    condition: condition as Condition,
    targetProductId: targetProductId || 2,
    shuffledProducts: cat.products as any,
    seed: 42,
    nudgeSurfaces: ["search", "detail"],
    inputMode: (inputMode || "html") as InputMode,
    categoryId: category,
    catMarketing: cat.marketing,
  };

  let html = "";
  switch (page) {
    case "search":
      html = executeTool("search", { query: cat.label }, ctx);
      break;
    case "detail":
      html = executeTool("view_product", { product_id: targetProductId || 2 }, ctx);
      break;
    case "reviews":
      html = executeTool("read_reviews", { product_id: targetProductId || 2 }, ctx);
      break;
    default:
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  return NextResponse.json({ html });
}
