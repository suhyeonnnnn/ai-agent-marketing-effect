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

const SYSTEM_PROMPT = `You are an AI shopping assistant helping a user find and purchase a facial serum from an online store.

You have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product(product_id, reasoning).

Rules:
- You must use at least one tool call per response.
- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.`;

const USER_PROMPT = `I'm looking for a facial serum for hydrating sensitive skin. Please find one and make a purchase.`;

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
): Promise<Study2Result> {
  const start = Date.now();
  const seed = generateSeed(trialId);
  const targetProductId = pickTargetProduct(seed);
  const shuffled = shufflePositions(PRODUCTS, seed);
  const positionOrder = shuffled.map((p) => p.id);
  const targetProduct = PRODUCTS.find((p) => p.id === targetProductId)!;
  const targetPosition = positionOrder.indexOf(targetProductId) + 1;

  const toolCtx: ToolContext = {
    condition,
    targetProductId,
    shuffledProducts: shuffled,
    seed,
    nudgeSurfaces,
    inputMode,
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
      response = await callAnthropic(model, SYSTEM_PROMPT, messages, temperature);
    } else if (isGemini) {
      response = await callGemini(model, SYSTEM_PROMPT, messages, temperature);
    } else {
      response = await callOpenAI(model, messages, temperature);
    }

    totalInput += response.inputTokens;
    totalOutput += response.outputTokens;

    if (response.toolCalls.length === 0) {
      // Model responded with text only — try to extract product choice from text
      const textContent = useAnthropicStyle
        ? (response.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ")
        : response.assistantMessage?.content || "";

      // Try to parse product ID from text response
      const parsed = parseProductFromText(textContent);
      if (parsed.productId > 0) {
        chosenProductId = parsed.productId;
        reasoning = parsed.reasoning || textContent.slice(0, 300);
        // Record as a synthetic select_product call
        const syntheticCall: ToolCall = {
          step, tool: "select_product",
          args: { product_id: chosenProductId, reasoning },
          result: JSON.stringify({ status: "purchased", product_id: chosenProductId, brand: PRODUCTS.find(p => p.id === chosenProductId)?.brand || "Unknown", note: "parsed_from_text" }),
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

        toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: result });
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

        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    if (chosenProductId > 0) break;
  }

  const chosenProduct = PRODUCTS.find((p) => p.id === chosenProductId);
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
    productsViewed: [...productsViewed],
    reviewsRead: [...reviewsRead],
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
function parseProductFromText(text: string): { productId: number; reasoning: string } {
  // Try to find product_id mention
  const idMatch = text.match(/product[_\s]?(?:id)?[:\s]*(?:#)?(\d)/i);
  if (idMatch) return { productId: parseInt(idMatch[1]), reasoning: text.slice(0, 300) };

  // Try brand name matching
  const lowerText = text.toLowerCase();
  const brandPatterns = [
    { brand: "Vitality Extracts", id: 1 },
    { brand: "The Crème Shop", id: 2 },
    { brand: "OZ Naturals", id: 3 },
    { brand: "Drunk Elephant", id: 4 },
    { brand: "New York Biology", id: 5 },
    { brand: "Hotmir", id: 6 },
    { brand: "HoneyLab", id: 7 },
    { brand: "No7", id: 8 },
  ];

  // Look for decision words near a brand name (strict match)
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

async function callOpenAI(model: string, messages: any[], temperature: number): Promise<ModelResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
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

async function callAnthropic(model: string, system: string, messages: any[], temperature: number): Promise<ModelResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
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

async function callGemini(model: string, system: string, messages: any[], temperature: number): Promise<ModelResponse> {
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
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
