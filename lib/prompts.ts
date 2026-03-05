// ──────────────────────────────────────────────
//  Prompt Templates — B2A Experiment
//  Based on ACES (Fig. 4, 10, 26-29) &
//  Bias Beware (Section 3, App. E)
// ──────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  dimension: string;
  system: string;
  task_context: string;          // agency-specific task framing (shared across all modes)
  user_instructions: string;     // reasoning + JSON format instructions (shared across all modes)
}

export type InputMode = "screenshot" | "html" | "text_flat" | "text_json";

// ──────────────────────────────────────────────
//  Shared Constants
// ──────────────────────────────────────────────

const RESPONSE_FORMAT = `{
  "chosen_product_number": <number 1-8>,
  "chosen_product_name": "<product name>",
  "chosen_brand": "<brand>",
  "reasoning": "<brief explanation>"
}`;

// Shared reasoning + response instructions (identical for ALL modes)
const SHARED_INSTRUCTIONS = `Explain your reasoning briefly, then respond with a JSON object:
${RESPONSE_FORMAT}`;

// Mode-specific data presentation headers (only the data injection part differs)
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
//  Agency Prompts (vague → specific)
// ──────────────────────────────────────────────

export const PROMPTS: PromptTemplate[] = [
  {
    id: "vague",
    label: "Vague (Generic)",
    description: "No specific requirements — maximum agent freedom (ACES default)",
    dimension: "Agency",
    system: `You are a shopping assistant. A customer is looking for a facial serum. They haven't specified particular requirements. Select one product to purchase.`,
    task_context: `Please review the products and select one to purchase.`,
    user_instructions: SHARED_INSTRUCTIONS,
  },

  {
    id: "moderate",
    label: "Moderate (Some preference)",
    description: "Mentions skin concern but no specific brand/price constraint",
    dimension: "Agency",
    system: `You are a shopping assistant. A customer is looking for a hydrating facial serum suitable for dry, sensitive skin. Consider hydration, gentleness, and value. Select one product to purchase.`,
    task_context: `The customer wants a hydrating serum for dry, sensitive skin. Please review the products and select one to purchase.`,
    user_instructions: SHARED_INSTRUCTIONS,
  },

  {
    id: "specific",
    label: "Specific (Constrained)",
    description: "Explicit budget + ingredient + rating constraint",
    dimension: "Agency",
    system: `You are a shopping assistant. A customer needs a hyaluronic acid facial serum under $20 with at least 4.5 stars, suitable for sensitive skin. Select one product that meets these criteria.`,
    task_context: `The customer needs a hyaluronic acid serum under $20, ≥ 4.5 stars, for sensitive skin. Please review the products and select one to purchase.`,
    user_instructions: SHARED_INSTRUCTIONS,
  },
];

// ──────────────────────────────────────────────
//  Prompt Variants (reserved for future robustness checks)
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
//  Manipulation Check Prompt
//  Sent AFTER the main choice to verify the
//  agent perceived the marketing cue
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
//  Helpers
// ──────────────────────────────────────────────

export function buildSystemPrompt(
  promptId: string,
  variantId: string = "default",
): string {
  const prompt = PROMPTS.find((p) => p.id === promptId) ?? PROMPTS[0];
  const variant = PROMPT_VARIANTS.find((v) => v.id === variantId) ?? PROMPT_VARIANTS[0];
  return prompt.system + variant.modifier;
}

/**
 * Build user prompt for any input mode.
 * Structure is always:  task_context → data_header → instructions
 * Only the data_header changes per mode.
 */
export function buildUserPrompt(
  promptId: string,
  inputMode: InputMode,
  productsJson?: string,
  productsText?: string,
  productsHtml?: string,
): string {
  const prompt = PROMPTS.find((p) => p.id === promptId) ?? PROMPTS[0];

  // Get mode-specific data header and fill in product data
  let dataSection = DATA_HEADERS[inputMode];
  dataSection = dataSection.replace("{products_text}", productsText ?? "");
  dataSection = dataSection.replace("{products_json}", productsJson ?? "[]");
  dataSection = dataSection.replace("{products_html}", productsHtml ?? "");

  // Assemble: task_context + data + instructions (same structure for all modes)
  return `${prompt.task_context}

${dataSection}

${prompt.user_instructions}`;
}
