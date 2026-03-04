#!/bin/bash
# Download Amazon Reviews 2023 metadata for multiple categories
# Run from b2a-experiment directory

mkdir -p data/amazon_meta

echo "=== Downloading Amazon Reviews 2023 Metadata ==="
echo ""

# Already have: All_Beauty (meta_All_Beauty.jsonl in project root)
# Copy it to data dir
if [ -f "meta_All_Beauty.jsonl" ]; then
  cp meta_All_Beauty.jsonl data/amazon_meta/
  echo "✓ All_Beauty (already downloaded, copied to data/)"
fi

# Categories to download (diverse & general)
CATEGORIES=(
  "Electronics"
  "Clothing_Shoes_and_Jewelry"
  "Grocery_and_Gourmet_Food"
  "Health_and_Household"
  "Home_and_Kitchen"
  "Sports_and_Outdoors"
  "Toys_and_Games"
  "Cell_Phones_and_Accessories"
)

BASE_URL="https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/main/raw/meta_categories"

for CAT in "${CATEGORIES[@]}"; do
  FILE="meta_${CAT}.jsonl"
  if [ -f "data/amazon_meta/$FILE" ]; then
    echo "✓ $CAT (already exists, skipping)"
  else
    echo "⬇ Downloading $CAT..."
    curl -L -o "data/amazon_meta/$FILE" "${BASE_URL}/${FILE}" 2>&1 | tail -1
    echo "  → $FILE"
  fi
done

echo ""
echo "=== Download Complete ==="
echo "Files in data/amazon_meta/:"
ls -lh data/amazon_meta/*.jsonl 2>/dev/null | awk '{print $5, $NF}'
