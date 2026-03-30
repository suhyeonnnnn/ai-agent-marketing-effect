#!/usr/bin/env python3
"""
Export Study 2 Serum JSONL → CSV
Usage: python3 scripts/export-study2-serum-csv.py
Output: results/260314_1/study2/study2_serum.csv
"""

import json
import csv
from pathlib import Path

ROOT = Path(__file__).parent.parent
RUN_ID = "260314_1"
DIR = ROOT / "results" / RUN_ID / "study2"
FILE = DIR / "serum_experiment_2026-03-14T06-39-32.jsonl"

COLUMNS = [
    # Experiment metadata
    "trialId", "categoryId", "condition", "agency", "inputMode",
    "model", "seed", "temperature",
    # Target
    "targetProductId", "targetBrand", "targetPosition",
    # Choice (original from agent)
    "chosenProductId", "chosenBrand", "chosenPrice", "chosenPosition", "chosenRating",
    "choseTarget",
    # Choice (brand-corrected for screenshot mode)
    "correctedProductId", "correctedBrand", "correctedChoseTarget", "correctionMethod",
    # Presentation
    "positionOrder",
    # Reasoning
    "reasoning",
    # Agent trajectory
    "totalSteps", "toolCallSequence",
    "searchCount", "viewCount", "reviewCount",
    "productsViewed", "reviewsRead",
    # Funnel
    "attentionActions", "considerationActions", "selectionActions",
    # Cost
    "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
    "timestamp",
    # Screenshots
    "screenshotCount",
    # Raw prompts (short text, safe for CSV)
    "systemPrompt",
    "userPrompt",
    # NOTE: rawMessages and toolCallsDetail are NOT in CSV (too large, breaks Excel).
    # Use the original JSONL file for full conversation data.
    # Rerun flag
    "_rerun",
]

# ── Brand list for correction ──
SERUM_BRANDS = {
    "vitality extracts": 1, "vitality": 1,
    "the crème shop": 2, "creme shop": 2, "crème shop": 2,
    "oz naturals": 3,
    "drunk elephant": 4,
    "new york biology": 5,
    "hotmir": 6,
    "honeylab": 7, "honey lab": 7,
    "no7": 8,
}

def correct_brand_from_reasoning(d):
    """For screenshot mode: extract brand from reasoning text and correct product ID if mismatched."""
    reasoning = str(d.get("reasoning", "")).lower()
    original_id = d.get("chosenProductId", 0)
    original_brand = str(d.get("chosenBrand", "")).lower()
    input_mode = d.get("inputMode", "")
    
    # Also check select_product args in toolCalls for brand mentions
    tool_calls = d.get("toolCalls", [])
    select_reasoning = ""
    for tc in tool_calls:
        if tc.get("tool") == "select_product":
            select_reasoning = str(tc.get("args", {}).get("reasoning", "")).lower()
            break
    
    combined_text = reasoning + " " + select_reasoning
    
    # Find brand mentioned in reasoning
    mentioned_brand_id = None
    mentioned_brand_name = None
    for brand_name, brand_id in SERUM_BRANDS.items():
        if brand_name in combined_text:
            # Prefer longer match (e.g., "the crème shop" over "shop")
            if mentioned_brand_name is None or len(brand_name) > len(mentioned_brand_name):
                mentioned_brand_id = brand_id
                mentioned_brand_name = brand_name
    
    if mentioned_brand_id is None:
        # No brand found in reasoning — keep original
        return original_id, d.get("chosenBrand", "Unknown"), original_id == d.get("targetProductId"), "none"
    
    # Check if original ID matches the mentioned brand
    if original_id == mentioned_brand_id:
        return original_id, d.get("chosenBrand", "Unknown"), original_id == d.get("targetProductId"), "match"
    
    # Mismatch! Use the brand from reasoning
    # Look up correct product info
    correct_id = mentioned_brand_id
    correct_brand = next((b for b, i in SERUM_BRANDS.items() if i == correct_id and len(b) > 3), mentioned_brand_name)
    correct_chose_target = correct_id == d.get("targetProductId")
    
    method = "brand_from_reasoning" if input_mode == "screenshot" else "brand_mismatch"
    return correct_id, correct_brand.title(), correct_chose_target, method


def extract_tool_sequence(d):
    """Extract tool call sequence string from toolCalls array."""
    calls = d.get("toolCalls", [])
    if not calls:
        return ""
    seq = []
    for tc in calls:
        name = tc.get("tool", "")
        if name == "search": seq.append("S")
        elif name == "view_product": seq.append("V")
        elif name == "read_reviews": seq.append("R")
        elif name == "select_product": seq.append("P")
        else: seq.append("?")
    return " -> ".join(seq)

def count_tool(d, tool_name):
    return sum(1 for tc in d.get("toolCalls", []) if tc.get("tool") == tool_name)

def main():
    if not FILE.exists():
        print(f"❌ {FILE} not found")
        return

    lines = [l for l in FILE.read_text(encoding="utf-8").splitlines() if l.strip()]
    data = []
    for line in lines:
        try:
            d = json.loads(line)
            if d.get("_test"):
                continue
            data.append(d)
        except json.JSONDecodeError:
            pass

    valid = [d for d in data if d.get("chosenProductId") not in (None, 0, -1)]

    # Fix missing inputMode on rerun trials (they were all screenshot)
    for d in valid:
        if not d.get("inputMode") and d.get("_rerun"):
            d["inputMode"] = "screenshot"  # all invalid reruns were screenshot mode

    # Dedup: for same trialId+condition+agency+inputMode, keep the latest (last in file)
    # This handles reruns appended to the same JSONL
    seen = {}
    for d in valid:
        key = (d.get("trialId"), d.get("condition"), d.get("agency", d.get("promptType")), d.get("inputMode", "?"))
        seen[key] = d  # last one wins
    valid = list(seen.values())
    print(f"  (dedup: {len(data)} raw -> {len(valid)} unique valid trials)")

    for d in valid:
        d.setdefault("categoryId", "serum")
        d["positionOrder"] = ",".join(map(str, d.get("positionOrder", [])))
        d["toolCallSequence"] = extract_tool_sequence(d)
        d["searchCount"] = count_tool(d, "search")
        d["viewCount"] = count_tool(d, "view_product")
        d["reviewCount"] = count_tool(d, "read_reviews")
        d["productsViewed"] = ",".join(map(str, d.get("productsViewed", [])))
        d["reviewsRead"] = ",".join(map(str, d.get("reviewsRead", [])))
        d["screenshotCount"] = len(d.get("screenshotPaths", []))
        # Clean text fields: replace newlines with spaces for CSV safety
        for field in ["systemPrompt", "userPrompt", "reasoning"]:
            if field in d and isinstance(d[field], str):
                d[field] = d[field].replace('\r\n', ' ').replace('\n', ' ').replace('\r', '')
        d.setdefault("_rerun", False)
        # Brand correction: ONLY for screenshot mode where product_id is unreliable
        if d.get("inputMode") == "screenshot":
            cid, cbrand, ctarget, cmethod = correct_brand_from_reasoning(d)
            d["correctedProductId"] = cid
            d["correctedBrand"] = cbrand
            d["correctedChoseTarget"] = ctarget
            d["correctionMethod"] = cmethod
        else:
            # text_json, text_flat, html: product_id is reliable, no correction needed
            d["correctedProductId"] = d.get("chosenProductId", 0)
            d["correctedBrand"] = d.get("chosenBrand", "Unknown")
            d["correctedChoseTarget"] = d.get("choseTarget", False)
            d["correctionMethod"] = "id_reliable"

    # Write CSV — use QUOTE_ALL to prevent JSON content from breaking CSV structure
    out = DIR / "study2_serum.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore", quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(valid)

    print(f"✅ {out}")
    print(f"   {len(valid)} rows, {len(COLUMNS)} columns\n")

    # Summary
    total_hits = sum(1 for d in valid if d.get("choseTarget"))
    print(f"  Total: {len(valid)} trials")
    print(f"  Hit rate: {total_hits}/{len(valid)} = {total_hits/len(valid)*100:.1f}%")
    print(f"  Avg steps: {sum(d.get('totalSteps',0) for d in valid)/len(valid):.1f}")
    print(f"  Avg cost: ${sum(d.get('estimatedCostUsd',0) for d in valid)/len(valid):.4f}")

    print(f"\n  By condition:")
    for c in sorted(set(d.get("condition","?") for d in valid)):
        s = [d for d in valid if d.get("condition") == c]
        h = sum(1 for d in s if d.get("choseTarget"))
        print(f"    {c:20s}: {h:3d}/{len(s):3d} = {h/len(s)*100:.1f}%")

    print(f"\n  By input mode:")
    mode_set = sorted(set(d.get("inputMode","?") for d in valid))
    for m in mode_set:
        s = [d for d in valid if d.get("inputMode") == m]
        if not s: continue
        h = sum(1 for d in s if d.get("choseTarget"))
        steps = sum(d.get("totalSteps",0) for d in s)/len(s)
        print(f"    {m:12s}: {h:3d}/{len(s):3d} = {h/len(s)*100:.1f}%  (avg {steps:.1f} steps)")
    # Diagnose missing/empty inputMode
    missing_mode = [d for d in valid if not d.get("inputMode")]
    if missing_mode:
        print(f"\n  ⚠️  {len(missing_mode)} trials with missing inputMode:")
        for d in missing_mode[:5]:
            print(f"    t{d.get('trialId')} cond={d.get('condition')} agency={d.get('agency')} _rerun={d.get('_rerun')}")
        print(f"    (showing first 5)" if len(missing_mode)>5 else "")

    print(f"\n  By agency:")
    for a in sorted(set(d.get("agency","?") for d in valid)):
        s = [d for d in valid if d.get("agency") == a]
        h = sum(1 for d in s if d.get("choseTarget"))
        print(f"    {a:12s}: {h:3d}/{len(s):3d} = {h/len(s)*100:.1f}%")

    print(f"\n  Rerun trials: {sum(1 for d in valid if d.get('_rerun'))}")

    # Brand correction stats
    corrections = [d for d in valid if d.get('correctionMethod') in ('brand_from_reasoning', 'brand_mismatch')]
    print(f"\n  === Brand Correction ===")
    print(f"  Corrected: {len(corrections)} trials")
    if corrections:
        flipped = sum(1 for d in corrections if d['correctedChoseTarget'] != d['choseTarget'])
        print(f"  choseTarget flipped: {flipped}")
        by_mode = {}
        for d in corrections:
            m = d.get('inputMode', '?')
            by_mode[m] = by_mode.get(m, 0) + 1
        print(f"  By mode: {by_mode}")
        # Show some examples
        print(f"  Examples:")
        for d in corrections[:5]:
            print(f"    t{d['trialId']} {d['inputMode']}: id {d['chosenProductId']}({d['chosenBrand']}) -> {d['correctedProductId']}({d['correctedBrand']}) target={d['correctedChoseTarget']}")

if __name__ == "__main__":
    main()
