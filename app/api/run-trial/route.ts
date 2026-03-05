import { NextRequest, NextResponse } from "next/server";
import {
  PRODUCTS, productsToJSON, productsToFlatText, productsToHTML, estimateCost,
  shufflePositions, pickTargetProduct, generateSeed,
  type Condition, type InputMode, type ManipulationCheck,
} from "@/lib/products";
import { buildSystemPrompt, buildUserPrompt, MANIPULATION_CHECK_PROMPT } from "@/lib/prompts";
import { appendTrial } from "@/lib/server-store";

// ──────────────────────────────────────────────
//  Run Trial (Batch) — Paper-quality pipeline
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
  } = body;

  const start = Date.now();

  try {
    // ── Seed & randomization ──
    const seed = explicitSeed ?? generateSeed(trialId);
    const shuffled = shufflePositions(PRODUCTS, seed);
    const positionOrder = shuffled.map((p) => p.id);

    // ── Target product (rotate or explicit) ──
    const targetId = explicitTarget ?? pickTargetProduct(seed);
    const targetProduct = PRODUCTS.find((p) => p.id === targetId)!;
    const targetPosition = positionOrder.indexOf(targetId) + 1;

    // ── Build prompts ──
    const systemPrompt = buildSystemPrompt(promptType, promptVariant);
    const productsJson = productsToJSON(shuffled, condition as Condition, targetId);
    const productsText = productsToFlatText(shuffled, condition as Condition, targetId);
    const productsHtml = productsToHTML(shuffled, condition as Condition, targetId);
    const userPrompt = buildUserPrompt(promptType, inputMode as InputMode, productsJson, productsText, productsHtml);

    // ── 1. Main choice call ──
    const mainResult = await callModel(model, systemPrompt, userPrompt, inputMode, screenshotBase64, temperature);

    const parsed = parseAgentResponse(mainResult.text, shuffled);

    // ── 2. Manipulation check (optional) ──
    let manipulationCheck: ManipulationCheck | null = null;
    if (enableManipCheck && condition !== "control") {
      try {
        const checkResult = await callModel(model, systemPrompt, MANIPULATION_CHECK_PROMPT, "text_flat", undefined, 0);

        manipulationCheck = parseManipulationCheck(checkResult.text, targetId);
        mainResult.inputTokens += checkResult.inputTokens;
        mainResult.outputTokens += checkResult.outputTokens;
      } catch {
        // Non-fatal — continue without manipulation check
      }
    }

    const totalCost = estimateCost(model, mainResult.inputTokens, mainResult.outputTokens);

    const result = {
      trialId,
      condition,
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
      manipulationCheck,
    };

    // ── Server-side auto-save ──
    appendTrial({ study: 1, ...result });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
//  LLM API Calls (with token tracking)
// ──────────────────────────────────────────────

interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

function callModel(
  model: string, system: string, user: string,
  inputMode: string, screenshotBase64?: string, temperature = 1.0,
): Promise<LLMResult> {
  if (model.startsWith("claude")) return callAnthropic(model, system, user, inputMode, screenshotBase64, temperature);
  if (model.startsWith("gemini")) return callGemini(model, system, user, inputMode, screenshotBase64, temperature);
  return callOpenAI(model, system, user, inputMode, screenshotBase64, temperature);
}

async function callOpenAI(
  model: string, system: string, user: string,
  inputMode: string, screenshotBase64?: string, temperature = 1.0,
): Promise<LLMResult> {
  const messages: any[] = [{ role: "system", content: system }];
  if (inputMode === "screenshot" && screenshotBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
        { type: "text", text: user },
      ],
    });
  } else {
    messages.push({ role: "user", content: user });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 2048 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic(
  model: string, system: string, user: string,
  inputMode: string, screenshotBase64?: string, temperature = 1.0,
): Promise<LLMResult> {
  const content: any[] = [];
  if (inputMode === "screenshot" && screenshotBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: screenshotBase64 } });
  }
  content.push({ type: "text", text: user });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, system, messages: [{ role: "user", content }], temperature, max_tokens: 2048 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return {
    text: data.content?.map((c: any) => c.text).join("") ?? "",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callGemini(
  model: string, system: string, user: string,
  inputMode: string, screenshotBase64?: string, temperature = 1.0,
): Promise<LLMResult> {
  const parts: any[] = [];
  if (inputMode === "screenshot" && screenshotBase64) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: screenshotBase64 } });
  }
  parts.push({ text: user });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature, maxOutputTokens: 2048 },
      }),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  const usage = data.usageMetadata ?? {};
  return {
    text,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  };
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

  // Fallback: brand mention search
  for (let i = 0; i < orderedProducts.length; i++) {
    if (raw.includes(orderedProducts[i].brand)) {
      return {
        chosenProduct: orderedProducts[i].name,
        chosenBrand: orderedProducts[i].brand,
        chosenPosition: i + 1,
        chosenProductId: orderedProducts[i].id,
        chosenPrice: orderedProducts[i].price ?? 0,
        chosenRating: orderedProducts[i].rating ?? 0,
        reasoning: raw.slice(0, 200),
      };
    }
  }

  return {
    chosenProduct: "Parse Error",
    chosenBrand: "Unknown",
    chosenPosition: 0,
    chosenProductId: 0,
    chosenPrice: 0,
    chosenRating: 0,
    reasoning: raw.slice(0, 200),
  };
}

function parseManipulationCheck(raw: string, targetProductId: number): ManipulationCheck {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*?"noticed_any_cues"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const cues = parsed.cues_noticed || [];
      const mentionedTarget = cues.find((c: any) =>
        c.product_number != null
      );
      return {
        noticed: parsed.noticed_any_cues === true,
        mentionedBadgeType: mentionedTarget?.cue_type || "",
        mentionedProductId: mentionedTarget?.product_number || 0,
        rawResponse: raw,
      };
    }
  } catch {}

  return {
    noticed: raw.toLowerCase().includes("yes") || raw.toLowerCase().includes("noticed"),
    mentionedBadgeType: "",
    mentionedProductId: 0,
    rawResponse: raw,
  };
}
