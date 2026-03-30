#!/usr/bin/env python3
"""
Export Study 1 JSONL → CSV for run 260314_1
Usage: python3 scripts/export-study1-csv.py
Output: results/260314_1/study1/study1_all.csv
"""

import json
import csv
from pathlib import Path

ROOT = Path(__file__).parent.parent
RUN_ID = "260314_1"
DIR = ROOT / "results" / RUN_ID / "study1"

FILES = {
    "serum":      "serum_experiment_2026-03-14T11-22-18.jsonl",
    "smartwatch": "smartwatch_experiment_2026-03-14T11-50-11.jsonl",
    "milk":       "milk_experiment_2026-03-14T12-19-15.jsonl",
    "dress":      "dress_experiment_2026-03-14T12-47-38.jsonl",
}

COLUMNS = [
    # Experiment metadata
    "trialId", "categoryId", "condition", "agency", "inputMode",
    "model", "seed", "temperature",
    # Target
    "targetProductId", "targetBrand", "targetPosition",
    # Choice (original)
    "chosenProductId", "chosenProduct", "chosenBrand",
    "chosenPosition", "chosenPrice", "chosenRating",
    "choseTarget",
    # Choice (brand-corrected for screenshot mode)
    "correctedProductId", "correctedBrand", "correctedChoseTarget", "correctionMethod",
    # Presentation
    "positionOrder",
    # Reasoning & Raw prompts (newlines escaped to \n for CSV safety)
    "reasoning",
    "systemPrompt",
    "userPrompt",
    "rawResponse",
    # Cost
    "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
    "timestamp",
    # Screenshot path (if screenshot mode)
    "screenshotPath",
]

# ── Brand mappings per category ──
CATEGORY_BRANDS = {
    "serum": {
        "vitality extracts": 1, "vitality": 1,
        "the cr\u00e8me shop": 2, "creme shop": 2, "cr\u00e8me shop": 2,
        "oz naturals": 3,
        "drunk elephant": 4,
        "new york biology": 5,
        "hotmir": 6,
        "honeylab": 7, "honey lab": 7,
        "no7": 8,
    },
    "smartwatch": {},  # TODO: fill from categories.ts if needed
    "milk": {},
    "dress": {},
}

def correct_brand_from_reasoning_s1(d):
    """For screenshot mode: extract brand from reasoning and correct if mismatched."""
    cat = d.get("categoryId", "serum")
    brands = CATEGORY_BRANDS.get(cat, {})
    if not brands:
        # No brand mapping for this category — skip correction
        return d.get("chosenProductId", 0), d.get("chosenBrand", "Unknown"), d.get("choseTarget", False), "no_mapping"
    
    reasoning = str(d.get("reasoning", "")).lower()
    raw_response = str(d.get("rawResponse", "")).lower()
    combined = reasoning + " " + raw_response
    original_id = d.get("chosenProductId", 0)
    
    # Find brand in reasoning (prefer longest match)
    best_id = None
    best_name = None
    for brand_name, brand_id in brands.items():
        if brand_name in combined:
            if best_name is None or len(brand_name) > len(best_name):
                best_id = brand_id
                best_name = brand_name
    
    if best_id is None:
        return original_id, d.get("chosenBrand", "Unknown"), d.get("choseTarget", False), "none"
    
    if original_id == best_id:
        return original_id, d.get("chosenBrand", "Unknown"), d.get("choseTarget", False), "match"
    
    # Mismatch — correct
    target_id = d.get("targetProductId", 0)
    correct_brand = next((b for b, i in brands.items() if i == best_id and len(b) > 3), best_name)
    return best_id, correct_brand.title(), best_id == target_id, "brand_from_reasoning"

def main():
    all_rows = []
    
    for cat, filename in FILES.items():
        fpath = DIR / filename
        if not fpath.exists():
            print(f"  ❌ {fpath} not found")
            continue
        
        lines = [l for l in fpath.read_text(encoding="utf-8").splitlines() if l.strip()]
        data = []
        for line in lines:
            try:
                d = json.loads(line)
                data.append(d)
            except json.JSONDecodeError:
                pass
        
        # Filter out test lines and invalid
        valid = [d for d in data if not d.get("_test") and d.get("chosenProductId") not in (None, 0, -1)]
        
        for d in valid:
            d.setdefault("categoryId", cat)
            # Normalize agency field
            if "agency" not in d and "promptType" in d:
                d["agency"] = d["promptType"]
            # Position order as comma-separated string
            d["positionOrder"] = ",".join(map(str, d.get("positionOrder", [])))
            # Ensure chosenProduct exists
            d.setdefault("chosenProduct", d.get("chosenBrand", ""))
            # Escape newlines in text fields for CSV safety
            for field in ["reasoning", "systemPrompt", "userPrompt", "rawResponse"]:
                if field in d and isinstance(d[field], str):
                    d[field] = d[field].replace('\n', '\\n').replace('\r', '')
            # Brand correction: ONLY for screenshot mode
            if d.get("inputMode") == "screenshot":
                cid, cbrand, ctarget, cmethod = correct_brand_from_reasoning_s1(d)
                d["correctedProductId"] = cid
                d["correctedBrand"] = cbrand
                d["correctedChoseTarget"] = ctarget
                d["correctionMethod"] = cmethod
            else:
                d["correctedProductId"] = d.get("chosenProductId", 0)
                d["correctedBrand"] = d.get("chosenBrand", "Unknown")
                d["correctedChoseTarget"] = d.get("choseTarget", False)
                d["correctionMethod"] = "id_reliable"
        
        all_rows.extend(valid)
        
        # Quick stats
        hits = sum(1 for d in valid if d.get("choseTarget"))
        hit_rate = hits / len(valid) * 100 if valid else 0
        print(f"  ✅ {cat:12s}: {len(valid):4d} trials | hit rate: {hit_rate:.1f}%")
    
    # Write CSV
    out = DIR / "study1_all.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    
    print(f"\n  → {out}")
    print(f"  → {len(all_rows)} rows, {len(COLUMNS)} columns")
    
    # Summary
    print(f"\n  === Summary ===")
    total_hits = sum(1 for d in all_rows if d.get("choseTarget"))
    print(f"  Total: {len(all_rows)} trials")
    print(f"  Hit rate: {total_hits}/{len(all_rows)} = {total_hits/len(all_rows)*100:.1f}%")
    
    # By condition
    print(f"\n  By condition:")
    conds = sorted(set(d.get("condition", "?") for d in all_rows))
    for c in conds:
        subset = [d for d in all_rows if d.get("condition") == c]
        h = sum(1 for d in subset if d.get("choseTarget"))
        print(f"    {c:20s}: {h:4d}/{len(subset):4d} = {h/len(subset)*100:.1f}%")
    
    # By mode
    print(f"\n  By input mode:")
    modes = sorted(set(d.get("inputMode", "?") for d in all_rows))
    for m in modes:
        subset = [d for d in all_rows if d.get("inputMode") == m]
        h = sum(1 for d in subset if d.get("choseTarget"))
        print(f"    {m:12s}: {h:4d}/{len(subset):4d} = {h/len(subset)*100:.1f}%")
    
    # By agency
    print(f"\n  By agency:")
    agencies = sorted(set(d.get("agency", d.get("promptType", "?")) for d in all_rows))
    for a in agencies:
        subset = [d for d in all_rows if d.get("agency", d.get("promptType")) == a]
        h = sum(1 for d in subset if d.get("choseTarget"))
        print(f"    {a:12s}: {h:4d}/{len(subset):4d} = {h/len(subset)*100:.1f}%")

    # Brand correction stats
    corrections = [d for d in all_rows if d.get('correctionMethod') == 'brand_from_reasoning']
    print(f"\n  === Brand Correction (screenshot only) ===")
    print(f"  Corrected: {len(corrections)} / {sum(1 for d in all_rows if d.get('inputMode')=='screenshot')} screenshot trials")
    if corrections:
        flipped = sum(1 for d in corrections if d['correctedChoseTarget'] != d['choseTarget'])
        print(f"  choseTarget flipped: {flipped}")
        by_cat = {}
        for d in corrections:
            c = d.get('categoryId', '?')
            by_cat[c] = by_cat.get(c, 0) + 1
        print(f"  By category: {by_cat}")
        print(f"  Examples:")
        for d in corrections[:5]:
            print(f"    t{d['trialId']} {d['categoryId']}/{d.get('inputMode')}: id {d['chosenProductId']}({d['chosenBrand']}) -> {d['correctedProductId']}({d['correctedBrand']}) target={d['correctedChoseTarget']}")

if __name__ == "__main__":
    main()
