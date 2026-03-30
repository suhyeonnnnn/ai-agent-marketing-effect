import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { executeTool, type ToolContext } from "@/lib/tools";
import { type Condition, type InputMode, productsToHTML, shufflePositions } from "@/lib/products";

const EXAMPLES = [
  { label: "01_search_serum_control",        category: "serum",      condition: "control",         page: "search",  target: 2 },
  { label: "02_search_serum_scarcity",       category: "serum",      condition: "scarcity",        page: "search",  target: 2 },
  { label: "03_search_smartwatch_urgency",   category: "smartwatch", condition: "urgency",         page: "search",  target: 3 },
  { label: "04_search_milk_anchoring",       category: "milk",       condition: "price_anchoring", page: "search",  target: 4 },
  { label: "05_search_dress_socialproof",    category: "dress",      condition: "social_proof_a",  page: "search",  target: 6 },
  { label: "06_detail_serum_authority",      category: "serum",      condition: "authority_a",     page: "detail",  target: 2 },
  { label: "07_detail_smartwatch_scarcity",  category: "smartwatch", condition: "scarcity",        page: "detail",  target: 5 },
  { label: "08_detail_milk_authority",       category: "milk",       condition: "authority_a",     page: "detail",  target: 2 },
  { label: "09_reviews_serum",              category: "serum",      condition: "control",         page: "reviews", target: 2 },
  { label: "10_reviews_dress",              category: "dress",      condition: "control",         page: "reviews", target: 3 },
] as const;

/** Convert local image paths to base64 data URIs */
async function inlineLocalImages(html: string): Promise<string> {
  const imgRegex = /src="(\/images\/[^"]+)"/g;
  const matches = [...html.matchAll(imgRegex)];
  let result = html;

  for (const match of matches) {
    const localPath = match[1]; // e.g. /images/products/serum_1.jpg
    const filePath = path.join(process.cwd(), "public", localPath);
    try {
      const buf = await fs.readFile(filePath);
      const b64 = buf.toString("base64");
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      result = result.replace(match[1], `data:${mime};base64,${b64}`);
    } catch {
      // skip if file not found
    }
  }
  return result;
}

function generateHtml(category: string, condition: string, page: string, targetProductId: number): string {
  const cat = CATEGORIES[category as CategoryId];
  const ctx: ToolContext = {
    condition: condition as Condition,
    targetProductId,
    shuffledProducts: cat.products as any,
    seed: 42,
    nudgeSurfaces: ["search", "detail"],
    inputMode: "html" as InputMode,
    categoryId: category,
    catMarketing: cat.marketing,
  };

  let toolResult: string;
  switch (page) {
    case "search": toolResult = executeTool("search", { query: cat.label }, ctx); break;
    case "detail": toolResult = executeTool("view_product", { product_id: targetProductId }, ctx); break;
    case "reviews": toolResult = executeTool("read_reviews", { product_id: targetProductId }, ctx); break;
    default: toolResult = "";
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:12px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style></head><body>${toolResult}</body></html>`;
}

function generateStudy1Html(category: string, condition: string, targetProductId: number): string {
  const cat = CATEGORIES[category as CategoryId];
  const shuffled = shufflePositions(cat.products as any, 42);
  const html = productsToHTML(shuffled, condition as Condition, targetProductId, cat.marketing, cat.label);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:12px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style></head><body>${html}</body></html>`;
}

export async function POST(req: NextRequest) {
  const outDir = path.join(process.cwd(), "screenshots");
  await fs.mkdir(outDir, { recursive: true });

  const saved: string[] = [];
  const allHtmls: { filename: string; html: string }[] = [];

  // Study 2 tool-generated HTML
  for (const ex of EXAMPLES) {
    let html = generateHtml(ex.category, ex.condition, ex.page, ex.target);
    html = await inlineLocalImages(html);
    const filename = `agent_s2_${ex.label}`;
    await fs.writeFile(path.join(outDir, `${filename}.html`), html);
    allHtmls.push({ filename, html });
    saved.push(`${filename}.html`);
  }

  // Study 1 grid HTML
  const s1Examples = [
    { label: "s1_serum_control",      category: "serum",      condition: "control",     target: 2 },
    { label: "s1_serum_scarcity",     category: "serum",      condition: "scarcity",    target: 2 },
    { label: "s1_smartwatch_urgency", category: "smartwatch", condition: "urgency",     target: 3 },
    { label: "s1_milk_authority",     category: "milk",       condition: "authority_a", target: 4 },
  ];
  for (const ex of s1Examples) {
    let html = generateStudy1Html(ex.category, ex.condition, ex.target);
    html = await inlineLocalImages(html);
    const filename = `agent_${ex.label}`;
    await fs.writeFile(path.join(outDir, `${filename}.html`), html);
    allHtmls.push({ filename, html });
    saved.push(`${filename}.html`);
  }

  // Puppeteer rendering for JPEGs
  let jpgCount = 0;
  try {
    const puppeteer = await import("puppeteer");
    const browser = await (puppeteer as any).default.launch({ headless: "new", args: ["--no-sandbox"] });

    for (const { filename, html } of allHtmls) {
      const page = await browser.newPage();
      await page.setViewport({ width: 900, height: 700 });
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
      await page.screenshot({ path: path.join(outDir, `${filename}.jpg`), type: "jpeg", quality: 85, fullPage: true });
      await page.close();
      jpgCount++;
    }
    await browser.close();
  } catch (e: any) {
    // Puppeteer not available
  }

  return NextResponse.json({
    success: true,
    directory: outDir,
    htmlFiles: saved.length,
    jpgFiles: jpgCount,
    files: saved,
  });
}
