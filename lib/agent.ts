// ──────────────────────────────────────────────
//  Multi-step Agent Runner — Study 2
//  Runs tool-use loop with OpenAI or Anthropic
//
//  ★ Tools accept brand name OR product_id for product identification.
//    This ensures screenshot mode works correctly since rendered images
//    don't show numeric product IDs.
//    The executor (tools.ts) resolves brand → product_id via fuzzy matching.
//    agent.ts extracts the resolved product_id from the executor's JSON result.
// ──────────────────────────────────────────────

import fs from "fs";
import path from "path";
import {
  PRODUCTS, type Condition,
  shufflePositions, pickTargetProduct, generateSeed,
  estimateCost,
} from "./products";
import {
  executeTool, TOOL_DEFINITIONS, TOOL_DEFINITIONS_ANTHROPIC,
  type ToolContext, type NudgeSurface,
} from "./tools";

// ── Screenshot saving ──
function saveScreenshot(base64: string, trialId: number, step: number, toolName: string, categoryId: string, condition: string): string {
  const runId = process.env.RUN_ID || "260314_1";
  const ssDir = path.join(process.cwd(), "results", runId, "study2", "screenshots");
  try { fs.mkdirSync(ssDir, { recursive: true }); } catch {}
  const filename = `s2_${categoryId}_${condition}_t${trialId}_step${step}_${toolName}.jpg`;
  const filepath = path.join(ssDir, filename);
  try {
    fs.writeFileSync(filepath, Buffer.from(base64, "base64"));
  } catch {}
  return `results/${runId}/study2/screenshots/${filename}`;
}

// ── Screenshot rendering (lazy-loaded) ──
let puppeteerBrowser: any = null;

function resolveLocalImages(html: string): string {
  const publicDir = path.join(process.cwd(), "public");
  return html.replace(/src="(\/images\/[^"]+)"/g, (match, p1) => {
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

const IMAGE_LOG_PATH = path.join(process.cwd(), "results", process.env.RUN_ID || "260314_1", "image_verification.log");
let imageCheckCount = 0;
let imageFailCount = 0;

function logImageCheck(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { fs.mkdirSync(path.dirname(IMAGE_LOG_PATH), { recursive: true }); } catch {}
  try { fs.appendFileSync(IMAGE_LOG_PATH, line); } catch {}
}

async function renderToScreenshot(htmlContent: string): Promise<string> {
  if (!puppeteerBrowser) {
    // @ts-ignore
    const puppeteer = await import("puppeteer");
    puppeteerBrowser = await (puppeteer as any).default.launch({ headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
  }
  const resolvedHtml = resolveLocalImages(htmlContent);

  const b64Count = (resolvedHtml.match(/src="data:image\/jpeg;base64,/g) || []).length;
  const unresolvedCount = (resolvedHtml.match(/src="\/images\/products\/[^"]+"/g) || []).length;
  if (unresolvedCount > 0) {
    logImageCheck(`⚠️ UNRESOLVED: ${unresolvedCount} images still have /images/ paths (${b64Count} resolved)`);
  }

  const page = await puppeteerBrowser.newPage();
  await page.setViewport({ width: 600, height: 450 });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:12px;background:#fff;font-family:Arial,sans-serif;">${resolvedHtml}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});

  imageCheckCount++;
  const imgStatus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map(img => ({
      ok: img.naturalWidth > 0,
      alt: img.alt?.substring(0, 40) || "no-alt",
    }));
  });
  const totalImgs = imgStatus.length;
  const loadedImgs = imgStatus.filter((i: any) => i.ok).length;
  const failedImgs = imgStatus.filter((i: any) => !i.ok);

  if (failedImgs.length > 0) {
    imageFailCount++;
    const failNames = failedImgs.map((i: any) => i.alt).join(", ");
    logImageCheck(`❌ FAILED: ${failedImgs.length}/${totalImgs} images not loaded [${failNames}]`);
    console.error(`  ❌ IMAGE FAIL: ${failedImgs.length}/${totalImgs} images not loaded (check ${IMAGE_LOG_PATH})`);
  } else if (imageCheckCount % 100 === 0) {
    logImageCheck(`✅ CHECK #${imageCheckCount}: ${loadedImgs}/${totalImgs} images OK (${imageFailCount} total failures so far)`);
  }
  if (imageCheckCount === 1) {
    logImageCheck(`✅ FIRST SCREENSHOT: ${loadedImgs}/${totalImgs} images loaded, b64=${b64Count}, unresolved=${unresolvedCount}`);
  }

  const screenshot = await page.screenshot({ type: "jpeg", quality: 50, fullPage: true });
  await page.close();
  return screenshot.toString("base64");
}

export async function closeBrowser() {
  if (puppeteerBrowser) { await puppeteerBrowser.close(); puppeteerBrowser = null; }
}

const MAX_STEPS = 15;

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

export interface ToolCall {
  step: number;
  tool: string;
  args: Record<string, any>;
  result: string;
  timestamp: string;
}

export interface Study2Result {
  trialId: number;
  condition: Condition;
  model: string;
  temperature: number;
  seed: number;
  targetProductId: number;
  targetBrand: string;
  targetPosition: number;
  positionOrder: number[];
  chosenProductId: number;
  chosenBrand: string;
  chosenPrice: number;
  chosenPosition: number;
  chosenRating: number;
  choseTarget: boolean;
  reasoning: string;
  systemPrompt: string;
  userPrompt: string;
  rawMessages: any[];
  toolCalls: ToolCall[];
  totalSteps: number;
  productsViewed: number[];
  reviewsRead: number[];
  filtersUsed: Record<string, any>[];
  attentionActions: number;
  considerationActions: number;
  selectionActions: number;
  screenshotPaths: string[];
  latencySec: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
}

// ──────────────────────────────────────────────
//  System Prompt
// ──────────────────────────────────────────────

// ★ Updated: select_product accepts brand name (not just product_id)
const STUDY2_SYSTEM_PROMPT = `You are a shopping assistant. Based on the customer's request, select one product.

You have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product with the product's brand name and your reasoning.

Rules:
- You must use at least one tool call per response.
- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`;

// ──────────────────────────────────────────────
//  Helper: extract resolved product_id from tool result JSON
// ──────────────────────────────────────────────

function extractProductIdFromResult(result: string): number {
  try {
    const parsed = JSON.parse(result);
    return parsed.product_id ?? 0;
  } catch {
    return 0;
  }
}

// ──────────────────────────────────────────────
//  Main Runner
// ──────────────────────────────────────────────

export async function runStudy2Trial(
  trialId: number,
  condition: Condition,
  model: string,
  temperature: number = 1.0,
  nudgeSurfaces: NudgeSurface[] = ["search", "detail"],
  inputMode: "text_json" | "text_flat" | "html" | "screenshot" = "text_json",
  onStep?: (step: ToolCall) => void,
  apiKeys: { openai: string; anthropic: string; gemini: string } = { openai: "", anthropic: "", gemini: "" },
  categoryId: string = "serum",
  agency: string = "moderate",
): Promise<Study2Result> {
  const start = Date.now();
  const seed = generateSeed(trialId);

  let categoryProducts: any[];
  try {
    const { CATEGORIES } = await import("./categories");
    const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    categoryProducts = cat ? cat.products.map((cp: any) => ({ ...cp, volume: cp.spec })) : PRODUCTS;
  } catch {
    categoryProducts = PRODUCTS;
  }

  const targetProductId = pickTargetProduct(seed, categoryProducts);
  const shuffled = shufflePositions(categoryProducts as any, seed);
  const positionOrder = shuffled.map((p) => p.id);
  const targetProduct = categoryProducts.find((p: any) => p.id === targetProductId)!;
  const targetPosition = positionOrder.indexOf(targetProductId) + 1;

  let catMarketing: any = undefined;
  try {
    const { CATEGORIES } = await import("./categories");
    const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    catMarketing = cat?.marketing;
  } catch {}

  const toolCtx: ToolContext = {
    condition, targetProductId, shuffledProducts: shuffled,
    seed, nudgeSurfaces, inputMode, categoryId, catMarketing,
  };

  const isAnthropic = model.startsWith("claude");
  const isGemini = model.startsWith("gemini");
  const useAnthropicStyle = isAnthropic || isGemini;
  const toolCalls: ToolCall[] = [];
  const productsViewed = new Set<number>();
  const reviewsRead = new Set<number>();

  let chosenProductId = 0;
  let reasoning = "";
  let totalInput = 0;
  let totalOutput = 0;
  const filtersUsed: Record<string, any>[] = [];
  let pendingScreenshots: { html: string; step: number; tool: string }[] | null = null;
  const screenshotPaths: string[] = [];

  const SYSTEM_PROMPT = STUDY2_SYSTEM_PROMPT;
  let USER_PROMPT = "I'd like to buy something. Please find one and make a purchase.";
  try {
    const { CATEGORIES } = await import("./categories");
    const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    if (cat?.agencyPrompts) {
      const agencyKey = agency as keyof typeof cat.agencyPrompts;
      USER_PROMPT = cat.agencyPrompts[agencyKey] || USER_PROMPT;
    }
  } catch {}

  const messages: any[] = [];
  if (!useAnthropicStyle) {
    messages.push({ role: "system", content: SYSTEM_PROMPT });
  }
  messages.push({ role: "user", content: USER_PROMPT });

  for (let step = 1; step <= MAX_STEPS; step++) {
    let response: ModelResponse;
    if (isAnthropic) {
      response = await callAnthropic(model, SYSTEM_PROMPT, messages, temperature, apiKeys.anthropic);
    } else if (isGemini) {
      response = await callGemini(model, SYSTEM_PROMPT, messages, temperature, apiKeys.gemini);
    } else {
      response = await callOpenAI(model, messages, temperature, apiKeys.openai);
    }

    totalInput += response.inputTokens;
    totalOutput += response.outputTokens;

    if (response.toolCalls.length === 0) {
      const textContent = useAnthropicStyle
        ? (response.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ")
        : response.assistantMessage?.content || "";

      const parsed = parseProductFromText(textContent, categoryProducts);
      if (parsed.productId > 0) {
        chosenProductId = parsed.productId;
        reasoning = parsed.reasoning || textContent.slice(0, 300);
        const syntheticCall: ToolCall = {
          step, tool: "select_product",
          args: { product_id: chosenProductId, reasoning },
          result: JSON.stringify({ status: "purchased", product_id: chosenProductId, brand: categoryProducts.find((p: any) => p.id === chosenProductId)?.brand || "Unknown", note: "parsed_from_text" }),
          timestamp: new Date().toISOString(),
        };
        toolCalls.push(syntheticCall);
        onStep?.(syntheticCall);
        break;
      }

      if (useAnthropicStyle) {
        messages.push({ role: "assistant", content: response.content });
      } else {
        messages.push(response.assistantMessage);
      }
      messages.push({ role: "user" as const, content: "Please use a tool call to proceed. When ready, call select_product() with the brand name and your reasoning to finalize." });
      continue;
    }

    // ── Process tool calls ──
    if (useAnthropicStyle) {
      messages.push({ role: "assistant", content: response.content });
      const toolResults: any[] = [];

      for (const tc of response.toolCalls) {
        const result = executeTool(tc.name, tc.args, toolCtx);
        const call: ToolCall = { step, tool: tc.name, args: tc.args, result, timestamp: new Date().toISOString() };
        toolCalls.push(call);
        onStep?.(call);

        // ★ Track using resolved product_id from result, not from args
        const resolvedId = extractProductIdFromResult(result);
        trackAction(tc.name, resolvedId, productsViewed, reviewsRead);

        if (tc.name === "select_product") {
          // ★ Get product_id from executor result (resolved from brand)
          chosenProductId = resolvedId;
          reasoning = tc.args.reasoning || "";
        }

        if (inputMode === "screenshot" && tc.name !== "select_product" && result.includes("<")) {
          const base64 = await renderToScreenshot(result);
          const ssPath = saveScreenshot(base64, trialId, step, tc.name, categoryId, condition);
          screenshotPaths.push(ssPath);
          toolResults.push({
            type: "tool_result", tool_use_id: tc.id,
            content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } }, { type: "text", text: `[${tc.name} result rendered as screenshot]` }],
          });
        } else {
          toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: result });
        }
      }
      messages.push({ role: "user", content: toolResults });
    } else {
      messages.push(response.assistantMessage);

      for (const tc of response.toolCalls) {
        const result = executeTool(tc.name, tc.args, toolCtx);
        const call: ToolCall = { step, tool: tc.name, args: tc.args, result, timestamp: new Date().toISOString() };
        toolCalls.push(call);
        onStep?.(call);

        // ★ Track using resolved product_id from result
        const resolvedId = extractProductIdFromResult(result);
        trackAction(tc.name, resolvedId, productsViewed, reviewsRead);

        if (tc.name === "select_product") {
          // ★ Get product_id from executor result (resolved from brand)
          chosenProductId = resolvedId;
          reasoning = tc.args.reasoning || "";
        }

        if (inputMode === "screenshot" && tc.name !== "select_product" && result.includes("<")) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: `[${tc.name} result rendered as screenshot below]` });
          if (!pendingScreenshots) pendingScreenshots = [];
          pendingScreenshots.push({ html: result, step, tool: tc.name });
        } else {
          messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
      }

      if (pendingScreenshots && pendingScreenshots.length > 0) {
        const imageContent: any[] = [];
        for (const ss of pendingScreenshots) {
          const base64 = await renderToScreenshot(ss.html);
          const ssPath = saveScreenshot(base64, trialId, ss.step, ss.tool, categoryId, condition);
          screenshotPaths.push(ssPath);
          imageContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
        }
        imageContent.push({ type: "text", text: "Above are the rendered tool results." });
        messages.push({ role: "user", content: imageContent });
        pendingScreenshots = null;
      }
    }

    if (chosenProductId > 0) break;
  }

  const chosenProduct = categoryProducts.find((p: any) => p.id === chosenProductId);
  const funnel = classifyFunnel(toolCalls);

  return {
    trialId, condition, model, temperature, seed,
    targetProductId, targetBrand: targetProduct.brand, targetPosition, positionOrder,
    chosenProductId,
    chosenBrand: chosenProduct?.brand || "Unknown",
    chosenPrice: chosenProduct?.price ?? 0,
    chosenPosition: positionOrder.indexOf(chosenProductId) + 1,
    chosenRating: chosenProduct?.rating ?? 0,
    choseTarget: chosenProductId === targetProductId,
    reasoning,
    systemPrompt: SYSTEM_PROMPT, userPrompt: USER_PROMPT, rawMessages: messages,
    toolCalls, totalSteps: toolCalls.length,
    productsViewed: Array.from(productsViewed),
    reviewsRead: Array.from(reviewsRead),
    filtersUsed,
    ...funnel,
    screenshotPaths,
    latencySec: Math.round((Date.now() - start) / 100) / 10,
    inputTokens: totalInput, outputTokens: totalOutput,
    estimatedCostUsd: estimateCost(model, totalInput, totalOutput),
    timestamp: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
//  Action Tracking
// ──────────────────────────────────────────────

// ★ Changed: takes resolved product_id (from executor result), not raw args
function trackAction(
  tool: string,
  resolvedProductId: number,
  productsViewed: Set<number>,
  reviewsRead: Set<number>,
) {
  if (resolvedProductId <= 0) return;
  if (tool === "view_product") productsViewed.add(resolvedProductId);
  if (tool === "read_reviews") reviewsRead.add(resolvedProductId);
}

// ── Fallback: parse product choice from text response ──
function parseProductFromText(text: string, products?: any[]): { productId: number; reasoning: string } {
  const idMatch = text.match(/product[_\s]?(?:id)?[:\s]*(?:#)?(\d)/i);
  if (idMatch) return { productId: parseInt(idMatch[1]), reasoning: text.slice(0, 300) };

  const brandPatterns = (products || PRODUCTS).map((p: any) => ({ brand: p.brand, id: p.id }));
  const lowerText = text.toLowerCase();
  const decisionWords = /(?:recommend|choose|select|pick|buy|purchase|go with|best choice|my choice|final choice|would suggest|top pick|winner|ideal)/i;

  for (const { brand, id } of brandPatterns) {
    if (lowerText.includes(brand.toLowerCase())) {
      const brandIdx = lowerText.indexOf(brand.toLowerCase());
      const nearby = text.substring(Math.max(0, brandIdx - 150), brandIdx + brand.length + 150);
      if (decisionWords.test(nearby)) {
        return { productId: id, reasoning: text.slice(0, 300) };
      }
    }
  }

  const mentionedBrands = brandPatterns.filter(({ brand }) => lowerText.includes(brand.toLowerCase()));
  if (mentionedBrands.length === 1) {
    return { productId: mentionedBrands[0].id, reasoning: text.slice(0, 300) };
  }

  if (mentionedBrands.length > 0) {
    const lastThird = lowerText.slice(-Math.floor(lowerText.length / 3));
    for (const { brand, id } of brandPatterns) {
      if (lastThird.includes(brand.toLowerCase()) && decisionWords.test(lastThird)) {
        return { productId: id, reasoning: text.slice(0, 300) };
      }
    }
  }

  return { productId: 0, reasoning: "" };
}

function classifyFunnel(calls: ToolCall[]) {
  let attentionActions = 0;
  let considerationActions = 0;
  let selectionActions = 0;
  for (const c of calls) {
    if (c.tool === "search") attentionActions++;
    else if (["view_product", "read_reviews"].includes(c.tool)) considerationActions++;
    else if (c.tool === "select_product") selectionActions++;
  }
  return { attentionActions, considerationActions, selectionActions };
}

// ──────────────────────────────────────────────
//  LLM Calls
// ──────────────────────────────────────────────

interface ModelResponse {
  toolCalls: { id: string; name: string; args: Record<string, any> }[];
  content: any;
  assistantMessage: any;
  inputTokens: number;
  outputTokens: number;
}

async function callOpenAI(model: string, messages: any[], temperature: number, apiKey = ""): Promise<ModelResponse> {
  const key = apiKey || process.env.OPENAI_API_KEY || "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, tools: TOOL_DEFINITIONS, temperature, max_tokens: 2048 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const msg = data.choices?.[0]?.message;
  const toolCalls = (msg?.tool_calls || []).map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments || "{}"),
  }));

  return {
    toolCalls, content: null, assistantMessage: msg,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic(model: string, system: string, messages: any[], temperature: number, apiKey = ""): Promise<ModelResponse> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, system, messages, tools: TOOL_DEFINITIONS_ANTHROPIC, temperature, max_tokens: 4096 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const toolCalls = (data.content || [])
    .filter((c: any) => c.type === "tool_use")
    .map((c: any) => ({ id: c.id, name: c.name, args: c.input }));

  return {
    toolCalls, content: data.content, assistantMessage: null,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

const TOOL_DEFINITIONS_GEMINI = [{
  functionDeclarations: TOOL_DEFINITIONS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  })),
}];

async function callGemini(model: string, system: string, messages: any[], temperature: number, apiKey = ""): Promise<ModelResponse> {
  const key = apiKey || process.env.GEMINI_API_KEY || "";
  const contents = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => {
      if (m.role === "user") {
        if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") {
          return {
            role: "function" as const,
            parts: m.content.map((tr: any) => ({
              functionResponse: {
                name: tr.tool_use_id?.split("_")[0] || "unknown",
                response: { content: tr.content },
              },
            })),
          };
        }
        const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return { role: "user" as const, parts: [{ text }] };
      }
      if (m.role === "assistant") {
        if (Array.isArray(m.content)) {
          const parts: any[] = [];
          for (const block of m.content) {
            if (block.type === "tool_use") {
              parts.push({ functionCall: { name: block.name, args: block.input } });
            } else if (block.type === "text" && block.text) {
              parts.push({ text: block.text });
            }
          }
          return { role: "model" as const, parts };
        }
        return { role: "model" as const, parts: [{ text: m.content || "" }] };
      }
      if (m.role === "tool") {
        return {
          role: "function" as const,
          parts: [{
            functionResponse: {
              name: m.tool_call_id || "unknown",
              response: { content: m.content },
            },
          }],
        };
      }
      return { role: "user" as const, parts: [{ text: JSON.stringify(m.content) }] };
    });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: TOOL_DEFINITIONS_GEMINI,
        generationConfig: { temperature, maxOutputTokens: 4096 },
      }),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const toolCalls = parts
    .filter((p: any) => p.functionCall)
    .map((p: any, i: number) => ({
      id: `gemini_${p.functionCall.name}_${i}`,
      name: p.functionCall.name,
      args: p.functionCall.args || {},
    }));

  const content = parts.map((p: any) => {
    if (p.functionCall) return { type: "tool_use", id: `gemini_${p.functionCall.name}`, name: p.functionCall.name, input: p.functionCall.args || {} };
    return { type: "text", text: p.text || "" };
  });

  const usage = data.usageMetadata ?? {};
  return {
    toolCalls, content, assistantMessage: null,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  };
}
