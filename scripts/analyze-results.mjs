/**
 * Run full analysis on Study 1 results
 * Usage: node scripts/analyze-results.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const jsonlPath = path.join(ROOT, "results/study1/experiment_2026-03-05T11-20-04.jsonl");
const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").map(l => JSON.parse(l));

console.log("=".repeat(70));
console.log("  STUDY 1 ANALYSIS — 360 Trials (GPT-4o Mini)");
console.log("=".repeat(70));
console.log(`\nTotal: ${lines.length} trials | Hits: ${lines.filter(t=>t.choseTarget).length}/${lines.length} (${(lines.filter(t=>t.choseTarget).length/lines.length*100).toFixed(1)}%)`);
console.log(`Baseline (1/8): 12.5%\n`);

// ── By Condition ──
console.log("── Selection Rate by Condition ──");
const conditions = ["control","scarcity","social_proof","urgency","authority","price_anchoring"];
const condStats = {};
for (const c of conditions) {
  const sub = lines.filter(t => t.condition === c);
  const hits = sub.filter(t => t.choseTarget).length;
  condStats[c] = { n: sub.length, hits, rate: hits/sub.length };
  console.log(`  ${c.padEnd(20)} ${(hits/sub.length*100).toFixed(1)}% (${hits}/${sub.length})`);
}

// ── By Agency ──
console.log("\n── Selection Rate by Agency ──");
for (const a of ["vague","moderate","specific"]) {
  const sub = lines.filter(t => t.agency === a);
  const hits = sub.filter(t => t.choseTarget).length;
  console.log(`  ${a.padEnd(20)} ${(hits/sub.length*100).toFixed(1)}% (${hits}/${sub.length})`);
}

// ── By Input Mode ──
console.log("\n── Selection Rate by Input Mode ──");
for (const m of ["text_json","text_flat","html","screenshot"]) {
  const sub = lines.filter(t => t.inputMode === m);
  const hits = sub.filter(t => t.choseTarget).length;
  console.log(`  ${m.padEnd(20)} ${(hits/sub.length*100).toFixed(1)}% (${hits}/${sub.length})`);
}

// ── Condition × Agency ──
console.log("\n── Condition × Agency (selection rate %) ──");
console.log(`  ${"".padEnd(20)} ${"vague".padEnd(10)} ${"moderate".padEnd(10)} ${"specific".padEnd(10)}`);
for (const c of conditions) {
  const row = ["vague","moderate","specific"].map(a => {
    const sub = lines.filter(t => t.condition === c && t.agency === a);
    return sub.length > 0 ? (sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)+"%" : "N/A";
  });
  console.log(`  ${c.padEnd(20)} ${row[0].padEnd(10)} ${row[1].padEnd(10)} ${row[2].padEnd(10)}`);
}

// ── Condition × Input Mode ──
console.log("\n── Condition × Input Mode (selection rate %) ──");
const modes = ["text_json","text_flat","html","screenshot"];
console.log(`  ${"".padEnd(20)} ${modes.map(m=>m.padEnd(12)).join("")}`);
for (const c of conditions) {
  const row = modes.map(m => {
    const sub = lines.filter(t => t.condition === c && t.inputMode === m);
    return sub.length > 0 ? (sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)+"%" : "N/A";
  });
  console.log(`  ${c.padEnd(20)} ${row.map(r=>r.padEnd(12)).join("")}`);
}

// ── Pairwise: Each vs Control ──
console.log("\n── Pairwise: Each Condition vs Control ──");
const ctrl = condStats.control;
console.log(`  ${"Condition".padEnd(20)} ${"Ctrl".padEnd(8)} ${"Treat".padEnd(8)} ${"Diff".padEnd(8)} ${"Cohen_h".padEnd(8)}`);
for (const c of ["scarcity","social_proof","urgency","authority","price_anchoring"]) {
  const t = condStats[c];
  const diff = t.rate - ctrl.rate;
  const h = 2*Math.asin(Math.sqrt(t.rate)) - 2*Math.asin(Math.sqrt(ctrl.rate));
  console.log(`  ${c.padEnd(20)} ${(ctrl.rate*100).toFixed(1).padEnd(8)} ${(t.rate*100).toFixed(1).padEnd(8)} ${(diff>0?"+":"")+(diff*100).toFixed(1).padEnd(7)} ${h.toFixed(3).padEnd(8)}`);
}

// ── Position Bias ──
console.log("\n── Position Bias ──");
for (let pos = 1; pos <= 8; pos++) {
  const sub = lines.filter(t => t.targetPosition === pos);
  if (sub.length === 0) continue;
  const hits = sub.filter(t => t.choseTarget).length;
  console.log(`  Position ${pos}: ${(hits/sub.length*100).toFixed(1)}% (${hits}/${sub.length})`);
}

// ── Reasoning: keyword mentions ──
console.log("\n── Reasoning: Marketing Keyword Mentions ──");
const keywords = {
  scarcity: ["stock", "left", "remaining", "limited", "sold out"],
  social_proof: ["best seller", "popular", "viewing", "trending", "bestseller", "best-seller"],
  urgency: ["deal ends", "limited time", "countdown", "hurry", "limited-time"],
  authority: ["dermatologist", "clinically", "certified", "recommended", "proven"],
  price_anchoring: ["save", "discount", "special price", "$14.49", "was $", "original price"],
};
for (const [cond, kws] of Object.entries(keywords)) {
  const sub = lines.filter(t => t.condition === cond);
  const mentions = sub.filter(t => kws.some(kw => (t.reasoning||"").toLowerCase().includes(kw)));
  console.log(`  ${cond.padEnd(20)} ${(mentions.length/sub.length*100).toFixed(1)}% mentioned (${mentions.length}/${sub.length})`);
}

// ── Brand Preference ──
console.log("\n── Brand Selection Frequency ──");
const brandCounts = {};
for (const t of lines) { brandCounts[t.chosenBrand] = (brandCounts[t.chosenBrand]||0) + 1; }
const sorted = Object.entries(brandCounts).sort((a,b) => b[1]-a[1]);
for (const [brand, count] of sorted) {
  console.log(`  ${brand.padEnd(25)} ${count} (${(count/lines.length*100).toFixed(1)}%)`);
}

// ── Cost Summary ──
console.log("\n── Cost Summary ──");
const totalCost = lines.reduce((s,t) => s + t.estimatedCostUsd, 0);
const avgLatency = lines.reduce((s,t) => s + t.latencySec, 0) / lines.length;
console.log(`  Total cost: $${totalCost.toFixed(4)}`);
console.log(`  Avg latency: ${avgLatency.toFixed(1)}s`);
console.log(`  Avg input tokens: ${Math.round(lines.reduce((s,t)=>s+t.inputTokens,0)/lines.length)}`);
console.log(`  Avg output tokens: ${Math.round(lines.reduce((s,t)=>s+t.outputTokens,0)/lines.length)}`);

console.log("\n✅ Analysis complete");
