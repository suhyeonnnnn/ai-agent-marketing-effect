import { NextRequest, NextResponse } from "next/server";
import { runStudy2Trial } from "@/lib/agent";
import { appendTrial } from "@/lib/server-store";
import type { Condition } from "@/lib/products";

export const maxDuration = 120; // Vercel timeout

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    trialId = 1,
    condition = "control" as Condition,
    model = "gpt-4o-mini",
    temperature = 1.0,
    nudgeSurfaces = ["search", "detail"],
    inputMode = "text_json",
    apiKeys = {},
  } = body;

  try {
    const result = await runStudy2Trial(trialId, condition, model, temperature, nudgeSurfaces, inputMode, undefined, {
      openai: apiKeys.openai || process.env.OPENAI_API_KEY || "",
      anthropic: apiKeys.anthropic || process.env.ANTHROPIC_API_KEY || "",
      gemini: apiKeys.gemini || process.env.GEMINI_API_KEY || "",
    });

    // Server-side auto-save
    appendTrial({ study: 2, ...result });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
