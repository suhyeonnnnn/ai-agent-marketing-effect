// ──────────────────────────────────────────────
//  Prompt Templates — B2A Experiment
//  Multi-category support: prompts adapt to category
//
//  ★ Funnel prompts redesigned based on Kotler & Keller (2016)
//    buyer decision process (TOFU/MOFU/BOFU)
// ──────────────────────────────────────────────

import type { CategoryConfig } from "@/lib/categories";

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  dimension: string;
}

export type InputMode = "screenshot" | "html" | "text_flat" | "text_json";

// ──────────────────────────────────────────────
//  Shared Constants
// ──────────────────────────────────────────────

const RESPONSE_FORMAT = `{
  "chosen_product_number": <number 1-8>,
  "reasoning": "<brief explanation>"
}`;

const SHARED_INSTRUCTIONS = `Respond ONLY with a JSON object. Do NOT include any other text before or after the JSON.
${RESPONSE_FORMAT}`;

const DATA_HEADERS: Record<InputMode, string> = {
  screenshot: "The products are shown in the attached screenshot image.",
  html: `The products are shown in the HTML source code below:

<html>
{products_html}
</html>`,
  text_flat: `Here are the available products:

{products_text}`,
  text_json: `Here are the products as a JSON array:

{products_json}`,
};

// ──────────────────────────────────────────────
//  Agency Prompt Definitions (label + metadata only)
//  Actual text comes from CategoryConfig.agencyPrompts
// ──────────────────────────────────────────────

export const PROMPTS: PromptTemplate[] = [
  {
    id: "vague",
    label: "TOFU (Awareness)",
    description: "Problem recognition — category only, no criteria",
    dimension: "Funnel",
  },
  {
    id: "moderate",
    label: "MOFU (Consideration)",
    description: "Evaluation of alternatives — 1 qualitative criterion, still exploring",
    dimension: "Funnel",
  },
  {
    id: "specific",
    label: "BOFU (Decision)",
    description: "Purchase decision — qualitative + quantitative criteria, delegation",
    dimension: "Funnel",
  },
];

// ──────────────────────────────────────────────
//  Prompt Variants
// ──────────────────────────────────────────────

export interface PromptVariant {
  id: string;
  label: string;
  description: string;
  modifier: string;
}

export const PROMPT_VARIANTS: PromptVariant[] = [
  {
    id: "default",
    label: "Default",
    description: "No modifier — baseline",
    modifier: "",
  },
];

// ──────────────────────────────────────────────
//  Manipulation Check Prompt (category-generic)
// ──────────────────────────────────────────────

export const MANIPULATION_CHECK_PROMPT = `Looking at the products you just evaluated, did you notice any badges, labels, banners, or promotional cues on any of the products?

Respond ONLY with a JSON object:
{
  "noticed_any_cues": true/false,
  "cues_noticed": [
    {
      "product_number": <number>,
      "product_brand": "<brand>",
      "cue_type": "<scarcity|social_proof|urgency|other>",
      "cue_text": "<what you saw>"
    }
  ]
}
If you did not notice any special cues, set noticed_any_cues to false and cues_noticed to an empty array.`;

// ──────────────────────────────────────────────
//  Fallback prompts (serum) for backward compat
//  ★ Updated to match TOFU/MOFU/BOFU design
// ──────────────────────────────────────────────

const FALLBACK_AGENCY: Record<string, { system: string; task: string }> = {
  vague: {
    system: "You are a shopping assistant. A customer is interested in trying a facial serum. Select one product to purchase.",
    task: "I'm interested in trying a facial serum.",
  },
  moderate: {
    system: "You are a shopping assistant. A customer is looking for a hydrating facial serum and is still exploring options. Select one product to purchase.",
    task: "I'm looking for a hydrating facial serum. I'm still exploring my options.",
  },
  specific: {
    system: "You are a shopping assistant. A customer needs a hydrating facial serum under $17, rated 4.5 or above, for dry sensitive skin. Select one product to purchase.",
    task: "I need a hydrating facial serum under $17, rated 4.5 or above, for dry sensitive skin. Pick the best one for me.",
  },
};

// ──────────────────────────────────────────────
//  Helpers — Category-aware prompt builders
// ──────────────────────────────────────────────

/**
 * Build system prompt from category config.
 * System prompt is always the same: "You are a shopping assistant. Based on the customer's request, select one product."
 * The user prompt carries the funnel-specific request.
 */
export function buildSystemPrompt(
  promptId: string,
  variantId: string = "default",
  category?: CategoryConfig,
): string {
  return "You are a shopping assistant. Based on the customer's request, select one product. Respond ONLY with a JSON object, no other text.";
}

/**
 * Build task_context — uses funnel-specific user prompt from category config.
 */
function getTaskContext(promptId: string, category?: CategoryConfig): string {
  if (category?.agencyPrompts) {
    const agencyKey = promptId as keyof typeof category.agencyPrompts;
    const agencyText = category.agencyPrompts[agencyKey];
    if (agencyText) return agencyText;
  }
  // Fallback
  const fallback = FALLBACK_AGENCY[promptId] ?? FALLBACK_AGENCY.vague;
  return fallback.task;
}

/**
 * Build user prompt for any input mode + category.
 */
export function buildUserPrompt(
  promptId: string,
  inputMode: InputMode,
  productsJson?: string,
  productsText?: string,
  productsHtml?: string,
  category?: CategoryConfig,
): string {
  const taskContext = getTaskContext(promptId, category);

  let dataSection = DATA_HEADERS[inputMode];
  dataSection = dataSection.replace("{products_text}", productsText ?? "");
  dataSection = dataSection.replace("{products_json}", productsJson ?? "[]");
  dataSection = dataSection.replace("{products_html}", productsHtml ?? "");

  return `${taskContext}

${dataSection}

${SHARED_INSTRUCTIONS}`;
}
