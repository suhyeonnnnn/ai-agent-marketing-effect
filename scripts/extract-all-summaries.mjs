/**
 * Extract slim CSV from all experiment JSONL files for analysis.
 * Removes huge fields (rawResponse, userPrompt, systemPrompt, rawMessages)
 * 
 * Usage: node scripts/extract-all-summaries.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function jsonlToSlimCsv(jsonlPath, outPath, extraFields = {}) {
  const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").map(l => JSON.parse(l));
  
  // Determine fields based on data
  const isStudy2 = lines[0]?.toolCalls !== undefined;
  
  const rows = lines.map(t => {
    const base = {
      trialId: t.trialId,
      condition: t.condition,
      agency: t.agency || t.promptType || "moderate",
      inputMode: t.inputMode || extraFields.inputMode || "text_json",
      model: t.model,
      seed: t.seed,
      rep: t.rep || 0,
      targetProductId: t.targetProductId,
      targetBrand: t.targetBrand,
      targetPosition: t.targetPosition,
      chosenProductId: t.chosenProductId,
      chosenBrand: t.chosenBrand,
      chosenPosition: t.chosenPosition,
      chosenPrice: t.chosenPrice,
      chosenRating: t.chosenRating,
      choseTarget: t.choseTarget,
      reasoning: (t.reasoning || "").replace(/"/g, '""').replace(/\n/g, ' '),
      inputTokens: t.inputTokens,
      outputTokens: t.outputTokens,
      estimatedCostUsd: t.estimatedCostUsd,
      latencySec: t.latencySec,
    };
    
    if (isStudy2) {
      base.totalSteps = t.totalSteps || 0;
      base.productsViewed = JSON.stringify(t.productsViewed || []);
      base.reviewsRead = JSON.stringify(t.reviewsRead || []);
      base.attentionActions = t.attentionActions || 0;
      base.considerationActions = t.considerationActions || 0;
      base.selectionActions = t.selectionActions || 0;
      // Derive first view rank of target
      const viewOrder = (t.toolCalls || [])
        .filter(c => c.tool === "view_product")
        .map(c => c.args?.product_id)
        .filter((v, i, a) => a.indexOf(v) === i);
      const idx = viewOrder.indexOf(t.targetProductId);
      base.firstViewRankTarget = idx >= 0 ? idx + 1 : "";
      base.uniqueProductsViewed = new Set((t.toolCalls || []).filter(c => c.tool === "view_product").map(c => c.args?.product_id)).size;
      base.uniqueReviewsRead = new Set((t.toolCalls || []).filter(c => c.tool === "read_reviews").map(c => c.args?.product_id)).size;
    }
    
    return base;
  });
  
  const keys = Object.keys(rows[0]);
  const csvLines = [keys.join(",")];
  for (const row of rows) {
    csvLines.push(keys.map(k => {
      const v = row[k];
      if (typeof v === "string") return `"${v}"`;
      if (typeof v === "boolean") return v ? "true" : "false";
      return v ?? "";
    }).join(","));
  }
  
  fs.writeFileSync(outPath, csvLines.join("\n"));
  console.log(`  ✅ ${path.basename(outPath)}: ${rows.length} rows`);
  return rows.length;
}

// ── Study 1 ──
console.log("── Study 1 ──");
const s1Files = [
  "experiment_2026-03-05T11-20-04.jsonl", // N=5 pilot
  "experiment_2026-03-05T13-07-47.jsonl", // N=30 full
];

for (const f of s1Files) {
  const jsonlPath = path.join(ROOT, "results/study1", f);
  if (!fs.existsSync(jsonlPath)) { console.log(`  ⚠ ${f} not found`); continue; }
  const outPath = path.join(ROOT, "results/study1", f.replace(".jsonl", "_slim.csv"));
  jsonlToSlimCsv(jsonlPath, outPath);
}

// ── Study 2 ──
console.log("\n── Study 2 ──");
const s2MainPath = path.join(ROOT, "results/study2/experiment_2026-03-05T15-06-43.jsonl");
if (fs.existsSync(s2MainPath)) {
  jsonlToSlimCsv(s2MainPath, s2MainPath.replace(".jsonl", "_slim.csv"));
}

// Screenshot files
for (const f of ["experiment_screenshot_2026-03-06T00-36-01.jsonl", "experiment_screenshot_2026-03-06T02-25-35.jsonl"]) {
  const p = path.join(ROOT, "results/study2", f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, "utf-8").trim().split("\n");
  if (lines.length < 2) { console.log(`  ⚠ ${f}: only ${lines.length} lines, skipping`); continue; }
  jsonlToSlimCsv(p, p.replace(".jsonl", "_slim.csv"));
}

// ── Merge Study 2 files ──
console.log("\n── Merging Study 2 CSVs ──");
const s2CsvFiles = fs.readdirSync(path.join(ROOT, "results/study2")).filter(f => f.endsWith("_slim.csv"));
if (s2CsvFiles.length > 0) {
  let header = null;
  const allRows = [];
  for (const f of s2CsvFiles) {
    const lines = fs.readFileSync(path.join(ROOT, "results/study2", f), "utf-8").trim().split("\n");
    if (!header) header = lines[0];
    allRows.push(...lines.slice(1));
  }
  const merged = [header, ...allRows].join("\n");
  const mergedPath = path.join(ROOT, "results/study2/study2_all_slim.csv");
  fs.writeFileSync(mergedPath, merged);
  console.log(`  ✅ study2_all_slim.csv: ${allRows.length} total rows`);
}

console.log("\n✅ Done! Ready for analysis.");
