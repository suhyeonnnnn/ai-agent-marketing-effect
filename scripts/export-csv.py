#!/usr/bin/env python3
"""
export-csv.py  —  Study 1 & Study 2 JSONL → CSV exporter

Usage:
  python3 scripts/export-csv.py           # export both
  python3 scripts/export-csv.py --study 1 # study1 only
  python3 scripts/export-csv.py --study 2 # study2 only

Outputs:
  results/study1/study1_all.csv
  results/study2/study2_all.csv
"""

import json
import csv
import argparse
from pathlib import Path

ROOT    = Path(__file__).parent.parent
RESULTS = ROOT / "results"

# ──────────────────────────────────────────────
#  Study 1
# ──────────────────────────────────────────────

STUDY1_FILES = {
    "serum":      "study1/serum_experiment_2026-03-08T16-13-25.jsonl",
    "smartwatch": "study1/smartwatch_experiment_2026-03-08T18-55-29.jsonl",
    "milk":       "study1/milk_experiment_2026-03-08T21-43-44.jsonl",
    "dress":      "study1/dress_experiment_2026-03-09T00-26-27.jsonl",
}

STUDY1_COLUMNS = [
    # Experiment metadata
    "trialId", "categoryId", "condition", "promptType", "promptVariant",
    "inputMode", "model", "seed", "temperature",
    # Target product
    "targetProductId", "targetBrand", "targetPosition",
    # Choice outcome
    "chosenProductId", "chosenProduct", "chosenBrand",
    "chosenPosition", "chosenPrice", "chosenRating",
    "choseTarget",
    # Presentation
    "positionOrder",
    # Prompts & raw output (useful for post-hoc reasoning analysis)
    "systemPrompt", "userPrompt", "rawResponse", "reasoning",
    # Cost / performance
    "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
    "timestamp",
]

def export_study1():
    all_rows = []
    for cat, rel_path in STUDY1_FILES.items():
        fpath = RESULTS / rel_path
        if not fpath.exists():
            print(f"  [SKIP] {fpath} not found")
            continue
        data  = [json.loads(l) for l in fpath.read_text(encoding="utf-8").splitlines() if l.strip()]
        valid = [d for d in data if d.get("chosenProductId") not in (None, 0, -1)]
        for d in valid:
            d.setdefault("categoryId", cat)
            d["positionOrder"] = ",".join(map(str, d.get("positionOrder", [])))
        all_rows.extend(valid)
        print(f"  {cat:12s}: {len(valid):4d} valid / {len(data):4d} total")

    out = RESULTS / "study1" / "study1_all.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=STUDY1_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"  → {out}  ({len(all_rows)} rows)\n")

# ──────────────────────────────────────────────
#  Study 2
# ──────────────────────────────────────────────

STUDY2_FILES = {
    "serum":      "study2/serum_experiment_2026-03-09T02-55-10.jsonl",
    "smartwatch": "study2/smartwatch_experiment_2026-03-09T08-48-01.jsonl",
    "milk":       "study2/milk_experiment_2026-03-09T14-24-31.jsonl",
    "dress":      "study2/dress_experiment_2026-03-09T10-05-00.jsonl",
}

# Tool definitions (same for all trials, included for documentation)
TOOL_DEFINITIONS_STR = json.dumps([
    {"name": "search", "description": "Search for products. Returns a list of available products.", "parameters": {"query": "string", "sort_by": "recommended|price_low|price_high|rating|reviews"}},
    {"name": "filter_by", "description": "Filter products by price or rating.", "parameters": {"max_price": "number", "min_rating": "number"}},
    {"name": "view_product", "description": "View detailed information about a product.", "parameters": {"product_id": "number"}},
    {"name": "read_reviews", "description": "Read customer reviews for a product.", "parameters": {"product_id": "number", "sort_by": "most_helpful|most_recent|highest_rated|lowest_rated"}},
    {"name": "select_product", "description": "Finalize your purchase decision.", "parameters": {"product_id": "number", "reasoning": "string"}},
])

STUDY2_COLUMNS = [
    # Experiment metadata
    "trialId", "categoryId", "condition", "agency", "rep",
    "model", "seed", "temperature",
    # Target product
    "targetProductId", "targetBrand", "targetPosition",
    # Choice outcome
    "chosenProductId", "chosenBrand",
    "chosenPosition", "chosenPrice", "chosenRating",
    "choseTarget",
    # Agent behavior
    "totalSteps",
    "attentionActions", "considerationActions", "selectionActions",
    "productsViewed", "reviewsRead", "filtersUsed",
    # Tool trajectory (sequence of tool calls)
    "toolCallSequence", "toolCallDetails",
    # Presentation
    "positionOrder",
    # Prompts & reasoning
    "toolDefinitions", "systemPrompt", "userPrompt", "reasoning",
    # Cost / performance
    "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
    "timestamp",
]

def export_study2():
    all_rows = []
    for cat, rel_path in STUDY2_FILES.items():
        fpath = RESULTS / rel_path
        if not fpath.exists():
            print(f"  [SKIP] {fpath} not found")
            continue
        data  = [json.loads(l) for l in fpath.read_text(encoding="utf-8").splitlines() if l.strip()]
        valid = [d for d in data if d.get("chosenProductId") not in (None, 0, -1)]
        for d in valid:
            d.setdefault("categoryId", cat)
            # Serialize list fields as comma-separated strings
            d["positionOrder"]  = ",".join(map(str, d.get("positionOrder",  [])))
            d["productsViewed"] = ",".join(map(str, d.get("productsViewed", [])))
            d["reviewsRead"]    = ",".join(map(str, d.get("reviewsRead",    [])))
            d["filtersUsed"]    = ",".join(map(str, d.get("filtersUsed",    [])))
            # Tool trajectory: compact sequence + detailed JSON
            tc = d.get("toolCalls", [])
            d["toolCallSequence"] = " → ".join(f"{c['tool']}({','.join(f'{k}={v}' for k,v in c.get('args',{}).items())})" for c in tc)
            d["toolCallDetails"] = json.dumps([{"step": c["step"], "tool": c["tool"], "args": c["args"]} for c in tc])
            d["toolDefinitions"] = TOOL_DEFINITIONS_STR
        all_rows.extend(valid)
        print(f"  {cat:12s}: {len(valid):4d} valid / {len(data):4d} total")

    out = RESULTS / "study2" / "study2_all.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=STUDY2_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"  → {out}  ({len(all_rows)} rows)\n")

# ──────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export JSONL experiment results to CSV")
    parser.add_argument("--study", choices=["1", "2"], help="Export only one study (default: both)")
    args = parser.parse_args()

    if args.study != "2":
        print("=== Study 1 ===")
        export_study1()
    if args.study != "1":
        print("=== Study 2 ===")
        export_study2()
