#!/usr/bin/env python3
"""
export-study2-csv.py  —  Study 2 JSONL → CSV exporter (new experiment)

Extracts all useful fields from rawMessages and toolCalls into individual columns.
For screenshot mode: extracts base64 images from rawMessages, saves as JPG files,
and records the file paths in CSV instead of raw base64 data.

Usage:
  python3 scripts/export-study2-csv.py

Outputs:
  results/study2/study2_all.csv
  results/study2/screenshots/s2_{cat}_{cond}_t{id}_img{n}.jpg
"""

import json
import csv
import base64
import os
from pathlib import Path
from datetime import datetime

ROOT    = Path(__file__).parent.parent
RESULTS = ROOT / "results"
SS_DIR  = RESULTS / "study2" / "screenshots"

# ── New experiment files (2026-03-13) ──
STUDY2_FILES = {
    "serum":      "study2/serum_experiment_2026-03-13T14-41-56.jsonl",
    "smartwatch": "study2/smartwatch_experiment_2026-03-13T17-08-11.jsonl",
    "milk":       "study2/milk_experiment_2026-03-13T19-54-05.jsonl",
    "dress":      "study2/dress_experiment_2026-03-13T21-54-36.jsonl",
}

STUDY2_COLUMNS = [
    # ═══ Experiment metadata ═══
    "trialId", "categoryId", "condition", "agency", "inputMode", "rep",
    "model", "seed", "temperature",

    # ═══ Target product ═══
    "targetProductId", "targetBrand", "targetPosition",

    # ═══ Choice outcome ═══
    "chosenProductId", "chosenBrand",
    "chosenPosition", "chosenPrice", "chosenRating",
    "choseTarget",

    # ═══ Agent behavior (summary) ═══
    "totalSteps",
    "attentionActions", "considerationActions", "selectionActions",
    "numProductsViewed", "numReviewsRead",
    "productsViewed", "reviewsRead",

    # ═══ Tool trajectory ═══
    "toolCallSequence",
    "toolCallCount",
    "searchCount",
    "viewCount",
    "reviewCount",
    "parallelCallCount",

    # ═══ Search behavior ═══
    "searchQuery",
    "searchQueryWordCount",

    # ═══ View behavior ═══
    "viewedProductIds",
    "viewedTargetProduct",

    # ═══ Review behavior ═══
    "reviewedProductIds",
    "reviewedTargetProduct",

    # ═══ Selection behavior ═══
    "selectProductId",
    "selectReasoning",
    "selectedFromViewed",
    "selectedFromReviewed",

    # ═══ Conversation structure (from rawMessages) ═══
    "numAssistantTurns",
    "numToolResults",
    "assistantTextBeforeSelect",
    "assistantFinalText",

    # ═══ Timing (from toolCalls timestamps) ═══
    "firstToolTimestamp",
    "lastToolTimestamp",
    "toolDurationSec",

    # ═══ Presentation ═══
    "positionOrder",

    # ═══ Prompts & reasoning ═══
    "systemPrompt", "userPrompt", "reasoning",

    # ═══ Cost / performance ═══
    "latencySec", "inputTokens", "outputTokens", "estimatedCostUsd",
    "timestamp",

    # ═══ Screenshot paths (for screenshot mode) ═══
    "screenshotPaths",       # comma-separated file paths of saved screenshots
    "screenshotCount",       # number of screenshots in this trial

    # ═══ Raw data (JSON strings — images replaced with paths) ═══
    "rawMessages_json",
    "toolCallDetails_json",
]


def save_base64_image(b64_data: str, trial_id: int, img_idx: int, cat: str, condition: str) -> str:
    """Save base64 image to file and return relative path."""
    SS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"s2_{cat}_{condition}_t{trial_id}_img{img_idx}.jpg"
    filepath = SS_DIR / filename
    try:
        # Strip data URL prefix if present
        if b64_data.startswith("data:"):
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        filepath.write_bytes(img_bytes)
        return f"results/study2/screenshots/{filename}"
    except Exception as e:
        return f"[save_error: {e}]"


def process_raw_messages(raw_messages, trial_id, cat, condition):
    """
    Process rawMessages:
    - Extract base64 images → save to file → replace with path
    - Truncate long HTML content
    Returns (cleaned_messages, screenshot_paths)
    """
    cleaned = []
    screenshot_paths = []
    img_idx = 0

    for msg in raw_messages:
        msg_copy = dict(msg)
        content = msg_copy.get("content")

        if isinstance(content, list):
            # user message with image_url items (screenshot mode)
            new_content = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image_url":
                    url = item.get("image_url", {}).get("url", "")
                    if url.startswith("data:") and len(url) > 1000:
                        img_idx += 1
                        saved_path = save_base64_image(url, trial_id, img_idx, cat, condition)
                        screenshot_paths.append(saved_path)
                        new_content.append({
                            "type": "image_url",
                            "image_url": {"url": f"[saved: {saved_path}]"}
                        })
                    else:
                        new_content.append(item)
                else:
                    new_content.append(item)
            msg_copy["content"] = new_content

        elif isinstance(content, str) and len(content) > 5000:
            # Truncate very long HTML tool results
            msg_copy["content"] = content[:2000] + f"\n... [truncated, total {len(content)} chars]"

        cleaned.append(msg_copy)

    return cleaned, screenshot_paths


def extract_fields(d, cat):
    """Extract all useful fields from rawMessages and toolCalls."""
    tc = d.get("toolCalls", [])
    raw = d.get("rawMessages", [])
    trial_id = d.get("trialId", 0)
    condition = d.get("condition", "unknown")

    # ── Tool call counts ──
    tool_names = [c.get("tool", "") for c in tc]
    d["toolCallCount"] = len(tc)
    d["searchCount"] = tool_names.count("search")
    d["viewCount"] = tool_names.count("view_product")
    d["reviewCount"] = tool_names.count("read_reviews")

    # ── Parallel calls ──
    parallel = 0
    for msg in raw:
        if msg.get("role") == "assistant":
            calls = msg.get("tool_calls", [])
            if len(calls) > 1:
                parallel += 1
    d["parallelCallCount"] = parallel

    # ── Search behavior ──
    search_query = ""
    for c in tc:
        if c.get("tool") == "search":
            search_query = c.get("args", {}).get("query", "")
            break
    d["searchQuery"] = search_query
    d["searchQueryWordCount"] = len(search_query.split()) if search_query else 0

    # ── View behavior ──
    viewed_ids = [c["args"]["product_id"] for c in tc if c.get("tool") == "view_product" and "product_id" in c.get("args", {})]
    d["viewedProductIds"] = ",".join(map(str, viewed_ids))
    d["viewedTargetProduct"] = d.get("targetProductId") in viewed_ids

    # ── Review behavior ──
    reviewed_ids = [c["args"]["product_id"] for c in tc if c.get("tool") == "read_reviews" and "product_id" in c.get("args", {})]
    d["reviewedProductIds"] = ",".join(map(str, reviewed_ids))
    d["reviewedTargetProduct"] = d.get("targetProductId") in reviewed_ids

    # ── Selection behavior ──
    select_calls = [c for c in tc if c.get("tool") == "select_product"]
    if select_calls:
        sc = select_calls[-1]
        sel_id = sc.get("args", {}).get("product_id")
        d["selectProductId"] = sel_id
        d["selectReasoning"] = sc.get("args", {}).get("reasoning", "")
        d["selectedFromViewed"] = sel_id in viewed_ids if sel_id else False
        d["selectedFromReviewed"] = sel_id in reviewed_ids if sel_id else False
    else:
        d["selectProductId"] = d.get("chosenProductId")
        d["selectReasoning"] = d.get("reasoning", "")
        d["selectedFromViewed"] = False
        d["selectedFromReviewed"] = False

    # ── Conversation structure ──
    assistant_turns = [m for m in raw if m.get("role") == "assistant"]
    tool_results = [m for m in raw if m.get("role") == "tool"]
    d["numAssistantTurns"] = len(assistant_turns)
    d["numToolResults"] = len(tool_results)

    has_text_with_select = False
    final_text = ""
    if assistant_turns:
        last_assistant = assistant_turns[-1]
        text_content = last_assistant.get("content") or ""
        has_tool_calls = bool(last_assistant.get("tool_calls"))
        if text_content and has_tool_calls:
            has_text_with_select = True
            final_text = text_content[:500]
        elif text_content:
            final_text = text_content[:500]
    d["assistantTextBeforeSelect"] = has_text_with_select
    d["assistantFinalText"] = final_text

    # ── Timing ──
    timestamps = [c.get("timestamp", "") for c in tc if c.get("timestamp")]
    if len(timestamps) >= 2:
        d["firstToolTimestamp"] = timestamps[0]
        d["lastToolTimestamp"] = timestamps[-1]
        try:
            fmt = "%Y-%m-%dT%H:%M:%S.%fZ"
            t1 = datetime.strptime(timestamps[0], fmt)
            t2 = datetime.strptime(timestamps[-1], fmt)
            d["toolDurationSec"] = round((t2 - t1).total_seconds(), 2)
        except:
            d["toolDurationSec"] = ""
    elif len(timestamps) == 1:
        d["firstToolTimestamp"] = timestamps[0]
        d["lastToolTimestamp"] = timestamps[0]
        d["toolDurationSec"] = 0
    else:
        d["firstToolTimestamp"] = ""
        d["lastToolTimestamp"] = ""
        d["toolDurationSec"] = ""

    # ── Tool trajectory ──
    parts = []
    for c in tc:
        tool = c.get("tool", "?")
        args = c.get("args", {})
        if tool == "search":
            parts.append(f'search("{args.get("query", "")}")')
        elif tool == "view_product":
            parts.append(f'view({args.get("product_id", "?")})')
        elif tool == "read_reviews":
            parts.append(f'reviews({args.get("product_id", "?")})')
        elif tool == "select_product":
            parts.append(f'select({args.get("product_id", "?")})')
        else:
            parts.append(f"{tool}()")
    d["toolCallSequence"] = " → ".join(parts)

    # ── List fields ──
    d["positionOrder"] = ",".join(map(str, d.get("positionOrder", [])))
    pv = d.get("productsViewed", [])
    rr = d.get("reviewsRead", [])
    d["productsViewed"] = ",".join(map(str, pv)) if isinstance(pv, list) else str(pv)
    d["reviewsRead"] = ",".join(map(str, rr)) if isinstance(rr, list) else str(rr)
    d["numProductsViewed"] = len(pv) if isinstance(pv, list) else 0
    d["numReviewsRead"] = len(rr) if isinstance(rr, list) else 0

    # ── Raw data: extract screenshots, replace with paths ──
    cleaned_msgs, ss_paths = process_raw_messages(raw, trial_id, cat, condition)
    d["screenshotPaths"] = ",".join(ss_paths) if ss_paths else ""
    d["screenshotCount"] = len(ss_paths)
    d["rawMessages_json"] = json.dumps(cleaned_msgs, ensure_ascii=False)
    d["toolCallDetails_json"] = json.dumps(
        [{"step": c["step"], "tool": c["tool"], "args": c.get("args", {})} for c in tc],
        ensure_ascii=False
    )

    return d


def export_study2():
    all_rows = []
    total_screenshots = 0

    for cat, rel_path in STUDY2_FILES.items():
        fpath = RESULTS / rel_path
        if not fpath.exists():
            print(f"  [SKIP] {fpath} not found")
            continue

        data = []
        for line in fpath.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data.append(json.loads(line))
            except json.JSONDecodeError:
                continue

        valid = [d for d in data if d.get("chosenProductId") not in (None, 0, -1)]

        cat_ss = 0
        for d in valid:
            d.setdefault("categoryId", cat)
            extract_fields(d, cat)
            cat_ss += d.get("screenshotCount", 0)

        all_rows.extend(valid)
        total_screenshots += cat_ss
        print(f"  {cat:12s}: {len(valid):5d} valid / {len(data):5d} total  ({cat_ss} screenshots saved)")

    # Write CSV
    out = RESULTS / "study2" / "study2_all.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=STUDY2_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\n  → {out}")
    print(f"  → {len(all_rows)} rows, {total_screenshots} screenshots saved")

    # ── Quick Summary ──
    print(f"\n{'='*55}")
    print(f"  SUMMARY")
    print(f"{'='*55}")
    hits = sum(1 for r in all_rows if r.get("choseTarget"))
    print(f"  Hit rate: {hits}/{len(all_rows)} ({hits/len(all_rows)*100:.1f}%)")
    total_cost = sum(r.get("estimatedCostUsd", 0) for r in all_rows)
    print(f"  Total cost: ${total_cost:.2f}")

    avg_steps = sum(r.get("totalSteps", 0) for r in all_rows) / len(all_rows)
    avg_viewed = sum(r.get("numProductsViewed", 0) for r in all_rows) / len(all_rows)
    avg_reviewed = sum(r.get("numReviewsRead", 0) for r in all_rows) / len(all_rows)
    print(f"  Avg steps: {avg_steps:.1f}")
    print(f"  Avg products viewed: {avg_viewed:.1f}")
    print(f"  Avg reviews read: {avg_reviewed:.1f}")

    viewed_target = sum(1 for r in all_rows if r.get("viewedTargetProduct"))
    reviewed_target = sum(1 for r in all_rows if r.get("reviewedTargetProduct"))
    print(f"  Viewed target: {viewed_target}/{len(all_rows)} ({viewed_target/len(all_rows)*100:.1f}%)")
    print(f"  Reviewed target: {reviewed_target}/{len(all_rows)} ({reviewed_target/len(all_rows)*100:.1f}%)")
    print(f"  Screenshots: {total_screenshots}")

    # By condition
    print(f"\n── By Condition ──")
    for c in ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"]:
        sub = [r for r in all_rows if r["condition"] == c]
        if not sub: continue
        h = sum(1 for r in sub if r.get("choseTarget"))
        vt = sum(1 for r in sub if r.get("viewedTargetProduct"))
        rt = sum(1 for r in sub if r.get("reviewedTargetProduct"))
        print(f"  {c:20s} hit:{h/len(sub)*100:5.1f}%  viewTarget:{vt/len(sub)*100:4.1f}%  reviewTarget:{rt/len(sub)*100:4.1f}%  (n={len(sub)})")

    # By mode
    print(f"\n── By Input Mode ──")
    for m in ["text_json", "text_flat", "html", "screenshot"]:
        sub = [r for r in all_rows if r.get("inputMode") == m]
        if not sub: continue
        h = sum(1 for r in sub if r.get("choseTarget"))
        avg_s = sum(r.get("totalSteps", 0) for r in sub) / len(sub)
        avg_v = sum(r.get("numProductsViewed", 0) for r in sub) / len(sub)
        avg_r = sum(r.get("numReviewsRead", 0) for r in sub) / len(sub)
        par = sum(r.get("parallelCallCount", 0) for r in sub) / len(sub)
        ss = sum(r.get("screenshotCount", 0) for r in sub)
        print(f"  {m:15s} hit:{h/len(sub)*100:5.1f}%  steps:{avg_s:4.1f}  viewed:{avg_v:3.1f}  reviewed:{avg_r:3.1f}  parallel:{par:3.1f}  ss:{ss}  (n={len(sub)})")

    # By agency
    print(f"\n── By Agency (Funnel) ──")
    for a in ["vague", "moderate", "specific", "cautious"]:
        sub = [r for r in all_rows if r.get("agency") == a]
        if not sub: continue
        h = sum(1 for r in sub if r.get("choseTarget"))
        print(f"  {a:15s} hit:{h/len(sub)*100:5.1f}%  (n={len(sub)})")


if __name__ == "__main__":
    print("=== Study 2 Export ===\n")
    export_study2()
