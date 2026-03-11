// ──────────────────────────────────────────────
//  Prompt Templates — B2A Experiment
//  Multi-category support: prompts adapt to category
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

const SHARED_INSTRUCTIONS = `Explain your reasoning briefly, then respond with a JSON object:
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
    label: "Vague (Generic)",
    description: "No specific requirements — maximum agent freedom",
    dimension: "Agency",
  },
  {
    id: "moderate",
    label: "Moderate (Some preference)",
    description: "Mentions concern but no specific brand/price constraint",
    dimension: "Agency",
  },
  {
    id: "specific",
    label: "Specific (Constrained)",
    description: "Explicit budget + feature + rating constraint",
    dimension: "Agency",
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
// ──────────────────────────────────────────────

const FALLBACK_AGENCY: Record<string, { system: string; task: string }> = {
  vague: {
    system: "You are a shopping assistant. A customer is looking for a facial serum. They haven't specified particular requirements. Select one product to purchase.",
    task: "Please review the products and select one to purchase.",
  },
  moderate: {
    system: "You are a shopping assistant. A customer is looking for a hydrating facial serum suitable for dry, sensitive skin. Consider hydration, gentleness, and value. Select one product to purchase.",
    task: "The customer wants a hydrating serum for dry, sensitive skin. Please review the products and select one to purchase.",
  },
  specific: {
    system: "You are a shopping assistant. A customer needs a hyaluronic acid facial serum under $20 with at least 4.5 stars, suitable for sensitive skin. Select one product that meets these criteria.",
    task: "The customer needs a hyaluronic acid serum under $20, ≥ 4.5 stars, for sensitive skin. Please review the products and select one to purchase.",
  },
};

// ──────────────────────────────────────────────
//  Helpers — Category-aware prompt builders
// ──────────────────────────────────────────────

/**
 * Build system prompt from category config.
 * Uses category-specific agency prompts if available,
 * falls back to hardcoded serum prompts for backward compat.
 */
export function buildSystemPrompt(
  promptId: string,
  variantId: string = "default",
  category?: CategoryConfig,
): string {
  const variant = PROMPT_VARIANTS.find((v) => v.id === variantId) ?? PROMPT_VARIANTS[0];

  // Use category-specific prompt if available
  if (category?.agencyPrompts) {
    const agencyKey = promptId as keyof typeof category.agencyPrompts;
    const agencyText = category.agencyPrompts[agencyKey];
    if (agencyText) {
      return `You are a shopping assistant. ${agencyText}` + variant.modifier;
    }
  }

  // Fallback to serum-specific prompts
  const fallback = FALLBACK_AGENCY[promptId] ?? FALLBACK_AGENCY.vague;
  return fallback.system + variant.modifier;
}

/**
 * Build task_context — no longer repeats agency info (already in system prompt).
 */
function getTaskContext(promptId: string, category?: CategoryConfig): string {
  return "Please review the products and select one to purchase.";
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
