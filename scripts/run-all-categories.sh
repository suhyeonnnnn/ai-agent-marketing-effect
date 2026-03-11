#!/bin/bash
# ═══════════════════════════════════════════════
#  Run ALL experiments for ALL categories
#  Study 1 (4 modes incl screenshot) + Study 2 (4 modes incl screenshot)
#
#  Usage:
#    cd ~/Downloads/b2a-experiment
#    npm run dev                    # start server in another terminal
#    bash scripts/run-all-categories.sh 30
# ═══════════════════════════════════════════════

REPS=${1:-30}
CATEGORIES=("smartwatch" "milk" "dress")  # serum already done

S1_PER_CAT=$((6*3*4*REPS))  # 6 cond × 3 agency × 4 modes × reps
S2_PER_CAT=$((6*3*4*REPS))  # 6 cond × 3 agency × 4 modes × reps

echo "═══════════════════════════════════════════════"
echo "  Full Multi-Category Experiment"
echo "  Categories: ${CATEGORIES[*]}"
echo "  Study 1: $S1_PER_CAT/cat (incl screenshot)"
echo "  Study 2: $S2_PER_CAT/cat"
echo "  Total: $(( ${#CATEGORIES[@]} * (S1_PER_CAT + S2_PER_CAT) ))"
echo "═══════════════════════════════════════════════"
echo ""

for CAT in "${CATEGORIES[@]}"; do
  echo "════════════════════════════════════════"
  echo "  $CAT — Study 1"
  echo "════════════════════════════════════════"
  node scripts/run-category.mjs "$CAT" "$REPS"
  [ $? -ne 0 ] && echo "❌ $CAT Study 1 failed!" && exit 1

  echo ""
  echo "════════════════════════════════════════"
  echo "  $CAT — Study 2"
  echo "════════════════════════════════════════"
  node scripts/run-study2-category.mjs "$CAT" "$REPS"
  [ $? -ne 0 ] && echo "❌ $CAT Study 2 failed!" && exit 1

  echo "  ✅ $CAT complete. 10s..."
  sleep 10
done

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ ALL COMPLETE!"
echo "═══════════════════════════════════════════════"
ls -la results/study1/*_experiment_*.jsonl results/study2/*_experiment_*.jsonl 2>/dev/null
