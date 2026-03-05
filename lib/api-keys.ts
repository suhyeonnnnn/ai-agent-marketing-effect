const KEY_STORAGE = "b2a-api-keys";

export interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
}

export function getApiKeys(): ApiKeys {
  if (typeof window === "undefined") return { openai: "", anthropic: "", gemini: "" };
  try {
    const stored = localStorage.getItem(KEY_STORAGE);
    return stored ? JSON.parse(stored) : { openai: "", anthropic: "", gemini: "" };
  } catch {
    return { openai: "", anthropic: "", gemini: "" };
  }
}

export function hasAnyKey(): boolean {
  const keys = getApiKeys();
  return !!(keys.openai || keys.anthropic || keys.gemini);
}

export function hasKeyForModel(model: string): boolean {
  const keys = getApiKeys();
  if (model.startsWith("gpt")) return !!keys.openai;
  if (model.startsWith("claude")) return !!keys.anthropic;
  if (model.startsWith("gemini")) return !!keys.gemini;
  return false;
}
