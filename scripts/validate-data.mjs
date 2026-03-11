/**
 * Raw Data Validation — Check all experiment data for issues
 * Usage: node scripts/validate-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadJsonl(filepath) {
  if (!fs.existsSync(filepath)) return [];
  return fs.readFileSync(filepath, "utf-8").trim().split("\n").map((l, i) => {
    try { return JSON.parse(l); }
    catch { console.error(`  ⚠ Parse error line ${i+1} in ${path.basename(filepath)}`); return null; }
  }).filter(Boolean);
}

function validateStudy1(data, label) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}: ${data.length} trials`);
  console.log(`${"═".repeat(60)}`);

  // ── Basic counts ──
  const conditions = [...new Set(data.map(t => t.condition))].sort();
  const agencies = [...new Set(data.map(t => t.agency))].sort();
  const modes = [...new Set(data.map(t => t.inputMode))].sort();
  console.log(`\n  Conditions: ${conditions.join(", ")}`);
  console.log(`  Agencies:   ${agencies.join(", ")}`);
  console.log(`  Modes:      ${modes.join(", ")}`);

  // ── Cell counts ──
  console.log("\n── Cell Counts (condition × agency × mode) ──");
  let missingCells = 0;
  for (const c of conditions) {
    for (const a of agencies) {
      for (const m of modes) {
        const n = data.filter(t => t.condition === c && t.agency === a && t.inputMode === m).length;
        if (n === 0) { console.log(`  ⚠ MISSING: ${c} × ${a} × ${m}`); missingCells++; }
        else if (n < 5) console.log(`  ⚠ LOW: ${c} × ${a} × ${m} = ${n}`);
      }
    }
  }
  if (missingCells === 0) console.log("  ✅ All cells have data");

  // ── Field completeness ──
  console.log("\n── Field Completeness ──");
  const fields = ["trialId","condition","agency","inputMode","model","seed","targetProductId",
    "targetBrand","targetPosition","chosenProductId","chosenBrand","chosenPosition",
    "chosenPrice","chosenRating","choseTarget","reasoning","systemPrompt","userPrompt",
    "rawResponse","inputTokens","outputTokens","estimatedCostUsd","latencySec"];
  for (const f of fields) {
    const missing = data.filter(t => t[f] === undefined || t[f] === null || t[f] === "").length;
    if (missing > 0) console.log(`  ⚠ ${f}: ${missing} missing (${(missing/data.length*100).toFixed(1)}%)`);
  }
  const allPresent = fields.every(f => data.every(t => t[f] !== undefined && t[f] !== null));
  if (allPresent) console.log("  ✅ All required fields present");

  // ── choseTarget validity ──
  console.log("\n── choseTarget Validation ──");
  let mismatch = 0;
  for (const t of data) {
    const expected = t.chosenProductId === t.targetProductId;
    if (t.choseTarget !== expected) {
      console.log(`  ⚠ Trial ${t.trialId}: choseTarget=${t.choseTarget} but chosen=${t.chosenProductId}, target=${t.targetProductId}`);
      mismatch++;
    }
  }
  if (mismatch === 0) console.log("  ✅ All choseTarget values match chosenProductId === targetProductId");

  // ── Position shuffle check ──
  console.log("\n── Position Shuffle ──");
  const uniqueOrders = new Set(data.map(t => JSON.stringify(t.positionOrder)));
  console.log(`  Unique position orders: ${uniqueOrders.size}/${data.length}`);
  // Check that target position varies
  const targetPositions = [...new Set(data.map(t => t.targetPosition))].sort((a,b) => a-b);
  console.log(`  Target positions used: ${targetPositions.join(", ")}`);

  // ── Target rotation ──
  console.log("\n── Target Rotation ──");
  const targetProducts = {};
  for (const t of data) { targetProducts[t.targetProductId] = (targetProducts[t.targetProductId]||0) + 1; }
  for (const [id, count] of Object.entries(targetProducts).sort((a,b) => a[0]-b[0])) {
    console.log(`  Product ${id}: target ${count} times (${(count/data.length*100).toFixed(1)}%)`);
  }

  // ── Marketing message injection check ──
  console.log("\n── Marketing Message Injection ──");
  for (const cond of ["scarcity","social_proof","urgency","authority","price_anchoring"]) {
    const sub = data.filter(t => t.condition === cond);
    if (sub.length === 0) continue;
    
    const keywords = {
      scarcity: "Only 3 left",
      social_proof: "Best Seller",
      urgency: "Deal ends",
      authority: "Dermatologist",
      price_anchoring: "14.49",
    };
    const kw = keywords[cond];
    const hasMessage = sub.filter(t => t.userPrompt.includes(kw) || (t.rawResponse || "").includes(kw));
    const noMessage = sub.length - hasMessage.length;
    if (noMessage > 0) console.log(`  ⚠ ${cond}: ${noMessage}/${sub.length} trials missing "${kw}" in prompt`);
  }
  // Control should have NO marketing messages
  const controlWithMsg = data.filter(t => t.condition === "control").filter(t => 
    t.userPrompt.includes("Only 3 left") || t.userPrompt.includes("Best Seller") ||
    t.userPrompt.includes("Deal ends") || t.userPrompt.includes("Dermatologist") ||
    t.userPrompt.includes("14.49"));
  if (controlWithMsg.length > 0) console.log(`  ⚠ Control: ${controlWithMsg.length} trials have marketing messages!`);
  else console.log("  ✅ Control trials clean (no marketing messages)");

  // ── Parse errors ──
  console.log("\n── Parse Errors ──");
  const parseErrors = data.filter(t => t.chosenProductId === 0 || t.chosenBrand === "Unknown" || t.chosenBrand === "Parse Error");
  console.log(`  Parse errors: ${parseErrors.length}/${data.length} (${(parseErrors.length/data.length*100).toFixed(1)}%)`);

  // ── Chosen product distribution ──
  console.log("\n── Chosen Product Distribution ──");
  const chosenDist = {};
  for (const t of data) { chosenDist[t.chosenBrand] = (chosenDist[t.chosenBrand]||0) + 1; }
  for (const [brand, count] of Object.entries(chosenDist).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${brand.padEnd(25)} ${count} (${(count/data.length*100).toFixed(1)}%)`);
  }

  // ── Cost / Token summary ──
  console.log("\n── Cost & Token Summary ──");
  const totalCost = data.reduce((s,t) => s + (t.estimatedCostUsd||0), 0);
  const avgInput = data.reduce((s,t) => s + t.inputTokens, 0) / data.length;
  const avgOutput = data.reduce((s,t) => s + t.outputTokens, 0) / data.length;
  const avgLatency = data.reduce((s,t) => s + t.latencySec, 0) / data.length;
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Avg input tokens: ${avgInput.toFixed(0)}`);
  console.log(`  Avg output tokens: ${avgOutput.toFixed(0)}`);
  console.log(`  Avg latency: ${avgLatency.toFixed(1)}s`);
  
  // Token breakdown by mode
  console.log("\n  Tokens by Input Mode:");
  for (const m of modes) {
    const sub = data.filter(t => t.inputMode === m);
    const avg = sub.reduce((s,t) => s + t.inputTokens, 0) / sub.length;
    console.log(`    ${m.padEnd(15)} avg input: ${avg.toFixed(0)} tokens`);
  }

  // ── Selection rate summary ──
  console.log("\n── Selection Rate Summary ──");
  console.log(`  Overall: ${data.filter(t=>t.choseTarget).length}/${data.length} (${(data.filter(t=>t.choseTarget).length/data.length*100).toFixed(1)}%)`);
  for (const c of conditions) {
    const sub = data.filter(t => t.condition === c);
    console.log(`  ${c.padEnd(20)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }
}

function validateStudy2(data, label) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}: ${data.length} trials`);
  console.log(`${"═".repeat(60)}`);

  const conditions = [...new Set(data.map(t => t.condition))].sort();
  const modes = [...new Set(data.map(t => t.inputMode))].filter(Boolean).sort();
  console.log(`\n  Conditions: ${conditions.join(", ")}`);
  console.log(`  Input Modes: ${modes.length > 0 ? modes.join(", ") : "(not recorded)"}`);

  // ── Cell counts ──
  if (modes.length > 0) {
    console.log("\n── Cell Counts (condition × mode) ──");
    for (const c of conditions) {
      for (const m of modes) {
        const n = data.filter(t => t.condition === c && t.inputMode === m).length;
        console.log(`  ${c} × ${m}: ${n}`);
      }
    }
  } else {
    console.log("\n── Cell Counts by Condition ──");
    for (const c of conditions) {
      console.log(`  ${c}: ${data.filter(t => t.condition === c).length}`);
    }
  }

  // ── Tool call analysis ──
  console.log("\n── Tool Call Analysis ──");
  const withToolCalls = data.filter(t => t.toolCalls && t.toolCalls.length > 0);
  console.log(`  Trials with toolCalls: ${withToolCalls.length}/${data.length}`);
  
  if (withToolCalls.length > 0) {
    const toolCounts = {};
    for (const t of withToolCalls) {
      for (const tc of t.toolCalls) {
        toolCounts[tc.tool] = (toolCounts[tc.tool]||0) + 1;
      }
    }
    console.log("  Tool usage:");
    for (const [tool, count] of Object.entries(toolCounts).sort((a,b) => b[1]-a[1])) {
      console.log(`    ${tool.padEnd(20)} ${count} calls`);
    }
    
    // Steps distribution
    const steps = withToolCalls.map(t => t.totalSteps || t.toolCalls.length);
    console.log(`\n  Steps: min=${Math.min(...steps)} max=${Math.max(...steps)} avg=${(steps.reduce((s,v)=>s+v,0)/steps.length).toFixed(1)}`);
  }

  // ── Products viewed ──
  console.log("\n── Products Viewed ──");
  const viewedCounts = data.map(t => (t.productsViewed || []).length);
  console.log(`  Avg products viewed: ${(viewedCounts.reduce((s,v)=>s+v,0)/viewedCounts.length).toFixed(1)}`);

  // ── choseTarget validation ──
  console.log("\n── choseTarget Validation ──");
  let mismatch = 0;
  for (const t of data) {
    const expected = t.chosenProductId === t.targetProductId;
    if (t.choseTarget !== expected) { mismatch++; }
  }
  console.log(`  Mismatches: ${mismatch}/${data.length} ${mismatch === 0 ? "✅" : "⚠"}`);

  // ── Selection rate ──
  console.log("\n── Selection Rate ──");
  console.log(`  Overall: ${data.filter(t=>t.choseTarget).length}/${data.length} (${(data.filter(t=>t.choseTarget).length/data.length*100).toFixed(1)}%)`);
  for (const c of conditions) {
    const sub = data.filter(t => t.condition === c);
    console.log(`  ${c.padEnd(20)} ${(sub.filter(t=>t.choseTarget).length/sub.length*100).toFixed(1)}% (${sub.filter(t=>t.choseTarget).length}/${sub.length})`);
  }

  // ── Cost ──
  const totalCost = data.reduce((s,t) => s + (t.estimatedCostUsd||0), 0);
  console.log(`\n  Total cost: $${totalCost.toFixed(4)}`);
}

// ═══ Run ═══

// Study 1 N=5
const s1_pilot = loadJsonl(path.join(ROOT, "results/study1/experiment_2026-03-05T11-20-04.jsonl"));
if (s1_pilot.length > 0) validateStudy1(s1_pilot, "Study 1 Pilot (N=5)");

// Study 1 N=30
const s1_full = loadJsonl(path.join(ROOT, "results/study1/experiment_2026-03-05T13-07-47.jsonl"));
if (s1_full.length > 0) validateStudy1(s1_full, "Study 1 Full (N=30)");

// Study 2 main (3 modes)
const s2_main = loadJsonl(path.join(ROOT, "results/study2/experiment_2026-03-05T15-06-43.jsonl"));
if (s2_main.length > 0) validateStudy2(s2_main, "Study 2 Main (3 modes)");

// Study 2 screenshot attempts
for (const f of ["experiment_screenshot_2026-03-06T00-36-01.jsonl", "experiment_screenshot_2026-03-06T02-25-35.jsonl"]) {
  const data = loadJsonl(path.join(ROOT, "results/study2", f));
  if (data.length > 0) validateStudy2(data, `Study 2 Screenshot (${f})`);
}

console.log("\n\n✅ Validation complete.");
