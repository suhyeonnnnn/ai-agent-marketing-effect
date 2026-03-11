import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const jsonlPath = path.join(ROOT, "results/study1/experiment_2026-03-05T11-20-04.jsonl");
const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").map(l => JSON.parse(l));

// Extract only analysis-relevant fields (no huge prompts/responses)
const slim = lines.map(t => ({
  trialId: t.trialId, condition: t.condition, agency: t.agency, inputMode: t.inputMode,
  model: t.model, seed: t.seed, rep: t.rep,
  targetProductId: t.targetProductId, targetBrand: t.targetBrand, targetPosition: t.targetPosition,
  chosenProductId: t.chosenProductId, chosenBrand: t.chosenBrand,
  chosenPosition: t.chosenPosition, chosenPrice: t.chosenPrice, chosenRating: t.chosenRating,
  choseTarget: t.choseTarget, reasoning: t.reasoning,
  inputTokens: t.inputTokens, outputTokens: t.outputTokens,
  estimatedCostUsd: t.estimatedCostUsd, latencySec: t.latencySec,
}));

const outPath = path.join(ROOT, "results/study1/summary_360.csv");

// CSV header
const keys = Object.keys(slim[0]);
const csvLines = [keys.join(",")];
for (const row of slim) {
  csvLines.push(keys.map(k => {
    const v = row[k];
    if (typeof v === "string") return `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(","));
}
fs.writeFileSync(outPath, csvLines.join("\n"));
console.log(`Saved ${slim.length} rows to ${outPath}`);
