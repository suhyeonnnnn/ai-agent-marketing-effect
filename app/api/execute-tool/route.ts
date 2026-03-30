import { NextRequest, NextResponse } from "next/server";
import { executeTool, type ToolContext, type NudgeSurface } from "@/lib/tools";
import { PRODUCTS, shufflePositions, pickTargetProduct, generateSeed } from "@/lib/products";
import type { InputMode, Condition } from "@/lib/products";
import fs from "fs";
import path from "path";

// Same resolveLocalImages as agent.ts — this IS the experiment code path
function resolveLocalImages(html: string): string {
  const publicDir = path.join(process.cwd(), "public");
  return html.replace(/src="(\/images\/[^"]+)"/g, (match: string, p1: string) => {
    const absPath = path.join(publicDir, p1);
    try {
      const buf = fs.readFileSync(absPath);
      const b64 = buf.toString("base64");
      return `src="data:image/jpeg;base64,${b64}"`;
    } catch {
      return match;
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    categoryId = "serum",
    condition = "control",
    inputMode = "html",
    toolName,
    toolArgs,
    seed = 12345,
    targetProductId: overrideTarget,
  } = body;

  // Load category products
  let categoryProducts: any[];
  let catMarketing: any;
  try {
    const { CATEGORIES } = await import("@/lib/categories");
    const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    categoryProducts = cat ? cat.products.map((cp: any) => ({ ...cp, volume: cp.spec })) : PRODUCTS;
    catMarketing = cat?.marketing;
  } catch {
    categoryProducts = PRODUCTS;
  }

  const targetId = overrideTarget || pickTargetProduct(seed, categoryProducts);
  const shuffled = shufflePositions(categoryProducts as any, seed);

  const toolCtx: ToolContext = {
    condition: condition as Condition,
    targetProductId: targetId,
    shuffledProducts: shuffled,
    seed,
    nudgeSurfaces: ["search", "detail"] as NudgeSurface[],
    inputMode: inputMode as InputMode,
    categoryId,
    catMarketing,
  };

  const result = executeTool(toolName, toolArgs, toolCtx);

  // If renderScreenshot=true, apply the same base64 inlining that Puppeteer gets
  const inlined = body.renderScreenshot ? resolveLocalImages(result) : result;

  return NextResponse.json({ result: inlined, toolName, toolArgs, categoryId, condition, inputMode });
}
