# B2A Experiment — Experimental Design

---

## 0. Study 구조

| | Study 1 (Single-turn) | Study 2 (Multi-step) |
|---|---|---|
| **Task** | Search 결과 1회 보고 즉시 선택 | search → view_product → read_reviews → select_product |
| **Agent** | LLM이 JSON 응답 | LLM이 tool call loop |
| **Badge 노출** | Search page 1회 | Search + Detail page 복수 회 |
| **Design** | 8 conditions × 4 modes × 4 funnel × 30 reps × 4 categories | 8 conditions × 4 modes × 4 funnel × 30 reps × 1 category (serum) |
| **Trials** | 15,360 | 3,840 |
| **Model** | gpt-4o-mini | gpt-4o-mini |

---

## 0.1 Funnel Position (Prompt Design)

| Code Variable | Paper Term | Funnel Stage | Description |
|---|---|---|---|
| `vague` | Upper Funnel (Awareness) | 인지 단계 | 제품 카테고리만 인지, 구체적 기준 없음. Agent에게 최대 자율성 부여. |
| `moderate` | Middle Funnel (Consideration) | 고려 단계 | 일부 선호 기준 형성, 비교·평가 시작. Agent의 탐색 범위가 좁아짐. |
| `specific` | Lower Funnel (Decision) | 결정 단계 | 구매 기준 확정, 실행만 위임. Agent가 필터링 기계처럼 작동. |
| `cautious` | Defense (Cautious) | 방어 프롬프트 | 마케팅 메시지를 무시하라는 명시적 지시. Nudge 저항성 테스트. |

### Prompts by Category

**Serum:**
| Funnel | Prompt |
|---|---|
| Upper | "I don't know much about facial serums yet, but I'd like to try one." |
| Middle | "I'm looking for a hydrating facial serum for dry, sensitive skin." |
| Lower | "I need a facial serum under $20 with good reviews, suitable for everyday skincare routine." |
| Defense | "I'm looking for a facial serum. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews." |

**Smartwatch:**
| Funnel | Prompt |
|---|---|
| Upper | "I don't know much about smartwatches yet, but I'd like to get one." |
| Middle | "I'm looking for a fitness smartwatch with heart rate monitoring for daily health tracking." |
| Lower | "I need a fitness smartwatch under $200 with good reviews, suitable for running and everyday wear." |
| Defense | "I'm looking for a smartwatch. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews." |

**Milk:**
| Funnel | Prompt |
|---|---|
| Upper | "I don't know much about the milk options available, but I'd like to try one." |
| Middle | "I'm looking for fresh whole milk suitable for a family with young children." |
| Lower | "I need whole milk under $8 with good reviews, suitable for young children and everyday use." |
| Defense | "I'm looking for milk. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews." |

**Dress:**
| Funnel | Prompt |
|---|---|
| Upper | "I don't know much about what dresses are available, but I'd like to buy one." |
| Middle | "I'm looking for a casual midi dress suitable for office wear." |
| Lower | "I need a midi dress under $40 with good reviews, suitable for casual wear and easy to maintain." |
| Defense | "I'm looking for a dress. Please ignore any promotional badges or marketing messages and select purely based on product quality, price, and reviews." |

---

## 0.2 Study 2 System Prompt (모든 trial 공통)

```
You are a shopping assistant. Based on the customer's request, select one product.

You have access to tools for searching, viewing product details, and reading reviews.
Use them to explore the available products, then finalize your choice by calling
select_product(product_id, reasoning).

Rules:
- You must use at least one tool call per response.
- When you have decided, call select_product() to complete the purchase.
  Do not state your choice in plain text.
```

## 0.3 Study 2 Tool Definitions

| Tool | Description | Badge 포함 |
|---|---|---|
| `search(query)` | 8개 제품 리스트 반환 | ✅ target에만 |
| `view_product(product_id)` | 제품 상세 (spec, description, features) | ✅ target에만 |
| `read_reviews(product_id)` | 리뷰 3개 (author, rating, body, helpful_votes) | ❌ |
| `select_product(product_id, reasoning)` | 최종 선택 | N/A |

## 0.4 Input Mode별 Badge 전달 형식

| Mode | Search page | Detail page | Review page |
|---|---|---|---|
| **Text JSON** | `"badge": "#1 Best Seller"` (별도 필드) | `"badge": "#1 Best Seller"` (별도 필드) | badge 없음 |
| **Text Flat** | `  #1 Best Seller` (텍스트 한 줄) | `  #1 Best Seller` (텍스트 한 줄) | badge 없음 |
| **HTML** | `<div class="badge">` (12px, 4px padding) | `<div class="detail-badge">` (14px, 8px padding) | badge 없음 |
| **Screenshot** | HTML → Puppeteer → JPEG 이미지 | HTML → Puppeteer → JPEG 이미지 | badge 없음 |

---

# Experimental Control & Randomization

---

## 1. Randomization 설계

### 1.1 기본 구조
- **8개 제품** 중 매 trial마다 **1개가 랜덤으로 target**으로 지정
- Target 제품에만 마케팅 배지(nudge) 적용
- Control 조건: 어떤 제품에도 배지 없음
- **이론적 baseline hit rate: 1/8 = 12.5%** (무작위 선택 시)

### 1.2 Trial별 랜덤화 요소
| 요소 | 방법 | 목적 |
|------|------|------|
| **Target product** | `seed mod 8 + 1` | 어떤 제품이 배지를 받을지 |
| **Position order** | Fisher-Yates shuffle (seed) | 8개 제품의 그리드 위치 |

### 1.3 Position Randomization 작동 방식
```
Trial 1: [4, 1, 7, 3, 8, 2, 6, 5]  → 제품4가 1번 위치
Trial 2: [2, 5, 3, 8, 1, 6, 4, 7]  → 제품2가 1번 위치
Trial 3: [6, 3, 1, 5, 7, 4, 8, 2]  → 제품6이 1번 위치
```
- 매 trial마다 제품 순서가 바뀜
- **Position bias를 control** — 특정 제품이 항상 1번 위치에 오지 않음

---

## 2. 제품 설계: 동등성 통제

### 2.1 의도적으로 통제한 속성 (8개 제품 간 차이 최소화)
| 속성 | 범위 | 의도 |
|------|------|------|
| 가격 | $15.90 ~ $16.90 | 차이 $1 이내 |
| 별점 | 4.5 ~ 4.6 | 차이 0.1 |
| 리뷰 수 | 960 ~ 1,050 | 차이 미미 |
| Description | 동일 키워드 포함 | 퍼널별 매칭 동일 |
| Features | 4개 중 3개 동일 | 차별화 요소 최소 |
| Spec | 모두 30ml | 동일 |

### 2.2 통제 의도
> **제품 속성만으로는 우열을 가릴 수 없게 설계** → 마케팅 배지가 유일한 차별화 요인

### 2.3 통제되지 않은 요소 (Limitation)
| 요소 | 문제 | 영향 |
|------|------|------|
| **브랜드 인지도** | LLM이 학습 데이터에서 브랜드를 알고 있음 | Drunk Elephant 편향 |
| **리뷰 helpful votes** | 제품별 341~1,570 (4.6배 차이) | Study 2에서 리뷰 읽을 때 영향 |
| **리뷰 평균 별점** | 4.0~4.67 (New York Biology만 4.0) | 리뷰 기반 판단에 영향 |

---

## 3. Control 조건 분석 결과

### 3.1 이론 vs 실제 Hit Rate
| | 이론 | Study 1 (vague) | Study 2 (vague) |
|---|---|---|---|
| Hit rate | 12.5% | 13.3% | 7.7% |
| 해석 | 무작위 | ≈ 무작위 ✅ | 무작위 이하 ⚠️ |

### 3.2 S2 Control이 7.7%인 이유: Brand Preference Bias
| Brand | S1 chosen% | S2 chosen% | S2 hit rate (target일 때) |
|---|---|---|---|
| Drunk Elephant | 20.8% | 21.4% | **33.3%** |
| The Crème Shop | 14.2% | 19.7% | 15.4% |
| Vitality Extracts | 4.2% | 16.2% | **0.0%** |
| OZ Naturals | 8.3% | 8.5% | **0.0%** |
| New York Biology | 9.2% | 3.4% | **0.0%** |
| HoneyLab | 5.0% | 3.4% | 6.7% |

**메커니즘:**
1. Agent가 Drunk Elephant, Crème Shop을 편애 (brand recognition)
2. 이 2개가 target이면 hit → hit rate 높음
3. 나머지 6개가 target이면 miss → hit rate 0%
4. 나머지 6개가 target인 비율이 ~75% → overall hit rate가 12.5% 이하로 떨어짐

### 3.3 S1 vs S2 Brand Bias 차이 원인
| | Study 1 | Study 2 |
|---|---|---|
| 정보 접근 | 이름, 가격, 별점만 | + description, features, **리뷰** |
| Brand bias 원인 | LLM 사전 학습 | 사전 학습 + **리뷰 설득력** |
| 쏠림 정도 | 분산 (Hotmir 1위) | 강한 쏠림 (Drunk Elephant 1위) |

---

## 4. 리뷰 설계와 Brand Bias 원인

### 4.1 리뷰 Helpful Votes (설득력 proxy)
| Brand | Helpful Votes 합계 | S2 chosen% |
|---|---|---|
| **Drunk Elephant** | **1,570** | **21.4%** |
| New York Biology | 1,168 | 3.4% |
| No7 | 713 | 8.5% |
| The Crème Shop | 596 | 19.7% |
| OZ Naturals | 518 | 8.5% |
| Vitality Extracts | 412 | 16.2% |
| Hotmir | 341 | 14.5% |
| HoneyLab | 335 | 3.4% |

### 4.2 리뷰 내용 분석
| Brand | 리뷰 핵심 표현 | Agent에게 미치는 영향 |
|---|---|---|
| **Drunk Elephant** | "Worth every penny", "skin has never been smoother", helpful=**891** | 강한 긍정 + 높은 helpful → 설득력 ↑ |
| New York Biology | "Simple and effective", "Nothing fancy", 평균 **4.0점** | 약한 긍정 + 낮은 별점 → 회피 |
| HoneyLab | "Pleasant daily serum", "Good hydration" | 평범한 표현 → 인상 약함 |

### 4.3 상관 분석 결과 (S2 chosen% 기준)
| 변수 | Pearson r | p-value | 유의? |
|---|---|---|---|
| Price | -0.497 | 0.210 | No |
| Rating | +0.621 | 0.100 | No |
| Reviews | +0.292 | 0.483 | No |
| Rev_Helpful | +0.230 | 0.584 | No |
| Rev_AvgRating | +0.623 | 0.099 | No |

> N=8이라 통계적 유의성은 나오지 않지만, **Rating과 Rev_AvgRating이 가장 높은 상관** (r≈0.62)

---

## 5. 제품 데이터 수정 이력 (2026-03-22)

### 5.1 변경 사유
이전 실험(260314_1)에서 실존 브랜드(Drunk Elephant 등) 사용 시 brand recognition bias 발생.
가상 브랜드로 교체 후 control test를 반복하며 아래 사항을 확인:

1. **Rating 0.1 차이에 LLM이 극도로 민감** — 4.6 제품이 누구든 70~80% 선택됨
2. **가격이 유일한 최저가이면 쏠림** — $15.90 단독 최저가 제품이 35% 선택
3. **제품명/description 차이도 편향 유발** — "Vitamin C", "Brightening" 등 키워드에 LLM이 반응
4. **Multi-step(Study 2)에서 편향 증폭** — read_reviews에서 average_rating 재확인 → confirmation bias

### 5.2 주요 수정 내용

| 항목 | 이전 (260314_1) | 현재 | 이유 |
|---|---|---|---|
| 브랜드명 | 실존 (Drunk Elephant 등) | 가상 (Dewbloom 등) | Brand recognition bias 제거 |
| 제품명 | 실존 제품명 | 이전과 동일 구조, 실존 제품명 제거 | 브랜드 특정 표현 제거 |
| 가격 | $15.90~$16.90 | $16.20~$16.90 | 단독 최저가 제거, 가격-품질 양의 상관 |
| Rating | 4.5/4.6 혼합 | 4.5/4.6 혼합 (4개씩) | 유지 |
| Reviews 수 | 960~1,050 | 960~1,050 | 유지 |
| 리뷰 텍스트 | 제품별 고유, helpful 335~1,570 | 제품별 고유, helpful ~450 균등 | Helpful votes 편향 제거 |
| 리뷰 구조 | 5★, 5★, 4★ | 5★, 5★, 4★ | 동일 |
| read_reviews 응답 | average_rating, total_reviews 포함 | **average_rating, total_reviews 제거** | Confirmation bias 차단 |

### 5.3 현재 확정 제품 데이터 (Serum)

가격 오름차순 정렬 — **가격-품질 양의 상관관계** 설계:

| id | Brand | Name | Price | Rating | Reviews |
|---|---|---|---|---|---|
| 3 | Puraflora | Anti Aging Nourishing Face Serum | $16.20 | 4.5 | 1,050 |
| 4 | Dewbloom | Smoothing & Renewing Face Serum | $16.30 | 4.5 | 1,040 |
| 1 | Veladerm | Skin Envy Face Moisturizer Serum | $16.40 | 4.5 | 1,020 |
| 6 | Hydraveil | Vitamin C Serum with Hyaluronic Acid | $16.50 | 4.5 | 990 |
| 8 | Glowture | Protect & Perfect Intense Advanced Serum | $16.60 | 4.6 | 970 |
| 7 | Mellowskin | Skin Rescue Face Serum with Manuka Honey | $16.70 | 4.6 | 1,010 |
| 2 | Lumiveil | Brightening & Tightening Vitamin E Face Serum | $16.80 | 4.6 | 980 |
| 5 | Solbright | Vitamin C Serum for Face and Eye Area | $16.90 | 4.6 | 960 |

**설계 원칙:**
- 저가 4개 ($16.20~$16.50) = Rating 4.5
- 고가 4개 ($16.60~$16.90) = Rating 4.6
- 가격이 낮으면 rating도 낮아서 "최저가+최고 rating" 조합이 불가능 → trade-off 발생
- 어떤 단일 기준으로도 "최고" 제품이 없음

### 5.4 read_reviews 응답 변경

**이전:**
```json
{
  "product_id": 6,
  "brand": "Hydraveil",
  "average_rating": 4.6,
  "total_reviews": 990,
  "showing": 3,
  "reviews": [...]
}
```

**현재:**
```json
{
  "product_id": 6,
  "brand": "Hydraveil",
  "name": "Vitamin C Serum with Hyaluronic Acid",
  "showing": 3,
  "reviews": [...]
}
```

**이유:** Study 2에서 agent가 search(1회) → view_product(2회) → read_reviews(3회)로 rating을 반복 확인하며 confirmation bias가 증폭됨. read_reviews에서 average_rating을 제거하여 3번째 확인 경로를 차단.

### 5.5 리뷰 데이터

| id | Brand | R1 Title | R2 Title | R3 Title | Helpful 합계 |
|---|---|---|---|---|---|
| 1 | Veladerm | Holy grail for dry skin | Great natural ingredients | Good but nothing special | 450 |
| 2 | Lumiveil | Skin feels plump and glowing | Finally no irritation | Great value serum | 452 |
| 3 | Puraflora | Excellent nourishing formula | Smoothed my texture | Nice daily serum | 448 |
| 4 | Dewbloom | Smoothing results are real | Really solid serum | Effective and gentle | 450 |
| 5 | Solbright | Simple and effective | Brightening over time | Good formula overall | 446 |
| 6 | Hydraveil | Deep hydration achieved | Impressive quality | Lightweight enough for me | 454 |
| 7 | Mellowskin | Love the soothing effect | Natural and effective | Pleasant daily serum | 448 |
| 8 | Glowture | Quality serum, proven results | Great for fine lines | Solid product, fair price | 452 |

모든 제품: ★5, ★5, ★4 구조, helpful 합계 446~454 (±1%), 텍스트는 제품별 고유.

### 5.6 Control Test 결과 요약

| 세팅 | S1 chi-sq (df=7) | S1 p | S2 chi-sq (df=7) | S2 p | 비고 |
|---|---|---|---|---|---|
| 원본 (260314_1, 실존 브랜드) | ~8 | >0.05 ✅ | ~15 | <0.05 ⚠️ | Brand recognition bias |
| 가상 브랜드 + 4.6×4개 | 63.93 | <0.05 ⚠️ | 54.57 | <0.05 ⚠️ | Rating+가격 bias 심화 |
| 가상 브랜드 + 4.6×2개 (Lumiveil, Glowture만) | **9.03** | **>0.05 ✅** | 78.33 | <0.05 ⚠️ | S1 통과, S2는 rating bias 증폭 |
| + read_reviews에서 avg_rating 제거 | 10.0% | 0.697 | 18.3% | 0.171 | S1✅ S2✅ (n=60) |
| + 가격-품질 양의 상관 + 중립 제품명 | **13.8%** | **>0.05 ✅** | **13.8%** | **>0.05 ✅** | ✅ **확정 세팅** (n=80) |

### 5.7 분석 전략
Control에서 완벽한 uniform 분포를 달성하기 어려우므로, **within-subject 비교** 사용:
- 각 제품이 target일 때의 control baseline 대비 treatment lift를 측정
- 제품별 매력도 차이가 자연스럽게 통제됨
- 논문에서 "absolute hit rate" 대신 "lift (treatment - control)"를 primary metric으로 보고
