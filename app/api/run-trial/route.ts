import { NextRequest, NextResponse } from "next/server";
import {
  PRODUCTS, productsToJSON, productsToFlatText, productsToHTML, estimateCost,
  shufflePositions, pickTargetProduct, generateSeed,
  type Condition, type InputMode, type ManipulationCheck, type Product,
} from "@/lib/products";
import { buildSystemPrompt, buildUserPrompt, MANIPULATION_CHECK_PROMPT } from "@/lib/prompts";
import { appendTrial } from "@/lib/server-store";
import { CATEGORIES, type CategoryId, type CategoryConfig } from "@/lib/categories";

// ──────────────────────────────────────────────
//  Screenshot rendering (server-side Puppeteer)
// ──────────────────────────────────────────────
let puppeteerBrowser: any = null;
// Pre-fetch external images and inline them as base64 to bypass hotlink protection
async function inlineExternalImages(html: string): Promise<string> {
  const imgRegex = /<img([^>]*?)src="(https?:\/\/[^"]+)"([^>]*?)>/g;
  const matches = [...html.matchAll(imgRegex)];
  let result = html;
  await Promise.all(matches.map(async (match) => {
    try {
      const res = await fetch(match[2], {
        headers: { "Referer": "https://www.amazon.com/", "User-Agent": "Mozilla/5.0" }
      });
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const mime = res.headers.get("content-type") || "image/jpeg";
      result = result.replace(match[2], `data:${mime};base64,${b64}`);
    } catch {
      // silently skip failed images
    }
  }));
  return result;
}

async function renderHtmlToScreenshot(htmlContent: string): Promise<string> {
  if (!puppeteerBrowser) {
    // @ts-ignore - puppeteer not available in Vercel environment
    // @ts-ignore
    const puppeteer = await import(/* webpackIgnore: true */ "puppeteer");
    puppeteerBrowser = await (puppeteer as any).default.launch({ headless: "new", args: ["--no-sandbox"] });
  }
  // Inline external images as base64 to avoid hotlink blocking (e.g. Amazon CDN)
  const inlinedHtml = await inlineExternalImages(htmlContent);
  const page = await puppeteerBrowser.newPage();
  await page.setViewport({ width: 600, height: 450 });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:12px;background:#fff;font-family:Arial,sans-serif;">${inlinedHtml}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  const screenshot = await page.screenshot({ type: "jpeg", quality: 50, fullPage: true });
  await page.close();
  return screenshot.toString("base64");
}

// ──────────────────────────────────────────────
//  Run Trial (Batch) — Multi-category support
//  1. Main choice  2. Manipulation check
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    condition = "control",
    promptType = "vague",
    promptVariant = "default",
    inputMode = "text_json",
    model = "gpt-4o-mini",
    screenshotBase64,
    trialId = 0,
    targetProductId: explicitTarget,
    enableManipCheck = true,
    temperature = 1.0,
    seed: explicitSeed,
    apiKeys = {},
    categoryId = "serum",       // ★ NEW: category support
    dryRun = false,              // ★ Return prompts only, no LLM call
  } = body;

  const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY || "";
  const anthropicKey = apiKeys.anthropic || process.env.ANTHROPIC_API_KEY || "";
  const geminiKey = apiKeys.gemini || process.env.GEMINI_API_KEY || "";

  const start = Date.now();

  try {
    // ── Resolve category ──
    const category: CategoryConfig | undefined = CATEGORIES[categoryId as CategoryId];
    // Use category products if available, otherwise fallback to serum PRODUCTS
    const categoryProducts: Product[] = category
      ? category.products.map(cp => ({
          ...cp,
          volume: cp.spec,  // CategoryProduct uses 'spec', Product uses 'volume'
        } as any as Product))
      : PRODUCTS;
    const catMarketing = category?.marketing;

    // ── Seed & randomization ──
    const seed = explicitSeed ?? generateSeed(trialId);
    const shuffled = shufflePositions(categoryProducts, seed);
    const positionOrder = shuffled.map((p) => p.id);

    // ── Target product (rotate or explicit) ──
    const targetId = explicitTarget ?? pickTargetProduct(seed, categoryProducts);
    const targetProduct = categoryProducts.find((p) => p.id === targetId)!;
    const targetPosition = positionOrder.indexOf(targetId) + 1;

    // ── Build prompts (category-aware) ──
    const systemPrompt = buildSystemPrompt(promptType, promptVariant, category);
    const productsJson = productsToJSON(shuffled, condition as Condition, targetId, catMarketing);
    const productsText = productsToFlatText(shuffled, condition as Condition, targetId, catMarketing);
    const productsHtml = productsToHTML(shuffled, condition as Condition, targetId, catMarketing, category?.label);

    // ── Screenshot: render HTML to image server-side if no client screenshot ──
    let ssBase64 = screenshotBase64;
    if (inputMode === "screenshot" && !ssBase64) {
      // Server-side rendering — fail hard if Puppeteer unavailable (no silent fallback)
      ssBase64 = await renderHtmlToScreenshot(productsHtml);
    }

    // ── Save screenshot to file ──
    let screenshotPath: string | null = null;
    if (inputMode === "screenshot" && ssBase64) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const ssDir = path.default.join(process.cwd(), "results", "study1", "screenshots");
        fs.default.mkdirSync(ssDir, { recursive: true });
        const filename = `s1_${categoryId}_${condition}_${promptType}_t${trialId}.jpg`;
        fs.default.writeFileSync(path.default.join(ssDir, filename), Buffer.from(ssBase64, "base64"));
        screenshotPath = `results/study1/screenshots/${filename}`;
      } catch (e: any) {
        console.warn("Screenshot save failed:", e.message);
      }
    }

    const userPrompt = buildUserPrompt(promptType, inputMode as InputMode, productsJson, productsText, productsHtml, category);

    // ── Dry run: return prompts without calling LLM ──
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        trialId, condition, categoryId, promptType, inputMode, model,
        targetProductId: targetId, targetBrand: targetProduct.brand, targetPosition,
        positionOrder, seed, temperature,
        systemPrompt, userPrompt, productsHtml,
      });
    }

    // ── 1. Main choice call ──
    const mainResult = await callModel(model, systemPrompt, userPrompt, inputMode, ssBase64, temperature, { openaiKey, anthropicKey, geminiKey });
    const parsed = parseAgentResponse(mainResult.text, shuffled);

    // ── 2. Manipulation check ──
    // Removed: LLM self-report is unreliable.
    // Instead, analyze 'reasoning' text post-hoc for cue keyword mentions.
    const manipulationCheck = null;

    const totalCost = estimateCost(model, mainResult.inputTokens, mainResult.outputTokens);

    const result = {
      trialId,
      condition,
      categoryId,                   // ★ Track category in results
      promptType,
      promptVariant,
      inputMode,
      model,
      targetProductId: targetId,
      targetBrand: targetProduct.brand,
      targetPosition,
      chosenProductId: parsed.chosenProductId,
      chosenProduct: parsed.chosenProduct,
      chosenBrand: parsed.chosenBrand,
      chosenPosition: parsed.chosenPosition,
      chosenPrice: parsed.chosenPrice,
      chosenRating: parsed.chosenRating,
      choseTarget: parsed.chosenProductId === targetId,
      reasoning: parsed.reasoning,
      systemPrompt,
      userPrompt,
      rawResponse: mainResult.text,
      latencySec: Math.round((Date.now() - start) / 100) / 10,
      inputTokens: mainResult.inputTokens,
      outputTokens: mainResult.outputTokens,
      estimatedCostUsd: Math.round(totalCost * 100000) / 100000,
      timestamp: new Date().toISOString(),
      positionOrder,
      seed,
      temperature,
      screenshotPath,
      manipulationCheck,
    };

    appendTrial({ study: 1, ...result });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
//  LLM API Calls
// ──────────────────────────────────────────────

interface LLMResult { text: string; inputTokens: number; outputTokens: number; }
interface ApiKeys { openaiKey: string; anthropicKey: string; geminiKey: string; }

function callModel(model: string, system: string, user: string, inputMode: string, screenshotBase64?: string, temperature = 1.0, keys: ApiKeys = { openaiKey: "", anthropicKey: "", geminiKey: "" }): Promise<LLMResult> {
  if (model.startsWith("claude")) return callAnthropic(model, system, user, inputMode, screenshotBase64, temperature, keys.anthropicKey);
  if (model.startsWith("gemini")) return callGemini(model, system, user, inputMode, screenshotBase64, temperature, keys.geminiKey);
  return callOpenAI(model, system, user, inputMode, screenshotBase64, temperature, keys.openaiKey);
}

// Multi-turn: user1 → assistant1 → user2 (manipulation check)
async function callModelMultiTurn(
  model: string, system: string,
  user1: string, assistant1: string,
  user2: string,
  temperature = 1.0, keys: ApiKeys = { openaiKey: "", anthropicKey: "", geminiKey: "" }
): Promise<LLMResult> {
  if (model.startsWith("claude")) {
    const key = keys.anthropicKey;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, system, temperature, max_tokens: 1024,
        messages: [
          { role: "user", content: user1 },
          { role: "assistant", content: assistant1 },
          { role: "user", content: user2 },
        ],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { text: data.content?.map((c: any) => c.text).join("") ?? "", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  }
  if (model.startsWith("gemini")) {
    const key = keys.geminiKey;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          { role: "user", parts: [{ text: user1 }] },
          { role: "model", parts: [{ text: assistant1 }] },
          { role: "user", parts: [{ text: user2 }] },
        ],
        generationConfig: { temperature, maxOutputTokens: 1024 },
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    const usage = data.usageMetadata ?? {};
    return { text, inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0 };
  }
  // OpenAI (default)
  const key = keys.openaiKey;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature, max_tokens: 1024,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user1 },
        { role: "assistant", content: assistant1 },
        { role: "user", content: user2 },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { text: data.choices?.[0]?.message?.content ?? "", inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
}

async function callOpenAI(model: string, system: string, user: string, inputMode: string, screenshotBase64?: string, temperature = 1.0, apiKey = ""): Promise<LLMResult> {
  const key = apiKey || process.env.OPENAI_API_KEY || "";
  const messages: any[] = [{ role: "system", content: system }];
  if (inputMode === "screenshot" && screenshotBase64) {
    messages.push({ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } }, { type: "text", text: user }] });
  } else {
    messages.push({ role: "user", content: user });
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 2048 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { text: data.choices?.[0]?.message?.content ?? "", inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
}

async function callAnthropic(model: string, system: string, user: string, inputMode: string, screenshotBase64?: string, temperature = 1.0, apiKey = ""): Promise<LLMResult> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
  const content: any[] = [];
  if (inputMode === "screenshot" && screenshotBase64) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: screenshotBase64 } });
  content.push({ type: "text", text: user });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, system, messages: [{ role: "user", content }], temperature, max_tokens: 2048 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { text: data.content?.map((c: any) => c.text).join("") ?? "", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
}

async function callGemini(model: string, system: string, user: string, inputMode: string, screenshotBase64?: string, temperature = 1.0, apiKey = ""): Promise<LLMResult> {
  const key = apiKey || process.env.GEMINI_API_KEY || "";
  const parts: any[] = [];
  if (inputMode === "screenshot" && screenshotBase64) parts.push({ inlineData: { mimeType: "image/jpeg", data: screenshotBase64 } });
  parts.push({ text: user });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts }], generationConfig: { temperature, maxOutputTokens: 2048 } }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  const usage = data.usageMetadata ?? {};
  return { text, inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0 };
}

// ──────────────────────────────────────────────
//  Response Parsers
// ──────────────────────────────────────────────

function parseAgentResponse(raw: string, orderedProducts: any[]) {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*?"chosen_product_number"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const num = parsed.chosen_product_number;
      const product = orderedProducts[num - 1];
      return {
        chosenProduct: parsed.chosen_product_name || product?.name || `Product ${num}`,
        chosenBrand: parsed.chosen_brand || product?.brand || "Unknown",
        chosenPosition: num,
        chosenProductId: product?.id ?? 0,
        chosenPrice: product?.price ?? 0,
        chosenRating: product?.rating ?? 0,
        reasoning: parsed.reasoning || "",
      };
    }
  } catch {}
  for (let i = 0; i < orderedProducts.length; i++) {
    if (raw.includes(orderedProducts[i].brand)) {
      return { chosenProduct: orderedProducts[i].name, chosenBrand: orderedProducts[i].brand, chosenPosition: i + 1, chosenProductId: orderedProducts[i].id, chosenPrice: orderedProducts[i].price ?? 0, chosenRating: orderedProducts[i].rating ?? 0, reasoning: raw.slice(0, 200) };
    }
  }
  return { chosenProduct: "Unknown", chosenBrand: "Unknown", chosenPosition: -1, chosenProductId: -1, chosenPrice: -1, chosenRating: -1, reasoning: raw.slice(0, 200) };
}

function parseManipulationCheck(raw: string, targetProductId: number): ManipulationCheck {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*?"noticed_any_cues"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const cues = parsed.cues_noticed || [];
      const mentionedTarget = cues.find((c: any) => c.product_number != null);
      return { noticed: parsed.noticed_any_cues === true, mentionedBadgeType: mentionedTarget?.cue_type || "", mentionedProductId: mentionedTarget?.product_number || 0, rawResponse: raw };
    }
  } catch {}
  return { noticed: raw.toLowerCase().includes("yes") || raw.toLowerCase().includes("noticed"), mentionedBadgeType: "", mentionedProductId: 0, rawResponse: raw };
}
