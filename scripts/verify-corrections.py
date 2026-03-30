#!/usr/bin/env python3
"""
Verify brand corrections by showing reasoning text alongside original vs corrected.
Run: python3 scripts/verify-corrections.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
RUN_ID = "260314_1"

# ── Brand mappings ──
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
ID_TO_BRAND = {1:"Vitality Extracts", 2:"The Crème Shop", 3:"OZ Naturals",
               4:"Drunk Elephant", 5:"New York Biology", 6:"Hotmir", 7:"HoneyLab", 8:"No7"}

def find_all_brands_in_text(text):
    """Find ALL brands mentioned in text, with their positions."""
    text_lower = text.lower()
    found = []
    for brand_name, brand_id in SERUM_BRANDS.items():
        pos = text_lower.find(brand_name)
        if pos >= 0:
            found.append((pos, brand_name, brand_id))
    # Deduplicate by brand_id (keep longest match per id)
    by_id = {}
    for pos, name, bid in found:
        if bid not in by_id or len(name) > len(by_id[bid][1]):
            by_id[bid] = (pos, name, bid)
    return sorted(by_id.values(), key=lambda x: x[0])


def analyze_correction(d):
    """Analyze a single trial's correction."""
    reasoning = str(d.get("reasoning", ""))
    original_id = d.get("chosenProductId", 0)
    original_brand = d.get("chosenBrand", "Unknown")
    target_id = d.get("targetProductId", 0)
    
    # Find all brands in reasoning
    brands_in_reasoning = find_all_brands_in_text(reasoning)
    
    # Current correction logic: longest match
    if brands_in_reasoning:
        best = max(brands_in_reasoning, key=lambda x: len(x[1]))
        corrected_id = best[2]
        corrected_brand = ID_TO_BRAND.get(corrected_id, "?")
    else:
        corrected_id = original_id
        corrected_brand = original_brand
    
    return {
        "brands_found": [(ID_TO_BRAND.get(bid, "?"), bid, pos) for pos, name, bid in brands_in_reasoning],
        "corrected_id": corrected_id,
        "corrected_brand": corrected_brand,
        "mismatch": original_id != corrected_id,
    }


def main():
    # ── Study 1 ──
    print("=" * 80)
    print("STUDY 1 — Screenshot Brand Corrections (serum only)")
    print("=" * 80)
    
    s1_file = ROOT / "results" / RUN_ID / "study1" / "serum_experiment_2026-03-14T11-22-18.jsonl"
    s1_data = []
    for line in s1_file.read_text().splitlines():
        if not line.strip(): continue
        try:
            d = json.loads(line)
            if not d.get("_test") and d.get("chosenProductId") not in (None, 0, -1):
                s1_data.append(d)
        except: pass
    
    s1_ss = [d for d in s1_data if d.get("inputMode") == "screenshot"]
    print(f"Total screenshot trials: {len(s1_ss)}\n")
    
    corrections = []
    for d in s1_ss:
        analysis = analyze_correction(d)
        if analysis["mismatch"]:
            corrections.append((d, analysis))
    
    print(f"Corrections needed: {len(corrections)}\n")
    
    # Show each correction
    correct_count = 0
    wrong_count = 0
    ambiguous_count = 0
    
    for d, analysis in corrections:
        tid = d["trialId"]
        orig_id = d["chosenProductId"]
        orig_brand = d.get("chosenBrand", "?")
        corr_id = analysis["corrected_id"]
        corr_brand = analysis["corrected_brand"]
        target_id = d["targetProductId"]
        reasoning = d.get("reasoning", "")[:200]
        brands_found = analysis["brands_found"]
        
        # Determine if correction looks right
        # If only 1 brand found → correction is likely correct
        # If multiple brands → ambiguous
        if len(brands_found) == 1:
            verdict = "✅ LIKELY CORRECT (single brand)"
            correct_count += 1
        elif len(brands_found) > 1:
            verdict = "⚠️  AMBIGUOUS (multiple brands)"
            ambiguous_count += 1
        else:
            verdict = "❓ NO BRAND FOUND"
            wrong_count += 1
        
        print(f"--- t{tid} | {d.get('condition','')} / {d.get('agency',d.get('promptType',''))} ---")
        print(f"  Original:  id={orig_id} ({orig_brand})")
        print(f"  Corrected: id={corr_id} ({corr_brand})")
        print(f"  Target:    id={target_id} ({ID_TO_BRAND.get(target_id,'?')})")
        print(f"  Brands in reasoning: {brands_found}")
        print(f"  Reasoning: {reasoning}")
        print(f"  Verdict: {verdict}")
        print()
    
    print(f"\n{'='*40}")
    print(f"SUMMARY — Study 1 Screenshot Corrections")
    print(f"{'='*40}")
    print(f"Total corrections: {len(corrections)}")
    print(f"  ✅ Likely correct (single brand): {correct_count}")
    print(f"  ⚠️  Ambiguous (multiple brands):  {ambiguous_count}")
    print(f"  ❓ No brand found:                {wrong_count}")
    
    # ── Study 2 ──
    print(f"\n\n{'='*80}")
    print("STUDY 2 — Screenshot Brand Corrections (serum)")
    print("=" * 80)
    
    s2_file = ROOT / "results" / RUN_ID / "study2" / "serum_experiment_2026-03-14T06-39-32.jsonl"
    s2_data = []
    for line in s2_file.read_text().splitlines():
        if not line.strip(): continue
        try:
            d = json.loads(line)
            if not d.get("_test") and d.get("chosenProductId") not in (None, 0, -1):
                s2_data.append(d)
        except: pass
    
    # Dedup
    seen = {}
    for d in s2_data:
        if not d.get("inputMode") and d.get("_rerun"):
            d["inputMode"] = "screenshot"
        key = (d.get("trialId"), d.get("condition"), d.get("agency", d.get("promptType")), d.get("inputMode", "?"))
        seen[key] = d
    s2_data = list(seen.values())
    
    s2_ss = [d for d in s2_data if d.get("inputMode") == "screenshot"]
    print(f"Total screenshot trials: {len(s2_ss)}\n")
    
    corrections2 = []
    for d in s2_ss:
        analysis = analyze_correction(d)
        if analysis["mismatch"]:
            corrections2.append((d, analysis))
    
    print(f"Corrections needed: {len(corrections2)}\n")
    
    correct2 = ambig2 = wrong2 = 0
    for d, analysis in corrections2:
        tid = d["trialId"]
        orig_id = d["chosenProductId"]
        orig_brand = d.get("chosenBrand", "?")
        corr_id = analysis["corrected_id"]
        corr_brand = analysis["corrected_brand"]
        target_id = d["targetProductId"]
        reasoning = d.get("reasoning", "")[:200]
        brands_found = analysis["brands_found"]
        
        if len(brands_found) == 1:
            verdict = "✅ LIKELY CORRECT"; correct2 += 1
        elif len(brands_found) > 1:
            verdict = "⚠️  AMBIGUOUS"; ambig2 += 1
        else:
            verdict = "❓ NO BRAND"; wrong2 += 1
        
        print(f"--- t{tid} | {d.get('condition','')} / {d.get('agency',d.get('promptType',''))} ---")
        print(f"  Original:  id={orig_id} ({orig_brand})")
        print(f"  Corrected: id={corr_id} ({corr_brand})")
        print(f"  Target:    id={target_id} ({ID_TO_BRAND.get(target_id,'?')})")
        print(f"  Brands in reasoning: {brands_found}")
        print(f"  Reasoning: {reasoning}")
        print(f"  Verdict: {verdict}")
        print()
    
    print(f"\n{'='*40}")
    print(f"SUMMARY — Study 2 Screenshot Corrections")
    print(f"{'='*40}")
    print(f"Total corrections: {len(corrections2)}")
    print(f"  ✅ Likely correct (single brand): {correct2}")
    print(f"  ⚠️  Ambiguous (multiple brands):  {ambig2}")
    print(f"  ❓ No brand found:                {wrong2}")


if __name__ == "__main__":
    main()
