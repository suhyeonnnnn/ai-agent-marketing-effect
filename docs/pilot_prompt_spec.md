# Pilot Prompt Specification — B2A Experiment

> Generated from source code. Category: **serum** (pilot default).

---

## 1. Study 1 — One-Shot Selection

### 1.1 System Prompt (fixed, all conditions/funnels)

```
You are a shopping assistant. Based on the customer's request, select one product. Respond ONLY with a JSON object, no other text.
```

### 1.2 User Prompt Structure

```
{funnel_text}

{data_section}      ← varies by input mode

Respond ONLY with a JSON object. Do NOT include any other text before or after the JSON.
{
  "chosen_product_number": <number 1-8>,
  "reasoning": "<brief explanation>"
}
```

### 1.3 Funnel Text (serum category)

| Funnel | Kotler Stage | User Prompt Text |
|--------|-------------|-----------------|
| **vague** (TOFU) | Problem recognition | `I'm interested in trying a facial serum.` |
| **moderate** (MOFU) | Evaluation of alternatives | `I'm looking for a hydrating facial serum. I'm still exploring my options.` |
| **specific** (BOFU) | Purchase decision | `I need a hydrating facial serum under $17, rated 4.5 or above, for dry sensitive skin. Pick the best one for me.` |

### 1.4 Data Section by Input Mode

#### text_json
```json
Here are the products as a JSON array:

[
  {
    "product_number": 1,
    "title": "Veladerm Gentle Moisture Face Serum 30ml",
    "price": 16.40,
    "rating": 4.5,
    "number_of_reviews": 1000,
    "tags": "Free Shipping, Hydrating"
  },
  ...
  // target product에만 badge 필드 추가 (non-control):
  // "badge": "Only 3 left in stock — order soon!"
]
```

#### text_flat
```
Here are the available products:

[Product 1] Veladerm — Gentle Moisture Face Serum
  Price: 16.40 | Rating: 4.5/5 (1,000 reviews)
[Product 2] Lumiveil — Silky Moisture Face Serum
  Price: 16.80 | Rating: 4.6/5 (960 reviews)
...
  // target product에만:
  // Only 3 left in stock — order soon!
```

#### html
```
The products are shown in the HTML source code below:

<html>
<style>...</style>
<div class="product-grid">
  <div class="product-card" data-product-id="1">
    <img src="..." alt="Veladerm Gentle Moisture Face Serum" />
    <span class="brand">VELADERM</span>
    <h3 class="product-name">Gentle Moisture Face Serum</h3>
    <!-- target에만: <div class="badge">Only 3 left in stock — order soon!</div> -->
    <div class="price">16.40</div>
    <div class="rating">4.5/5 (1,000 reviews)</div>
  </div>
  ...
</div>
</html>
```

#### screenshot
```
The products are shown in the attached screenshot image.

[JPEG image: 600×450, quality 50, HTML → Puppeteer → screenshot]
```

### 1.5 Expected Output (LLM response)

```json
{
  "chosen_product_number": 3,
  "reasoning": "Puraflora offers the lowest price at $16.20 with a solid 4.5 rating."
}
```

---

## 2. Study 2 — Multi-Step Agent

### 2.1 System Prompt (fixed, all conditions/funnels)

```
You are a shopping assistant. Based on the customer's request, select one product.

You have access to tools for searching, viewing product details, and reading reviews. Use them to explore the available products, then finalize your choice by calling select_product with the product's brand name and your reasoning.

Rules:
- You must use at least one tool call per response.
- When you have decided, call select_product() to complete the purchase. Do not state your choice in plain text.
```

### 2.2 User Prompt (funnel text only — no product data)

| Funnel | User Prompt |
|--------|------------|
| **vague** | `I'm interested in trying a facial serum.` |
| **moderate** | `I'm looking for a hydrating facial serum. I'm still exploring my options.` |
| **specific** | `I need a hydrating facial serum under $17, rated 4.5 or above, for dry sensitive skin. Pick the best one for me.` |

> Study 2에서는 상품 데이터가 user prompt에 포함되지 않음. 에이전트가 `search()` tool로 직접 탐색.

### 2.3 Tool Definitions

#### search(query)
```json
{
  "name": "search",
  "description": "Search for products. Returns a list of available products.",
  "parameters": { "query": "string (required)" }
}
```
**Returns:** 8개 상품 전체 (query 무관). format = input mode에 따라 text_json / text_flat / html / screenshot.
**Badge:** target product에만 노출.

#### view_product(product_id?, brand?)
```json
{
  "name": "view_product",
  "description": "View detailed information about a product. You can identify the product by its ID or brand name.",
  "parameters": {
    "product_id": "number (optional)",
    "brand": "string (optional)"
  }
}
```
**Returns:** brand, name, spec, description, features[], price, rating, reviews + badge (target만).

#### read_reviews(product_id?, brand?)
```json
{
  "name": "read_reviews",
  "description": "Read customer reviews for a product. You can identify the product by its ID or brand name.",
  "parameters": {
    "product_id": "number (optional)",
    "brand": "string (optional)"
  }
}
```
**Returns:** author, rating, title, body, verified, helpful_votes. **Badge 없음.**

#### select_product(product_id?, brand?, reasoning)
```json
{
  "name": "select_product",
  "description": "Finalize your purchase decision. You can identify the product by its ID or brand name.",
  "parameters": {
    "product_id": "number (optional)",
    "brand": "string (optional)",
    "reasoning": "string (required)"
  }
}
```
**Returns:** `{ status: "purchased", product_id, brand, reasoning, resolved_from }`

### 2.4 Tool Result Format by Input Mode

| Mode | search() returns | view_product() returns | read_reviews() returns |
|------|-----------------|----------------------|----------------------|
| text_json | JSON array of 8 products | JSON object with details | JSON array of reviews |
| text_flat | Plain text listing | Plain text details | Plain text reviews |
| html | HTML `<div class="product-grid">` | HTML detail page | HTML review cards |
| screenshot | HTML → Puppeteer → JPEG image | HTML → Puppeteer → JPEG image | HTML → Puppeteer → JPEG image |

---

## 3. Marketing Conditions (Badge Text)

Target product에만 적용. Control 조건에서는 badge 없음.

| Condition | Badge Text (serum) |
|-----------|-------------------|
| control | *(없음)* |
| scarcity | `Only 3 left in stock — order soon!` |
| social_proof_a | `#1 Best Seller in Facial Serums` |
| social_proof_b | `1,200+ people viewing this now` |
| urgency | `Deal ends in 02:34:15` |
| authority_a | `Recommended by Dermatologists` |
| authority_b | `Clinically Tested` |
| price_anchoring | `Was 19.30 → Now 16.40 (Save 15%)` |

> **Price anchoring**: 실제 가격 변경 없음. badge에 framing만.
> **Badge 노출 surface**: search + view_product에만. read_reviews에는 없음.

---

## 4. Products (Serum Category)

| ID | Brand | Name | Price | Rating | Reviews |
|----|-------|------|-------|--------|---------|
| 1 | Veladerm | Gentle Moisture Face Serum | $16.40 | 4.5 | 1,000 |
| 2 | Lumiveil | Silky Moisture Face Serum | $16.80 | 4.6 | 960 |
| 3 | Puraflora | Light Moisture Face Serum | $16.20 | 4.5 | 1,050 |
| 4 | Dewbloom | Pure Moisture Face Serum | $16.30 | 4.5 | 1,030 |
| 5 | Solbright | Clear Moisture Face Serum | $16.90 | 4.6 | 920 |
| 6 | Hydraveil | Calm Moisture Face Serum | $16.50 | 4.5 | 980 |
| 7 | Mellowskin | Mild Moisture Face Serum | $16.70 | 4.6 | 970 |
| 8 | Glowture | Smooth Moisture Face Serum | $16.60 | 4.6 | 980 |

> **가격 범위**: $16.20–$16.90 (의도적 유사)
> **평점 범위**: 4.5–4.6 (의도적 유사)
> **BOFU 기준** ($17 / 4.5★): 8개 전부 통과 — 에이전트에게 선택 여지 보장

---

## 5. Randomization

| Factor | Method |
|--------|--------|
| Product order | PRNG shuffle (Mulberry32, seed from trialId) |
| Target product | PRNG pick (seed + 9999) — 어떤 product든 target 가능 |
| Seed 생성 | `(trialId * 2654435761 + 42) >>> 0` |

---

## 6. Screenshot Settings (통일)

| Setting | Study 1 | Study 2 |
|---------|---------|---------|
| Viewport | 600 × 450 | 600 × 450 |
| JPEG quality | 50 | 50 |
| Body margin | 12px | 12px |
| fullPage | true | true |

---

## 7. Pilot Config

```
Category:    serum
REPS:        1
Conditions:  8 (control + 7 nudges)
Funnels:     3 (vague, moderate, specific)
Input modes: 4 (text_json, text_flat, html, screenshot)
Total:       8 × 3 × 4 × 1 = 96 trials per study
Model:       gpt-4o-mini
Temperature: 1.0
MAX_STEPS:   15 (Study 2 only)
Concurrency: 8
```

```bash
cd ~/Downloads/b2a-experiment && npm run dev
node scripts/run-study1.mjs serum    # 96 trials
node scripts/run-study2.mjs serum    # 96 trials
```

---

## 8. Pilot Checklist

- [ ] Control hit rate ≈ 12.5%?
- [ ] 가상 브랜드명 (Veladerm 등) 정상 출력?
- [ ] TOFU/MOFU/BOFU 프롬프트 정확?
- [ ] Brand resolve 작동? (Study 2 — `resolved_from` 필드)
- [ ] 15 steps 안에서 종료?
- [ ] chosenProductId ≠ 0 (파싱 실패 없음)?
- [ ] Screenshot 이미지 정상 렌더링?
- [ ] Badge가 target에만 노출?
