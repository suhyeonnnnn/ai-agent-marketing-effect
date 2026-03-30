"""
Human Experiment Data Parser & Analysis
========================================
Reads JSONL log files from /data/human/ and produces analysis-ready CSVs + summary stats.

Usage:
    python scripts/parse_human_data.py

Output:
    data/human/parsed/study1_trials.csv
    data/human/parsed/study2_trials.csv
    data/human/parsed/surveys.csv
    data/human/parsed/summary_stats.txt
"""

import json
import csv
import os
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent.parent / "data" / "human"
OUTPUT_DIR = DATA_DIR / "parsed"


def read_jsonl(filepath: Path) -> list[dict]:
    """Read a JSONL file and return list of dicts."""
    if not filepath.exists():
        print(f"  ⚠ File not found: {filepath}")
        return []
    entries = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"  ⚠ JSON parse error: {e}")
    return entries


def parse_study1():
    """Parse Study 1 trial data into flat CSV."""
    trials = read_jsonl(DATA_DIR / "study1_trial_log.jsonl")
    if not trials:
        return []

    print(f"  Study 1: {len(trials)} trial records")

    fieldnames = [
        "participant_id", "study_id", "session_id",
        "round", "category", "condition",
        "target_product_id", "target_position",
        "selected_product_id", "chose_target",
        "response_time_ms", "timestamp",
    ]

    output = OUTPUT_DIR / "study1_trials.csv"
    with open(output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for t in trials:
            writer.writerow(t)

    print(f"  → Wrote {output}")
    return trials


def parse_study2():
    """Parse Study 2 trial data into flat CSV."""
    trials = read_jsonl(DATA_DIR / "study2_trial_log.jsonl")
    if not trials:
        return []

    print(f"  Study 2: {len(trials)} trial records")

    fieldnames = [
        "participant_id", "study_id", "session_id",
        "round", "category", "condition", "funnel",
        "target_product_id", "target_position",
        "selected_product_id", "chose_target",
        "response_time_ms",
        "products_viewed", "reviews_read", "total_steps",
        "timestamp",
    ]

    output = OUTPUT_DIR / "study2_trials.csv"
    with open(output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for t in trials:
            writer.writerow(t)

    print(f"  → Wrote {output}")
    return trials


def parse_surveys():
    """Parse survey responses into CSV."""
    surveys = read_jsonl(DATA_DIR / "survey_log.jsonl")
    if not surveys:
        return []

    print(f"  Surveys: {len(surveys)} records")

    fieldnames = [
        "participant_id", "study_type",
        "q1_important_factors", "q2_shopping_frequency",
        "q3_age", "q4_gender",
        "q5_attention_check", "attention_check_passed",
        "timestamp",
    ]

    output = OUTPUT_DIR / "surveys.csv"
    with open(output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for s in surveys:
            row = {**s}
            # Convert list to semicolon-separated string
            if isinstance(row.get("q1_important_factors"), list):
                row["q1_important_factors"] = "; ".join(row["q1_important_factors"])
            writer.writerow(row)

    print(f"  → Wrote {output}")
    return surveys


def compute_summary(s1_trials, s2_trials, surveys):
    """Generate summary statistics."""
    lines = []
    lines.append("=" * 60)
    lines.append("  HUMAN EXPERIMENT DATA SUMMARY")
    lines.append("=" * 60)

    # ── Study 1 ──
    if s1_trials:
        lines.append("\n── Study 1: Single-Turn ──")
        pids = set(t["participant_id"] for t in s1_trials)
        lines.append(f"  Participants: {len(pids)}")
        lines.append(f"  Total trials: {len(s1_trials)}")

        # Target selection rate by condition
        cond_stats = defaultdict(lambda: {"total": 0, "hits": 0})
        for t in s1_trials:
            c = t["condition"]
            cond_stats[c]["total"] += 1
            cond_stats[c]["hits"] += t.get("chose_target", 0)

        lines.append(f"\n  Target selection rate by condition:")
        lines.append(f"  {'Condition':<20} {'Trials':>8} {'Hits':>6} {'Rate':>8}")
        lines.append(f"  {'-'*20} {'-'*8} {'-'*6} {'-'*8}")
        for c, s in sorted(cond_stats.items()):
            rate = s["hits"] / s["total"] * 100 if s["total"] > 0 else 0
            lines.append(f"  {c:<20} {s['total']:>8} {s['hits']:>6} {rate:>7.1f}%")

        # By category
        cat_stats = defaultdict(lambda: {"total": 0, "hits": 0})
        for t in s1_trials:
            c = t["category"]
            cat_stats[c]["total"] += 1
            cat_stats[c]["hits"] += t.get("chose_target", 0)

        lines.append(f"\n  Target selection rate by category:")
        for c, s in sorted(cat_stats.items()):
            rate = s["hits"] / s["total"] * 100 if s["total"] > 0 else 0
            lines.append(f"  {c:<20} {s['total']:>8} {s['hits']:>6} {rate:>7.1f}%")

        # Response time
        times = [t["response_time_ms"] for t in s1_trials if t.get("response_time_ms")]
        if times:
            lines.append(f"\n  Response time (ms): mean={sum(times)/len(times):.0f}, "
                        f"median={sorted(times)[len(times)//2]:.0f}, "
                        f"min={min(times)}, max={max(times)}")

    # ── Study 2 ──
    if s2_trials:
        lines.append("\n── Study 2: Multi-Step Browsing ──")
        pids = set(t["participant_id"] for t in s2_trials)
        lines.append(f"  Participants: {len(pids)}")
        lines.append(f"  Total trials: {len(s2_trials)}")

        # By condition
        cond_stats = defaultdict(lambda: {"total": 0, "hits": 0})
        for t in s2_trials:
            c = t["condition"]
            cond_stats[c]["total"] += 1
            cond_stats[c]["hits"] += t.get("chose_target", 0)

        lines.append(f"\n  Target selection rate by condition:")
        lines.append(f"  {'Condition':<20} {'Trials':>8} {'Hits':>6} {'Rate':>8}")
        lines.append(f"  {'-'*20} {'-'*8} {'-'*6} {'-'*8}")
        for c, s in sorted(cond_stats.items()):
            rate = s["hits"] / s["total"] * 100 if s["total"] > 0 else 0
            lines.append(f"  {c:<20} {s['total']:>8} {s['hits']:>6} {rate:>7.1f}%")

        # By funnel
        funnel_stats = defaultdict(lambda: {"total": 0, "hits": 0})
        for t in s2_trials:
            f = t.get("funnel", "unknown")
            funnel_stats[f]["total"] += 1
            funnel_stats[f]["hits"] += t.get("chose_target", 0)

        lines.append(f"\n  Target selection rate by funnel:")
        for f, s in sorted(funnel_stats.items()):
            rate = s["hits"] / s["total"] * 100 if s["total"] > 0 else 0
            lines.append(f"  {f:<20} {s['total']:>8} {s['hits']:>6} {rate:>7.1f}%")

        # Browsing depth
        depths = [t.get("products_viewed", 0) for t in s2_trials]
        reviews = [t.get("reviews_read", 0) for t in s2_trials]
        steps = [t.get("total_steps", 0) for t in s2_trials]
        if depths:
            lines.append(f"\n  Products viewed: mean={sum(depths)/len(depths):.1f}")
            lines.append(f"  Reviews read: mean={sum(reviews)/len(reviews):.1f}")
            lines.append(f"  Total steps: mean={sum(steps)/len(steps):.1f}")

    # ── Surveys ──
    if surveys:
        lines.append("\n── Surveys ──")
        lines.append(f"  Total responses: {len(surveys)}")
        passed = sum(1 for s in surveys if s.get("attention_check_passed"))
        lines.append(f"  Attention check passed: {passed}/{len(surveys)} ({passed/len(surveys)*100:.1f}%)")

    # ── Exclusions ──
    if surveys:
        failed_pids = set(s["participant_id"] for s in surveys if not s.get("attention_check_passed"))
        lines.append(f"\n── Exclusion Candidates ──")
        lines.append(f"  Attention check failures: {len(failed_pids)}")

    if s1_trials:
        # Check for speed exclusions (< 20s total across 4 rounds)
        pid_times = defaultdict(int)
        for t in s1_trials:
            pid_times[t["participant_id"]] += t.get("response_time_ms", 0)
        fast_pids = [pid for pid, ms in pid_times.items() if ms < 20000]
        lines.append(f"  Study 1 speed exclusions (<20s total): {len(fast_pids)}")

    if s2_trials:
        pid_times = defaultdict(int)
        for t in s2_trials:
            pid_times[t["participant_id"]] += t.get("response_time_ms", 0)
        fast_pids = [pid for pid, ms in pid_times.items() if ms < 30000]
        lines.append(f"  Study 2 speed exclusions (<30s total): {len(fast_pids)}")

    lines.append("\n" + "=" * 60)

    output = OUTPUT_DIR / "summary_stats.txt"
    text = "\n".join(lines)
    with open(output, "w") as f:
        f.write(text)
    print(f"\n{text}")
    print(f"\n  → Wrote {output}")


def main():
    print("🔬 Parsing Human Experiment Data...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    s1 = parse_study1()
    s2 = parse_study2()
    sv = parse_surveys()

    if not s1 and not s2 and not sv:
        print("\n  No data files found yet. Run experiments first!")
        print(f"  Expected data in: {DATA_DIR}")
        return

    compute_summary(s1, s2, sv)


if __name__ == "__main__":
    main()
