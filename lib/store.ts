// ──────────────────────────────────────────────
//  Results Store — localStorage + export
// ──────────────────────────────────────────────

import type { TrialResult } from "./products";

const STORAGE_KEY = "b2a_experiment_results";

export function loadResults(): TrialResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveResult(result: TrialResult): TrialResult[] {
  const all = loadResults();
  all.push(result);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function saveResults(results: TrialResult[]): void {
  const all = loadResults();
  all.push(...results);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportCSV(results: TrialResult[]): void {
  if (results.length === 0) return;
  const headers = [
    "trialId", "condition", "promptType", "promptVariant", "inputMode", "model",
    "targetProductId", "targetBrand", "targetPosition",
    "chosenProductId", "chosenProduct", "chosenBrand", "chosenPosition", "choseTarget",
    "reasoning", "latencySec",
    "inputTokens", "outputTokens", "estimatedCostUsd",
    "positionOrder", "seed", "temperature",
    "manipCheckNoticed", "manipCheckRaw",
    "timestamp",
  ];
  const rows = results.map((r) =>
    headers.map((h) => {
      let val: any;
      if (h === "positionOrder") val = r.positionOrder?.join(";");
      else if (h === "manipCheckNoticed") val = r.manipulationCheck?.noticed ?? "";
      else if (h === "manipCheckRaw") val = r.manipulationCheck?.rawResponse ?? "";
      else val = (r as any)[h];
      return `"${String(val ?? "").replace(/"/g, '""')}"`;
    })
  );
  const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `b2a_results_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(results: TrialResult[]): void {
  if (results.length === 0) return;
  const data = {
    meta: {
      exportedAt: new Date().toISOString(),
      totalTrials: results.length,
      conditions: [...new Set(results.map((r) => r.condition))],
      promptTypes: [...new Set(results.map((r) => r.promptType))],
      models: [...new Set(results.map((r) => r.model))],
      inputModes: [...new Set(results.map((r) => r.inputMode))],
      uniqueTargets: [...new Set(results.map((r) => r.targetProductId))],
    },
    trials: results,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `b2a_results_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
