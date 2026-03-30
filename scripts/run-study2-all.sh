#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Study 2 — All 4 Categories (Multi-step Agent)
#  8 conditions × 4 funnels × 4 modes × 30 reps = 3,840/category
#  Total: 15,360 trials
#
#  Usage:
#    cd ~/Downloads/b2a-experiment
#    npm run dev                              # Terminal 0 (server)
#    bash scripts/run-study2-all.sh [reps] [concurrency]
# ═══════════════════════════════════════════════════════════════

set -e

REPS=${1:-30}
CONCURRENCY=${2:-5}
RUN_ID=${3:-260314_1}
export CONCURRENCY
export RUN_ID

CATEGORIES=("serum" "smartwatch" "milk" "dress")
PER_CAT=$((8 * 4 * 4 * REPS))
GRAND=$((PER_CAT * 4))

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  STUDY 2 (Multi-step Agent) — ALL CATEGORIES     ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  8 conds × 4 funnels × 4 modes × ${REPS} reps"
echo "║  Per category: ${PER_CAT} trials"
echo "║  Grand total:  ${GRAND} trials"
echo "║  Concurrency:  ${CONCURRENCY}"
echo "║  Est. cost:    ~\$$(printf '%.2f' $(echo "${GRAND} * 0.0012" | bc))"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

START_TIME=$(date +%s)

for CAT in "${CATEGORIES[@]}"; do
  echo ""
  echo "┌─────────────────────────────────────────────┐"
  CAT_UPPER=$(echo "$CAT" | tr '[:lower:]' '[:upper:]')
  echo "│  Study 2 — ${CAT_UPPER} (${PER_CAT} trials)           "
  echo "└─────────────────────────────────────────────┘"
  node scripts/run-study2-category.mjs "$CAT" "$REPS"
  echo "  ✅ ${CAT_UPPER} done. Cooling 5s..."
  sleep 5
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
HOURS=$((ELAPSED / 3600))
MINS=$(( (ELAPSED % 3600) / 60 ))

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  ✅ STUDY 2 ALL COMPLETE!                        ║"
echo "║  Time: ${HOURS}h ${MINS}m (${ELAPSED}s)                        "
echo "╚═══════════════════════════════════════════════════╝"
echo ""
ls -lh results/${RUN_ID}/study2/*_experiment_*.jsonl 2>/dev/null || echo "  (no files)"
