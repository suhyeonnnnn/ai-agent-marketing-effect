/**
 * Quick Test: Study 2 — Verbose mode
 * Shows FULL conversation (every message sent/received) for each input mode
 * 
 * Usage:
 *   cd ~/Downloads/b2a-experiment
 *   npm run dev                           # terminal 1
 *   node scripts/quick-test-s2-verbose.mjs # terminal 2
 *
 * Options:
 *   node scripts/quick-test-s2-verbose.mjs text_json     # single mode only
 *   node scripts/quick-test-s2-verbose.mjs screenshot    # single mode only
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) { console.error("❌ .env.local not found"); process.exit(1); }
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("="); process.env[k.trim()] = v.join("=").trim();
  }
}
loadEnv();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error("❌ OPENAI_API_KEY not found"); process.exit(1); }

const BASE_URL = "http://localhost:3000";
const ALL_MODES = ["text_json", "text_flat", "html", "screenshot"];
const MODES = process.argv[2] ? [process.argv[2]] : ALL_MODES;

async function runTrial(params) {
  const res = await fetch(`${BASE_URL}/api/run-study2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ── Pretty print helpers ──

function truncate(str, maxLen = 500) {
  if (!str) return "(empty)";
  if (typeof str !== "string") str = JSON.stringify(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n      ... (${str.length - maxLen} chars truncated)`;
}

function printMessage(msg, index) {
  const role = msg.role?.toUpperCase() || "???";
  const divider = "─".repeat(50);
  
  console.log(`\n  ┌${divider}`);
  console.log(`  │ MESSAGE ${index}: role="${role}"`);
  console.log(`  └${divider}`);
  
  if (role === "SYSTEM") {
    console.log(`  ${msg.content}`);
    return;
  }

  if (role === "USER") {
    if (typeof msg.content === "string") {
      console.log(`  ${msg.content}`);
    } else if (Array.isArray(msg.content)) {
      // Could be tool_results (Anthropic) or image+text (screenshot)
      for (const block of msg.content) {
        if (block.type === "tool_result") {
          const preview = typeof block.content === "string" 
            ? truncate(block.content, 400)
            : Array.isArray(block.content)
              ? block.content.map(c => {
                  if (c.type === "text") return c.text;
                  if (c.type === "image") return `[IMAGE base64, ${c.source?.data?.length || 0} chars]`;
                  return JSON.stringify(c).slice(0, 100);
                }).join(" | ")
              : truncate(JSON.stringify(block.content), 400);
          console.log(`  [TOOL_RESULT for ${block.tool_use_id}]`);
          console.log(`  ${preview}`);
        } else if (block.type === "text") {
          console.log(`  [TEXT] ${block.text}`);
        } else if (block.type === "image_url") {
          const url = block.image_url?.url || "";
          console.log(`  [IMAGE] base64 JPEG (${url.length} chars)`);
        } else {
          console.log(`  [${block.type}] ${truncate(JSON.stringify(block), 200)}`);
        }
      }
    }
    return;
  }

  if (role === "ASSISTANT") {
    // Text content
    if (typeof msg.content === "string" && msg.content) {
      console.log(`  [TEXT] ${truncate(msg.content, 300)}`);
    }
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text" && block.text) {
          console.log(`  [TEXT] ${truncate(block.text, 300)}`);
        } else if (block.type === "tool_use") {
          console.log(`  [TOOL_CALL] ${block.name}(${JSON.stringify(block.input)})`);
          console.log(`    id: ${block.id}`);
        }
      }
    }
    // OpenAI tool_calls
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        console.log(`  [TOOL_CALL] ${tc.function?.name}(${tc.function?.arguments})`);
        console.log(`    id: ${tc.id}`);
      }
    }
    return;
  }

  if (role === "TOOL") {
    console.log(`  [TOOL_RESPONSE] tool_call_id=${msg.tool_call_id}`);
    console.log(`  ${truncate(msg.content, 600)}`);
    return;
  }

  // Fallback
  console.log(`  ${truncate(JSON.stringify(msg), 500)}`);
}

// ── Main ──

async function main() {
  console.log("\n" + "═".repeat(70));
  console.log("  Study 2 Verbose Test — Full Conversation Dump");
  console.log("  Modes: " + MODES.join(", "));
  console.log("═".repeat(70));

  for (const mode of MODES) {
    console.log("\n\n" + "█".repeat(70));
    console.log(`  INPUT MODE: ${mode.toUpperCase()}`);
    console.log("█".repeat(70));

    try {
      const result = await runTrial({
        trialId: Math.floor(Math.random() * 10000),
        categoryId: "serum",
        condition: "social_proof_a",
        agency: "moderate",
        inputMode: mode,
        model: "gpt-4o-mini",
        temperature: 1.0,
        apiKeys: { openai: API_KEY },
      });

      // ── Section 1: Experiment Setup ──
      console.log("\n\n" + "─".repeat(70));
      console.log("  1. EXPERIMENT SETUP");
      console.log("─".repeat(70));
      console.log(`  Category:    serum`);
      console.log(`  Condition:   social_proof_a`);
      console.log(`  Agency:      moderate`);
      console.log(`  Input Mode:  ${mode}`);
      console.log(`  Model:       gpt-4o-mini`);
      console.log(`  Seed:        ${result.seed}`);
      console.log(`  Target:      #${result.targetProductId} ${result.targetBrand} (position ${result.targetPosition})`);
      console.log(`  Position Order: [${result.positionOrder.join(", ")}]`);

      // ── Section 2: Tool Definitions sent to API ──
      console.log("\n\n" + "─".repeat(70));
      console.log("  2. TOOL DEFINITIONS (sent in every API call)");
      console.log("─".repeat(70));
      // Read from the actual TOOL_DEFINITIONS
      const toolDefs = [
        { name: "search", params: { query: "string (required)" } },
        { name: "view_product", params: { product_id: "number (required)" } },
        { name: "read_reviews", params: { product_id: "number (required)" } },
        { name: "select_product", params: { product_id: "number (required)", reasoning: "string (required)" } },
      ];
      for (const td of toolDefs) {
        console.log(`  • ${td.name}(${Object.entries(td.params).map(([k,v]) => `${k}: ${v}`).join(", ")})`);
      }

      // ── Section 3: Full Conversation ──
      console.log("\n\n" + "─".repeat(70));
      console.log("  3. FULL CONVERSATION (rawMessages — exactly what was sent to API)");
      console.log("─".repeat(70));
      
      const msgs = result.rawMessages || [];
      console.log(`  Total messages: ${msgs.length}`);
      
      for (let i = 0; i < msgs.length; i++) {
        printMessage(msgs[i], i);
      }

      // ── Section 4: Tool Call Trajectory ──
      console.log("\n\n" + "─".repeat(70));
      console.log("  4. TOOL CALL TRAJECTORY (step-by-step)");
      console.log("─".repeat(70));
      
      for (const tc of result.toolCalls) {
        console.log(`\n  Step ${tc.step}: ${tc.tool}(${JSON.stringify(tc.args)})`);
        console.log(`  Timestamp: ${tc.timestamp}`);
        console.log(`  Result (full):`);
        // Print full result for non-HTML (HTML is too long)
        if (tc.result.includes("<style>") || tc.result.includes("<div")) {
          console.log(`    [HTML content, ${tc.result.length} chars]`);
          // Show first 200 chars of HTML
          console.log(`    ${tc.result.slice(0, 200)}...`);
        } else {
          console.log(`    ${tc.result}`);
        }
      }

      // ── Section 5: Result Summary ──
      console.log("\n\n" + "─".repeat(70));
      console.log("  5. RESULT SUMMARY");
      console.log("─".repeat(70));
      console.log(`  Chosen:      #${result.chosenProductId} ${result.chosenBrand} (position ${result.chosenPosition})`);
      console.log(`  Hit Target:  ${result.choseTarget ? "🎯 YES" : "❌ NO"}`);
      console.log(`  Reasoning:   ${result.reasoning}`);
      console.log(`  Total Steps: ${result.totalSteps}`);
      console.log(`  Viewed:      [${result.productsViewed.join(", ")}]`);
      console.log(`  Reviews:     [${result.reviewsRead.join(", ")}]`);
      console.log(`  Screenshots: [${(result.screenshotPaths || []).join(", ")}]`);
      console.log(`  Tokens:      ${result.inputTokens} in + ${result.outputTokens} out`);
      console.log(`  Cost:        $${result.estimatedCostUsd?.toFixed(4)}`);
      console.log(`  Time:        ${result.latencySec}s`);

      // Save screenshots from rawMessages if screenshot mode
      if (mode === "screenshot" && result.rawMessages) {
        const ssDir = path.join(ROOT, "results", "study2", "screenshots");
        fs.mkdirSync(ssDir, { recursive: true });
        let ssCount = 0;
        for (const msg of result.rawMessages) {
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "image_url" && block.image_url?.url?.startsWith("data:image/jpeg;base64,")) {
                ssCount++;
                const b64 = block.image_url.url.replace("data:image/jpeg;base64,", "");
                const filename = `s2_verbose_${mode}_t${result.trialId}_img${ssCount}.jpg`;
                fs.writeFileSync(path.join(ssDir, filename), Buffer.from(b64, "base64"));
                console.log(`  📸 Screenshot saved: screenshots/${filename}`);
              }
            }
          }
        }
      }

      // Save full raw result
      const outPath = path.join(ROOT, `results/study2/verbose_test_${mode}.json`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(`\n  📁 Saved: ${outPath}`);

    } catch (err) {
      console.error(`\n  ❌ Error: ${err.message}`);
    }
  }

  console.log("\n\n" + "═".repeat(70));
  console.log("  Done!");
  console.log("═".repeat(70) + "\n");
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
