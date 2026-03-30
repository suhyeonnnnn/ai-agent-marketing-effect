#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  B2A Experiment — Full Run (Study 1 + Study 2)
#
#  8 conditions × 3 funnel stages × 4 input modes × 30 reps
#  = 2,880 trials per category per study
#  = 2,880 × 4 categories × 2 studies = 23,040 total trials
#
#  Prerequisites:
#    Terminal 1:  cd ~/Downloads/b2a-experiment && npm run dev
#    Terminal 2:  bash scripts/run-experiment.sh [REPS] [CONCURRENCY]
#
#  Arguments:
#    $1 = REPS per cell (default: 30)
#    $2 = CONCURRENCY (default: 8, use 3-5 for screenshot mode)
#
#  Examples:
#    bash scripts/run-experiment.sh 30 8     # full run
#    bash scripts/run-experiment.sh 5 4      # quick test (5 reps)
#    bash scripts/run-experiment.sh 1 1      # smoke test (1 rep)
#
#  Results:
#    results/study1/{category}_experiment_{timestamp}.jsonl
#    results/study2/{category}_experiment_{timestamp}.jsonl
# ═══════════════════════════════════════════════════════════════

set -e

REPS=${1:-30}
CONCURRENCY=${2:-8}
export CONCURRENCY

CATEGORIES=("serum" "smartwatch" "milk" "dress")

# ── Calculations ──
CONDS=8          # control, scarcity, social_proof_a/b, urgency, authority_a/b, price_anchoring
FUNNELS=4        # vague, moderate, specific, cautious
MODES=4          # text_json, text_flat, html, screenshot

S1_PER_CAT=$((CONDS * FUNNELS * MODES * REPS))
S2_PER_CAT=$((CONDS * FUNNELS * MODES * REPS))
TOTAL_PER_CAT=$((S1_PER_CAT + S2_PER_CAT))
GRAND_TOTAL=$((TOTAL_PER_CAT * ${#CATEGORIES[@]}))

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           B2A EXPERIMENT — FULL RUN                      ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Categories:   ${CATEGORIES[*]}"
echo "║  Design:       ${CONDS} conds × ${FUNNELS} funnels × ${MODES} modes × ${REPS} reps"
echo "║  Study 1:      ${S1_PER_CAT} trials/category (single-turn)"
echo "║  Study 2:      ${S2_PER_CAT} trials/category (multi-step agent)"
echo "║  Per category: ${TOTAL_PER_CAT} trials"
echo "║  Grand total:  ${GRAND_TOTAL} trials"
echo "║  Concurrency:  ${CONCURRENCY}"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Estimated cost (gpt-4o-mini):                           ║"
echo "║    Study 1: ~\$0.0003/trial × ${S1_PER_CAT}×4 = ~\$$(printf '%.2f' $(echo "${S1_PER_CAT} * 4 * 0.0003" | bc))        ║"
echo "║    Study 2: ~\$0.0012/trial × ${S2_PER_CAT}×4 = ~\$$(printf '%.2f' $(echo "${S2_PER_CAT} * 4 * 0.0012" | bc))        ║"
echo "║    Total:   ~\$$(printf '%.2f' $(echo "${S1_PER_CAT} * 4 * 0.0003 + ${S2_PER_CAT} * 4 * 0.0012" | bc))                               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ── Confirm ──
read -p "  Continue? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "  Aborted."
  exit 0
fi

# ── Verify server ──
echo ""
echo "  Checking server at http://localhost:3000 ..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "  ❌ Server not running! Start with: npm run dev"
  exit 1
fi
echo "  ✅ Server OK"
echo ""

START_TIME=$(date +%s)

for CAT in "${CATEGORIES[@]}"; do
  echo ""
  echo "┌─────────────────────────────────────────────┐"
  echo "│  ${CAT^^} — Study 1 (Single-turn)                │"
  echo "│  ${S1_PER_CAT} trials                               │"
  echo "└─────────────────────────────────────────────┘"
  node scripts/run-category.mjs "$CAT" "$REPS"

  echo ""
  echo "┌─────────────────────────────────────────────┐"
  echo "│  ${CAT^^} — Study 2 (Multi-step Agent)           │"
  echo "│  ${S2_PER_CAT} trials                               │"
  echo "└─────────────────────────────────────────────┘"
  node scripts/run-study2-category.mjs "$CAT" "$REPS"

  echo ""
  echo "  ✅ ${CAT^^} complete! Cooling down 10s..."
  sleep 10
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
HOURS=$((ELAPSED / 3600))
MINS=$(( (ELAPSED % 3600) / 60 ))

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ ALL EXPERIMENTS COMPLETE!                            ║"
echo "║  Total time: ${HOURS}h ${MINS}m (${ELAPSED}s)                          ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Output files:                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "  Study 1:"
ls -lh results/study1/*_experiment_*.jsonl 2>/dev/null || echo "    (none)"
echo ""
echo "  Study 2:"
ls -lh results/study2/*_experiment_*.jsonl 2>/dev/null || echo "    (none)"
echo ""
echo "  Next steps:"
echo "    python3 scripts/export-csv.py        # Export to CSV"
echo "    python3 scripts/analyze-all.py       # Run analysis"
