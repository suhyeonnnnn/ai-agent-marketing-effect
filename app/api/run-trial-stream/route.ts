import { NextRequest } from "next/server";
import {
  PRODUCTS, productsToJSON, productsToFlatText, estimateCost,
  shufflePositions, pickTargetProduct, generateSeed,
  type Condition, type InputMode,
} from "@/lib/products";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";

// ──────────────────────────────────────────────
//  Run Trial — Streaming (SSE) for Live Experiment
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
    temperature = 1.0,
    seed: explicitSeed,
  } = body;

  // ── Seed & randomization ──
  const seed = explicitSeed ?? generateSeed(trialId);
  const shuffled = shufflePositions(PRODUCTS, seed);
  const positionOrder = shuffled.map((p) => p.id);

  const targetId = explicitTarget ?? pickTargetProduct(seed);
  const targetProduct = PRODUCTS.find((p) => p.id === targetId)!;
  const targetPosition = positionOrder.indexOf(targetId) + 1;

  const systemPrompt = buildSystemPrompt(promptType, promptVariant);
  const productsJson = productsToJSON(shuffled, condition as Condition, targetId);
  const productsText = productsToFlatText(shuffled, condition as Condition, targetId);
  const userPrompt = buildUserPrompt(promptType, inputMode as InputMode, productsJson, productsText);

  const isAnthropic = model.startsWith("claude");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const start = Date.now();
      let fullText = "";
      let inputTokens = 0, outputTokens = 0;

      try {
        if (isAnthropic) {
          const content: any[] = [];
          if (inputMode === "screenshot" && screenshotBase64) {
            content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: screenshotBase64 } });
          }
          content.push({ type: "text", text: userPrompt });

          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model, system: systemPrompt, messages: [{ role: "user", content }],
              temperature, max_tokens: 2048, stream: true,
            }),
          });

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop()!;
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6);
              if (json === "[DONE]") continue;
              try {
                const evt = JSON.parse(json);
                if (evt.type === "content_block_delta" && evt.delta?.text) {
                  fullText += evt.delta.text;
                  send({ type: "token", text: evt.delta.text });
                }
                if (evt.type === "message_delta" && evt.usage) {
                  outputTokens = evt.usage.output_tokens ?? 0;
                }
                if (evt.type === "message_start" && evt.message?.usage) {
                  inputTokens = evt.message.usage.input_tokens ?? 0;
                }
              } catch {}
            }
          }
        } else {
          // OpenAI streaming
          const messages: any[] = [{ role: "system", content: systemPrompt }];
          if (inputMode === "screenshot" && screenshotBase64) {
            messages.push({
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
                { type: "text", text: userPrompt },
              ],
            });
          } else {
            messages.push({ role: "user", content: userPrompt });
          }

          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
            body: JSON.stringify({ model, messages, temperature, max_tokens: 2048, stream: true, stream_options: { include_usage: true } }),
          });

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop()!;
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6);
              if (json === "[DONE]") continue;
              try {
                const evt = JSON.parse(json);
                const delta = evt.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  send({ type: "token", text: delta });
                }
                if (evt.usage) {
                  inputTokens = evt.usage.prompt_tokens ?? inputTokens;
                  outputTokens = evt.usage.completion_tokens ?? outputTokens;
                }
              } catch {}
            }
          }
        }

        // Parse result
        const parsed = parseResponse(fullText, shuffled);
        const totalCost = estimateCost(model, inputTokens, outputTokens);

        send({
          type: "result",
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
          choseTarget: parsed.chosenProductId === targetId,
          reasoning: parsed.reasoning,
          rawResponse: fullText,
          latencySec: Math.round((Date.now() - start) / 100) / 10,
          inputTokens,
          outputTokens,
          estimatedCostUsd: Math.round(totalCost * 100000) / 100000,
          timestamp: new Date().toISOString(),
          positionOrder,
          seed,
          temperature,
          manipulationCheck: null, // Not done in streaming mode
        });
      } catch (err: any) {
        send({ type: "error", message: err.message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

function parseResponse(raw: string, orderedProducts: any[]) {
  try {
    const m = raw.match(/\{[\s\S]*?"chosen_product_number"[\s\S]*?\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      const num = p.chosen_product_number;
      const product = orderedProducts[num - 1];
      return {
        chosenProduct: p.chosen_product_name || product?.name || `Product ${num}`,
        chosenBrand: p.chosen_brand || product?.brand || "Unknown",
        chosenPosition: num,
        chosenProductId: product?.id ?? 0,
        reasoning: p.reasoning || "",
      };
    }
  } catch {}

  for (let i = 0; i < orderedProducts.length; i++) {
    if (raw.includes(orderedProducts[i].brand)) {
      return {
        chosenProduct: orderedProducts[i].name,
        chosenBrand: orderedProducts[i].brand,
        chosenPosition: i + 1,
        chosenProductId: orderedProducts[i].id,
        reasoning: raw.slice(0, 200),
      };
    }
  }

  return { chosenProduct: "Parse Error", chosenBrand: "Unknown", chosenPosition: 0, chosenProductId: 0, reasoning: raw.slice(0, 200) };
}
