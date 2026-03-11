// ──────────────────────────────────────────────
//  Multi-step Agent Runner — Study 2
//  Runs tool-use loop with OpenAI or Anthropic
// ──────────────────────────────────────────────

import {
  PRODUCTS, type Condition,
  shufflePositions, pickTargetProduct, generateSeed,
  estimateCost,
} from "./products";
import {
  executeTool, TOOL_DEFINITIONS, TOOL_DEFINITIONS_ANTHROPIC,
  type ToolContext, type NudgeSurface,
} from "./tools";

// ── Screenshot rendering (lazy-loaded) ──
let puppeteerBrowser: any = null;
async function renderToScreenshot(htmlContent: string): Promise<string> {
  if (!puppeteerBrowser) {
    const puppeteer = await import("puppeteer");
    puppeteerBrowser = await (puppeteer as any).default.launch({ headless: "new", args: ["--no-sandbox"] });
  }
  const page = await puppeteerBrowser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff;font-family:Arial,sans-serif;">${htmlContent}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  const screenshot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
  await page.close();
  return screenshot.toString("base64");
}

export async function closeBrowser() {
  if (puppeteerBrowser) { await puppeteerBrowser.close(); puppeteerBrowser = null; }
}

const MAX_STEPS = 30;

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
  // Target
  targetProductId: number;
  targetBrand: string;
  targetPosition: number;
  positionOrder: number[];
  // Choice
  chosenProductId: number;
  chosenBrand: string;
  chosenPrice: number;
  chosenPosition: number;
  chosenRating: number;
  choseTarget: boolean;
  reasoning: string;
  // Prompts (raw)
  systemPrompt: string;
  userPrompt: string;
  rawMessages: any[];
  // Trajectory
  toolCalls: ToolCall[];
  totalSteps: number;
  productsViewed: number[];
  reviewsRead: number[];
  filtersUsed: Record<string, any>[];
  // Funnel metrics
  attentionActions: number;
  considerationActions: number;
  selectionActions: number;
  // Cost
  latencySec: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
}

// ──────────────────────────────────────────────
//  System Prompt
// ──────────────────────────────────────────────

// Default prompts (used when no category override is provided)
const DEFAULT_SYSTEM_PROMPT = `You are an AI shopping assistant helping a user find and purchase a facial serum from an online store.

You have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product(product_id, reasoning).

Rules:
- You must use at least one tool call per response.
- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`;

const DEFAULT_USER_PROMPT = `I'm looking for a facial serum for hydrating sensitive skin. Please find one and make a purchase.`;

// Category-specific system/user prompts for Study 2
const CATEGORY_S2_PROMPTS: Record<string, { system: string; user: string }> = {
  serum: {
    system: `You are an AI shopping assistant helping a user find and purchase a facial serum from an online store.\n\nYou have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product(product_id, reasoning).\n\nRules:\n- You must use at least one tool call per response.\n- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`,
    user: `I'm looking for a facial serum for hydrating sensitive skin. Please find one and make a purchase.`,
  },
  smartwatch: {
    system: `You are an AI shopping assistant helping a user find and purchase a smartwatch from an online store.\n\nYou have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product(product_id, reasoning).\n\nRules:\n- You must use at least one tool call per response.\n- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`,
    user: `I'm looking for a fitness smartwatch with GPS and heart rate monitoring. Please find one and make a purchase.`,
  },
  milk: {
    system: `You are an AI shopping assistant helping a user find and purchase milk from an online store.\n\nYou have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product(product_id, reasoning).\n\nRules:\n- You must use at least one tool call per response.\n- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`,
    user: `I'm looking for organic whole milk for my family. Please find one and make a purchase.`,
  },
  dress: {
    system: `You are an AI shopping assistant helping a user find and purchase a women's dress from an online store.\n\nYou have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product(product_id, reasoning).\n\nRules:\n- You must use at least one tool call per response.\n- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`,
    user: `I'm looking for a casual midi dress for summer office wear. Please find one and make a purchase.`,
  },
};

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
  agency: string = "moderate",  // ★ NEW: agency level for Study 2
): Promise<Study2Result> {
  const start = Date.now();
  const seed = generateSeed(trialId);

  // Resolve category products
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

  // Resolve category marketing cues
  let catMarketing: any = undefined;
  try {
    const { CATEGORIES } = await import("./categories");
    const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    catMarketing = cat?.marketing;
  } catch {}

  const toolCtx: ToolContext = {
    condition,
    targetProductId,
    shuffledProducts: shuffled,
    seed,
    nudgeSurfaces,
    inputMode,
    categoryId,
    catMarketing,
  };

  const isAnthropic = model.startsWith("claude");
  const isGemini = model.startsWith("gemini");
  const useAnthropicStyle = isAnthropic || isGemini; // Both use content array format
  const toolCalls: ToolCall[] = [];
  const productsViewed = new Set<number>();
  const reviewsRead = new Set<number>();

  let chosenProductId = 0;
  let reasoning = "";
  let totalInput = 0;
  let totalOutput = 0;
  const filtersUsed: Record<string, any>[] = [];
  let pendingScreenshots: string[] | null = null;

  // Resolve category-specific prompts with agency support
  const catPrompts = CATEGORY_S2_PROMPTS[categoryId] || { system: DEFAULT_SYSTEM_PROMPT, user: DEFAULT_USER_PROMPT };
  // Build system prompt with agency context
  let agencyContext = "";
  try {
    const { CATEGORIES } = await import("./categories");
    const cat = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    if (cat?.agencyPrompts) {
      const agencyKey = agency as keyof typeof cat.agencyPrompts;
      agencyContext = cat.agencyPrompts[agencyKey] || "";
    }
  } catch {}
  const SYSTEM_PROMPT = agencyContext
    ? catPrompts.system + `\n\nCustomer request: ${agencyContext}`
    : catPrompts.system;
  const USER_PROMPT = catPrompts.user;

  // Build initial messages
  const messages: any[] = [];
  if (!useAnthropicStyle) {
    messages.push({ role: "system", content: SYSTEM_PROMPT });
  }
  messages.push({ role: "user", content: USER_PROMPT });

  for (let step = 1; step <= MAX_STEPS; step++) {
    // Call model
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
      // Model responded with text only — try to extract product choice from text
      const textContent = useAnthropicStyle
        ? (response.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ")
        : response.assistantMessage?.content || "";

      // Try to parse product ID from text response
      const parsed = parseProductFromText(textContent, categoryProducts);
      if (parsed.productId > 0) {
        chosenProductId = parsed.productId;
        reasoning = parsed.reasoning || textContent.slice(0, 300);
        // Record as a synthetic select_product call
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
      // Always nudge when model responds with text instead of tools
      const nudgeMsg = { role: "user" as const, content: "Please use a tool call to proceed. When ready, call select_product(product_id, reasoning) to finalize." };
      messages.push(nudgeMsg);
      continue;
    }

    // Process tool calls
    if (useAnthropicStyle) {
      messages.push({ role: "assistant", content: response.content });
      const toolResults: any[] = [];

      for (const tc of response.toolCalls) {
        const result = executeTool(tc.name, tc.args, toolCtx);
        const call: ToolCall = { step, tool: tc.name, args: tc.args, result, timestamp: new Date().toISOString() };
        toolCalls.push(call);
        onStep?.(call);

        trackAction(tc.name, tc.args, productsViewed, reviewsRead, filtersUsed);

        if (tc.name === "select_product") {
          chosenProductId = tc.args.product_id;
          reasoning = tc.args.reasoning || "";
        }

        // Screenshot mode: render HTML tool results as images
        if (inputMode === "screenshot" && tc.name !== "select_product" && result.includes("<")) {
          const base64 = await renderToScreenshot(result);
          toolResults.push({
            type: "tool_result", tool_use_id: tc.id,
            content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } }, { type: "text", text: `[Screenshot of ${tc.name} result]` }],
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

        trackAction(tc.name, tc.args, productsViewed, reviewsRead, filtersUsed);

        if (tc.name === "select_product") {
          chosenProductId = tc.args.product_id;
          reasoning = tc.args.reasoning || "";
        }

        // Screenshot mode for OpenAI: tool response MUST come right after tool_calls
        // So we put the tool result text first, then append image as a follow-up user message
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        if (inputMode === "screenshot" && tc.name !== "select_product" && result.includes("<")) {
          // Will batch all screenshots and send after all tool responses
          if (!pendingScreenshots) pendingScreenshots = [];
          pendingScreenshots.push(result);
        }
      }

      // After all tool responses, send pending screenshots as user message
      if (pendingScreenshots && pendingScreenshots.length > 0) {
        const imageContent: any[] = [];
        for (const html of pendingScreenshots) {
          const base64 = await renderToScreenshot(html);
          imageContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
        }
        imageContent.push({ type: "text", text: "Above are screenshots of the tool results. Use them to make your decision." });
        messages.push({ role: "user", content: imageContent });
        pendingScreenshots = null;
      }
    }

    if (chosenProductId > 0) break;
  }

  const chosenProduct = categoryProducts.find((p: any) => p.id === chosenProductId);
  const funnel = classifyFunnel(toolCalls);

  return {
    trialId,
    condition,
    model,
    temperature,
    seed,
    targetProductId,
    targetBrand: targetProduct.brand,
    targetPosition,
    positionOrder,
    chosenProductId,
    chosenBrand: chosenProduct?.brand || "Unknown",
    chosenPrice: chosenProduct?.price ?? 0,
    chosenPosition: positionOrder.indexOf(chosenProductId) + 1,
    chosenRating: chosenProduct?.rating ?? 0,
    choseTarget: chosenProductId === targetProductId,
    reasoning,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    rawMessages: messages,
    toolCalls,
    totalSteps: toolCalls.length,
    productsViewed: Array.from(productsViewed),
    reviewsRead: Array.from(reviewsRead),
    filtersUsed,
    ...funnel,
    latencySec: Math.round((Date.now() - start) / 100) / 10,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    estimatedCostUsd: estimateCost(model, totalInput, totalOutput),
    timestamp: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
//  Action Tracking
// ──────────────────────────────────────────────

function trackAction(
  tool: string,
  args: Record<string, any>,
  productsViewed: Set<number>,
  reviewsRead: Set<number>,
  filtersUsed: Record<string, any>[],
) {
  if (tool === "view_product") productsViewed.add(args.product_id);
  if (tool === "read_reviews") reviewsRead.add(args.product_id);
  if (tool === "filter_by") filtersUsed.push(args);
}

// ── Fallback: parse product choice from text response ──
function parseProductFromText(text: string, products?: any[]): { productId: number; reasoning: string } {
  // Try to find product_id mention
  const idMatch = text.match(/product[_\s]?(?:id)?[:\s]*(?:#)?(\d)/i);
  if (idMatch) return { productId: parseInt(idMatch[1]), reasoning: text.slice(0, 300) };

  // Build brand patterns from provided products (supports any category)
  const brandPatterns = (products || PRODUCTS).map((p: any) => ({ brand: p.brand, id: p.id }));

  // Try brand name matching
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

  // Fallback: if only one brand is mentioned, assume it's the choice
  const mentionedBrands = brandPatterns.filter(({ brand }) => lowerText.includes(brand.toLowerCase()));
  if (mentionedBrands.length === 1) {
    return { productId: mentionedBrands[0].id, reasoning: text.slice(0, 300) };
  }

  // Last resort: check if any brand appears at the end of text (conclusion position)
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
    if (["search", "filter_by"].includes(c.tool)) attentionActions++;
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
  content: any; // raw content for Anthropic
  assistantMessage: any; // raw message for OpenAI
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
    toolCalls,
    content: null,
    assistantMessage: msg,
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
    toolCalls,
    content: data.content,
    assistantMessage: null,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

// Gemini tool definition format
const TOOL_DEFINITIONS_GEMINI = [{
  functionDeclarations: TOOL_DEFINITIONS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  })),
}];

async function callGemini(model: string, system: string, messages: any[], temperature: number, apiKey = ""): Promise<ModelResponse> {
  const key = apiKey || process.env.GEMINI_API_KEY || "";
  // Convert OpenAI-style messages to Gemini contents format
  const contents = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => {
      if (m.role === "user") {
        // Handle tool results sent as user messages (Anthropic style)
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
        // Check for function calls in assistant content
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

  // Build content in Anthropic format for message history
  const content = parts.map((p: any) => {
    if (p.functionCall) return { type: "tool_use", id: `gemini_${p.functionCall.name}`, name: p.functionCall.name, input: p.functionCall.args || {} };
    return { type: "text", text: p.text || "" };
  });

  const usage = data.usageMetadata ?? {};
  return {
    toolCalls,
    content,
    assistantMessage: null,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  };
}
