#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  B2A Experiment — Run a single category + study
#
#  Usage:
#    bash scripts/run-single.sh <study> <category> [reps] [concurrency]
#
#  Examples:
#    bash scripts/run-single.sh 1 serum 30 8        # Study 1, serum
#    bash scripts/run-single.sh 2 smartwatch 30 5    # Study 2, smartwatch
#    bash scripts/run-single.sh 1 milk 5 4           # Quick test
# ═══════════════════════════════════════════════════════════════

set -e

STUDY=${1:?"Usage: run-single.sh <1|2> <category> [reps] [concurrency]"}
CAT=${2:?"Usage: run-single.sh <1|2> <category> [reps] [concurrency]"}
REPS=${3:-30}
CONCURRENCY=${4:-8}
export CONCURRENCY

CONDS=8; FUNNELS=4; MODES=4
TRIALS=$((CONDS * FUNNELS * MODES * REPS))

if [[ "$STUDY" == "1" ]]; then
  COST_PER=$(echo "scale=4; 0.0003" | bc)
  SCRIPT="scripts/run-category.mjs"
  LABEL="Study 1 (Single-turn)"
elif [[ "$STUDY" == "2" ]]; then
  COST_PER=$(echo "scale=4; 0.0012" | bc)
  SCRIPT="scripts/run-study2-category.mjs"
  LABEL="Study 2 (Multi-step Agent)"
else
  echo "❌ Study must be 1 or 2"; exit 1
fi

EST_COST=$(printf '%.2f' $(echo "${TRIALS} * ${COST_PER}" | bc))

echo ""
echo "═══════════════════════════════════════════════"
echo "  ${LABEL} — ${CAT^^}"
echo "  ${CONDS}×${FUNNELS}×${MODES}×${REPS} = ${TRIALS} trials"
echo "  Concurrency: ${CONCURRENCY}"
echo "  Est. cost: ~\$${EST_COST}"
echo "═══════════════════════════════════════════════"
echo ""

node "$SCRIPT" "$CAT" "$REPS"
