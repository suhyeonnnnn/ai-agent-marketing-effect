"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  CATEGORIES,
  type CategoryId,
  type CategoryConfig,
  type CategoryProduct,
} from "@/lib/categories";
import { CONDITIONS, PRODUCT_REVIEWS, type Condition } from "@/lib/products";
import {
  generateStudy2Assignment,
  type ExperimentAssignment,
  type RoundConfig,
  PROLIFIC_COMPLETION_URL,
  getCompletionCode,
} from "@/lib/human-experiment";

// ═══════════════════════════════════════
//  Types
// ═══════════════════════════════════════

type Stage = "consent" | "instructions" | "round" | "survey" | "debriefing";
type BrowsingPage = "search_results" | "product_detail" | "reviews";

interface PageVisit {
  page: string;
  productId?: number;
  enterTime: number;
}

// ═══════════════════════════════════════
//  Badge helpers (same as Study 1)
// ═══════════════════════════════════════

function BadgeTag({ text, condition }: { text: string; condition?: string }) {
  const colorCls =
    condition === "scarcity" ? "bg-red-600 text-white" :
    condition?.startsWith("social_proof") ? "bg-orange-500 text-white" :
    condition === "urgency" ? "bg-yellow-500 text-gray-900" :
    condition?.startsWith("authority") ? "bg-blue-600 text-white" :
    condition === "price_anchoring" ? "bg-green-600 text-white" :
    "bg-gray-700 text-white";
  return <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${colorCls}`}>{text}</span>;
}

function getCategoryBadge(condition: string, category: CategoryConfig, product?: any): string {
  const cm = category.marketing;
  switch (condition) {
    case "scarcity": return "🔥 Only 3 left in stock — order soon!";
    case "social_proof_a": return `👥 ${cm.socialProofBadgeA}`;
    case "urgency": return "⏰ Only available today";
    case "authority_a": return `🏅 ${cm.authorityBadgeA}`;
    case "price_anchoring": {
      if (!product) return "";
      const orig = cm.anchoringOriginalPrice;
      const pct = Math.round((1 - product.price / orig) * 100);
      const origStr = "$" + orig.toFixed(2);
      const nowStr = "$" + product.price.toFixed(2);
      return `💰 Was ${origStr} → Now ${nowStr} (Save ${pct}%)`;
    }
    default: return "";
  }
}

// Reviews data - use from products.ts for serum, generate similar for others
function getReviews(categoryId: CategoryId, productId: number) {
  // Use existing serum reviews as template, adapt per category
  const base = PRODUCT_REVIEWS[productId] || [
    { author: "User1", rating: 5, title: "Great product", body: "Really liked this. Would buy again.", verified: true, helpful: 150 },
    { author: "User2", rating: 5, title: "Excellent quality", body: "High quality for the price. Recommended.", verified: true, helpful: 140 },
    { author: "User3", rating: 4, title: "Good value", body: "Does what it says. Solid choice.", verified: true, helpful: 120 },
  ];
  return base;
}

// ═══════════════════════════════════════
//  Search Results Page
// ═══════════════════════════════════════

function SearchResultsPage({
  roundConfig,
  category,
  onViewProduct,
}: {
  roundConfig: RoundConfig;
  category: CategoryConfig;
  onViewProduct: (productId: number) => void;
}) {
  const { condition, targetProductId, positionOrder } = roundConfig;
  const ordered = positionOrder.map(id => category.products.find(p => p.id === id)!);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Store Header */}
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center gap-3">
        <span className="text-base font-bold tracking-tight">ShopSmart</span>
        <div className="flex-1 bg-gray-800 rounded-md px-3 py-1.5 text-sm text-gray-400 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {category.searchQuery || category.label}
        </div>
      </div>

      <div className="bg-white border-x px-5 py-2 flex items-center gap-2 text-sm text-gray-500">
        <span>{ordered.length} results</span>
        <span className="text-gray-300">|</span>
        <span>Sort: <span className="text-gray-700 font-medium">Recommended</span></span>
      </div>

      {/* Product List (vertical, clickable to detail) */}
      <div className="bg-white border rounded-b-xl divide-y">
        {ordered.map((p) => {
          const isTarget = p.id === targetProductId;
          const isPriceAnchoring = isTarget && condition === "price_anchoring";
          const showBadge = isTarget && condition !== "control";
          const anchoringOriginalPrice = category.marketing.anchoringOriginalPrice;

          return (
            <div key={p.id} className="flex gap-4 p-4 hover:bg-gray-50 transition-colors">
              {/* Image - clickable to detail */}
              <button
                onClick={() => onViewProduct(p.id)}
                className="w-32 h-32 bg-gray-50 rounded-lg overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
              >
                <img
                  src={`/images/products/${roundConfig.categoryId}_${p.id}.jpg`}
                  alt={p.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    const parent = img.parentElement;
                    if (parent) parent.innerHTML = `<span class="text-3xl flex items-center justify-center h-full">📦</span>`;
                  }}
                />
              </button>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{p.brand}</p>
                <button
                  onClick={() => onViewProduct(p.id)}
                  className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline text-left"
                >
                  {p.name}
                </button>

                {/* Rating */}
                <div className="mt-1 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <svg key={s} viewBox="0 0 20 20" className={`w-3.5 h-3.5 ${s <= Math.floor(p.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-xs text-gray-600 font-medium ml-1">{p.rating}</span>
                  <button onClick={() => onViewProduct(p.id)} className="text-xs text-blue-600 ml-1 hover:underline">
                    ({p.reviews.toLocaleString()} reviews)
                  </button>
                </div>

                {/* Price */}
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900">${p.price.toFixed(2)}</span>
                  {isPriceAnchoring && (
                    <>
                      <span className="text-sm text-gray-400 line-through">${anchoringOriginalPrice.toFixed(2)}</span>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        Save {Math.round((1 - p.price / anchoringOriginalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>

                {/* Badge */}
                {showBadge && (
                  <div className="mt-1.5">
                    <BadgeTag condition={condition} text={getCategoryBadge(condition, category, p)} />
                  </div>
                )}

                <p className="mt-1 text-xs text-green-600 font-medium">Free Shipping</p>
              </div>

              {/* View Details Button */}
              <div className="flex items-center shrink-0">
                <button
                  onClick={() => onViewProduct(p.id)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Details →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  Product Detail Page
// ═══════════════════════════════════════

function ProductDetailPage({
  product,
  roundConfig,
  category,
  onBack,
  onViewReviews,
  onSelect,
}: {
  product: CategoryProduct;
  roundConfig: RoundConfig;
  category: CategoryConfig;
  onBack: () => void;
  onViewReviews: () => void;
  onSelect: () => void;
}) {
  const isTarget = product.id === roundConfig.targetProductId;
  const condition = roundConfig.condition;
  const showBadge = isTarget && condition !== "control";
  const isPriceAnchoring = isTarget && condition === "price_anchoring";
  const anchoringOriginalPrice = category.marketing.anchoringOriginalPrice;

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border overflow-hidden">
      {/* Breadcrumb */}
      <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-blue-600 hover:underline">← Back to results</button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">{product.brand}</span>
      </div>

      <div className="p-6 flex gap-6">
        {/* Image */}
        <div className="w-64 h-64 bg-gray-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
          <img
            src={`/images/products/${roundConfig.categoryId}_${product.id}.jpg`}
            alt={product.name}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
              const parent = img.parentElement;
              if (parent) parent.innerHTML = `<span class="text-5xl">📦</span>`;
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{product.brand}</p>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{product.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{product.spec}</p>

          {/* Rating */}
          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <svg key={s} viewBox="0 0 20 20" className={`w-4 h-4 ${s <= Math.floor(product.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="text-sm text-gray-700 font-medium ml-1">{product.rating}</span>
            <button onClick={onViewReviews} className="text-sm text-blue-600 ml-1 hover:underline">
              ({product.reviews.toLocaleString()} reviews)
            </button>
          </div>

          {/* Price */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
            {isPriceAnchoring && (
              <>
                <span className="text-base text-gray-400 line-through">${anchoringOriginalPrice.toFixed(2)}</span>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                  Save {Math.round((1 - product.price / anchoringOriginalPrice) * 100)}%
                </span>
              </>
            )}
          </div>

          {/* Badge */}
          {showBadge && (
            <div className="mt-3">
              <BadgeTag condition={condition} text={getCategoryBadge(condition, category, product)} />
            </div>
          )}

          <p className="mt-2 text-xs text-green-600 font-medium">✓ Free Shipping</p>

          {/* Description */}
          <div className="mt-4 text-sm text-gray-700 leading-relaxed">
            {product.description}
          </div>

          {/* Features */}
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Key Features</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {product.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions — Read Reviews first to encourage browsing */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onViewReviews}
              className="flex-1 py-2.5 bg-blue-50 border border-blue-300 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-100 transition-colors"
            >
              Read Reviews ({product.reviews.toLocaleString()})
            </button>
            <button
              onClick={onSelect}
              className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-sm font-semibold rounded-lg transition-colors"
            >
              Select This Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  Reviews Page
// ═══════════════════════════════════════

function ReviewsPage({
  product,
  categoryId,
  onBack,
  onBackToResults,
  onSelect,
}: {
  product: CategoryProduct;
  categoryId: CategoryId;
  onBack: () => void;
  onBackToResults: () => void;
  onSelect: () => void;
}) {
  const reviews = getReviews(categoryId, product.id);

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border overflow-hidden">
      {/* Breadcrumb */}
      <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-2 text-sm">
        <button onClick={onBackToResults} className="text-blue-600 hover:underline">Results</button>
        <span className="text-gray-400">/</span>
        <button onClick={onBack} className="text-blue-600 hover:underline">{product.brand}</button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">Reviews</span>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Customer Reviews</h2>
            <p className="text-sm text-gray-500">{product.brand} — {product.name}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} viewBox="0 0 20 20" className={`w-4 h-4 ${s <= Math.floor(product.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-sm font-medium text-gray-700 ml-1">{product.rating} / 5</span>
            </div>
            <p className="text-xs text-gray-500">{product.reviews.toLocaleString()} ratings</p>
          </div>
        </div>

        {/* Reviews - NO badge shown here (per protocol) */}
        <div className="space-y-4">
          {reviews.map((r, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {r.author[0]}
                </div>
                <span className="text-sm font-medium text-gray-700">{r.author}</span>
                {r.verified && (
                  <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Verified Purchase</span>
                )}
              </div>
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <svg key={s} viewBox="0 0 20 20" className={`w-3 h-3 ${s <= r.rating ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="text-sm font-semibold text-gray-800 ml-1">{r.title}</span>
              </div>
              <p className="text-sm text-gray-600">{r.body}</p>
              <p className="text-xs text-gray-400 mt-2">{r.helpful} people found this helpful</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Back to Product Details
          </button>
          <button
            onClick={onBackToResults}
            className="flex-1 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Other Products
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  Consent & Instructions (same as Study 1 with minor text changes)
// ═══════════════════════════════════════

function ConsentScreen({ onConsent }: { onConsent: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Research Study Consent Form</h1>
      <p className="text-sm text-gray-500 mb-6">KAIST Graduate School of Business · AI & Business Analytics Lab</p>
      <div className="prose prose-sm text-gray-700 space-y-4 mb-6">
        <p><strong>Study Title:</strong> Online Shopping Decision Making</p>
        <p><strong>Purpose:</strong> This study examines how people make product choices when shopping online. You will browse a simulated e-commerce website and make purchase decisions across 4 different product categories.</p>
        <p><strong>Duration:</strong> Approximately 12 minutes.</p>
        <p><strong>What you will do:</strong> In each round, you will freely browse a simulated shopping website — viewing product listings, reading detailed descriptions, and checking customer reviews. When ready, select the product you would most likely purchase. There are no right or wrong answers.</p>
        <p><strong>Compensation:</strong> You will receive $1.75 upon successful completion through Prolific.</p>
        <p><strong>Risks:</strong> Minimal risk. Tasks are similar to everyday online shopping.</p>
        <p><strong>Confidentiality:</strong> Your responses are anonymous. Data is identified only by your Prolific ID and used for academic research.</p>
        <p><strong>Voluntary Participation:</strong> You may withdraw at any time without penalty.</p>
      </div>
      <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border cursor-pointer mb-6">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span className="text-sm text-gray-700">I have read and understood the information above. I am 18 years or older and I agree to participate.</span>
      </label>
      <button onClick={onConsent} disabled={!checked}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        I Agree — Continue
      </button>
    </div>
  );
}

function InstructionsScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Instructions</h2>
      <p className="text-sm text-gray-500 mb-6">Please read carefully before starting.</p>
      <div className="space-y-4 text-sm text-gray-700 mb-8">
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
          <p>You will complete <strong>4 shopping rounds</strong>. Each round features a different product category.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
          <p>In each round, you will see a list of products. <strong>Click on a product to view its details and customer reviews</strong> before making your decision.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
          <p>Please <strong>browse at least one product's detail page</strong> before selecting. You can navigate freely between listings, product details, and reviews.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
          <p>When you've found the product you'd most likely purchase, click <strong>"Select This Product"</strong> on its detail page. There are no right or wrong answers.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">5</span>
          <p>After 4 rounds, you'll answer a short <strong>5-question survey</strong>.</p>
        </div>
      </div>
      <button onClick={onStart}
        className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors">
        Start Browsing →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  Survey (same as Study 1)
// ═══════════════════════════════════════

function SurveyScreen({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [q1, setQ1] = useState<string[]>([]);
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState("");
  const toggleQ1 = (val: string) => setQ1(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const canSubmit = q1.length > 0 && q2 && q3 && q4 && q5;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Post-Shopping Survey</h2>
      <p className="text-sm text-gray-500 mb-6">Almost done! Please answer these 5 questions.</p>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">1. Which category did you <strong>NOT</strong> shop for?</p>
          <div className="grid grid-cols-3 gap-2">
            {["Facial Serum", "Headphones", "Organic Milk", "Smartwatch", "Women's Dress"].map(opt => (
              <button key={opt} onClick={() => setQ5(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${q5 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {q5 === opt ? "● " : "○ "}{opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">2. When choosing products, which factors were most important? (Select all)</p>
          <div className="grid grid-cols-2 gap-2">
            {["Price", "Rating & Reviews", "Brand", "Product Description", "Promotional Badge", "Gut Feeling"].map(opt => (
              <button key={opt} onClick={() => toggleQ1(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${q1.includes(opt) ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {q1.includes(opt) ? "✓ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">3. How often do you shop online?</p>
          <div className="grid grid-cols-2 gap-2">
            {["Daily", "A few times a week", "A few times a month", "Rarely"].map(opt => (
              <button key={opt} onClick={() => setQ2(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${q2 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {q2 === opt ? "● " : "○ "}{opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">4. Age range</p>
          <div className="grid grid-cols-3 gap-2">
            {["18-24", "25-34", "35-44", "45-54", "55+"].map(opt => (
              <button key={opt} onClick={() => setQ3(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-center transition-colors ${q3 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">5. Gender</p>
          <div className="grid grid-cols-2 gap-2">
            {["Male", "Female", "Non-binary", "Prefer not to say"].map(opt => (
              <button key={opt} onClick={() => setQ4(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${q4 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {q4 === opt ? "● " : "○ "}{opt}
              </button>
            ))}
          </div>
        </div>

      </div>
      <button onClick={() => onSubmit({ q1_important_factors: q1, q2_shopping_frequency: q2, q3_age: q3, q4_gender: q4, q5_attention_check: q5, attention_check_passed: q5 === "Headphones" })}
        disabled={!canSubmit}
        className="w-full mt-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Submit Survey
      </button>
    </div>
  );
}

function DebriefingScreen() {
  const code = getCompletionCode("study2");
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h2>
      <p className="text-sm text-gray-600 mb-6">You have completed the study.</p>
      <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">About This Study</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          This research investigates how e-commerce marketing communication strategies
          affect product selection. Some products displayed promotional badges that were
          <strong> randomly assigned for research purposes</strong> and do not reflect actual product attributes.
        </p>
      </div>
      <div className="bg-purple-50 rounded-xl p-6 mb-6">
        <p className="text-sm text-gray-700 mb-2">Your Prolific completion code:</p>
        <p className="text-3xl font-mono font-bold text-purple-700 tracking-wider">{code}</p>
      </div>
      <a href={`${PROLIFIC_COMPLETION_URL}?cc=${code}`}
        className="inline-block px-8 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors">
        Return to Prolific →
      </a>
    </div>
  );
}

// ═══════════════════════════════════════
//  Main Study 2 Browsing Round
// ═══════════════════════════════════════

function BrowsingRound({
  roundConfig,
  category,
  onComplete,
}: {
  roundConfig: RoundConfig;
  category: CategoryConfig;
  onComplete: (data: any) => void;
}) {
  const [currentPage, setCurrentPage] = useState<BrowsingPage>("search_results");
  const [viewingProductId, setViewingProductId] = useState<number | null>(null);
  const [confirmProductId, setConfirmProductId] = useState<number | null>(null); // confirmation modal
  const roundStartRef = useRef(Date.now());

  // Browsing tracking
  const pageVisitsRef = useRef<PageVisit[]>([{ page: "search_results", enterTime: Date.now() }]);
  const productsViewedRef = useRef(new Set<number>());
  const reviewsReadRef = useRef(new Set<number>());

  const recordPageExit = () => {
    const visits = pageVisitsRef.current;
    if (visits.length > 0) {
      const last = visits[visits.length - 1];
      (last as any).duration = Date.now() - last.enterTime;
    }
  };

  const navigateTo = (page: BrowsingPage, productId?: number) => {
    recordPageExit();
    pageVisitsRef.current.push({ page: productId ? `${page}:${productId}` : page, productId, enterTime: Date.now() });
    setCurrentPage(page);
    setViewingProductId(productId ?? null);
  };

  // Show confirmation modal instead of immediately selecting
  const requestSelect = (productId: number) => {
    setConfirmProductId(productId);
  };

  const confirmSelect = () => {
    if (confirmProductId === null) return;
    recordPageExit();
    const visits = pageVisitsRef.current;
    const timePerPage = visits.map((v: any) => v.duration || (Date.now() - v.enterTime));

    onComplete({
      selected_product_id: confirmProductId,
      chose_target: confirmProductId === roundConfig.targetProductId ? 1 : 0,
      response_time_ms: Date.now() - roundStartRef.current,
      page_visits: visits.map(v => v.page),
      products_viewed: productsViewedRef.current.size,
      reviews_read: reviewsReadRef.current.size,
      time_per_page_ms: timePerPage,
      total_steps: visits.length,
    });
  };

  const viewingProduct = viewingProductId
    ? category.products.find(p => p.id === viewingProductId) || null
    : null;

  const confirmProduct = confirmProductId
    ? category.products.find(p => p.id === confirmProductId) || null
    : null;

  return (
    <div>
      {/* Confirmation Modal */}
      {confirmProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Your Selection</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to select <strong>{confirmProduct.brand} — {confirmProduct.name}</strong>?
            </p>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-5">
              <img
                src={`/images/products/${roundConfig.categoryId}_${confirmProduct.id}.jpg`}
                alt={confirmProduct.name}
                className="w-16 h-16 object-contain rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{confirmProduct.name}</p>
                <p className="text-xs text-gray-500">{confirmProduct.brand} · ${confirmProduct.price.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmProductId(null)}
                className="flex-1 py-2.5 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={confirmSelect}
                className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-sm font-semibold rounded-lg transition-colors"
              >
                Yes, Select This
              </button>
            </div>
          </div>
        </div>
      )}

      {currentPage === "search_results" && (
        <SearchResultsPage
          roundConfig={roundConfig}
          category={category}
          onViewProduct={(id) => {
            productsViewedRef.current.add(id);
            navigateTo("product_detail", id);
          }}
        />
      )}
      {currentPage === "product_detail" && viewingProduct && (
        <ProductDetailPage
          product={viewingProduct}
          roundConfig={roundConfig}
          category={category}
          onBack={() => navigateTo("search_results")}
          onViewReviews={() => {
            reviewsReadRef.current.add(viewingProduct.id);
            navigateTo("reviews", viewingProduct.id);
          }}
          onSelect={() => requestSelect(viewingProduct.id)}
        />
      )}
      {currentPage === "reviews" && viewingProduct && (
        <ReviewsPage
          product={viewingProduct}
          categoryId={roundConfig.categoryId as CategoryId}
          onBack={() => navigateTo("product_detail", viewingProduct.id)}
          onBackToResults={() => navigateTo("search_results")}
          onSelect={() => requestSelect(viewingProduct.id)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  Main Study 2 Component
// ═══════════════════════════════════════

function Study2Content() {
  const searchParams = useSearchParams();

  // Stable IDs via useRef
  const idsRef = useRef({
    pid: searchParams.get("PROLIFIC_PID") || searchParams.get("pid") || "test_local",
    sid: searchParams.get("STUDY_ID") || "study2_test",
    ssid: searchParams.get("SESSION_ID") || "session_local",
  });
  const { pid: participantId, sid: studyId, ssid: sessionId } = idsRef.current;

  // ★ Generate assignment synchronously (no flash)
  const assignmentRef = useRef<ExperimentAssignment | null>(null);
  if (!assignmentRef.current) {
    assignmentRef.current = generateStudy2Assignment(participantId, studyId, sessionId);
  }
  const assignment = assignmentRef.current;

  const [stage, setStage] = useState<Stage>("consent");
  const [currentRound, setCurrentRound] = useState(0);

  // Log assignment once
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    fetch("/api/human/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "assignment", data: assignment }),
    }).catch(console.error);
  }, [assignment]);

  const handleRoundComplete = useCallback((browsingData: any) => {
    if (!assignment) return;
    const round = assignment.rounds[currentRound];

    const trialData = {
      participant_id: participantId,
      study_id: studyId,
      session_id: sessionId,
      round: round.round,
      category: round.categoryId,
      condition: round.condition,
      funnel: round.funnel,
      target_product_id: round.targetProductId,
      target_position: round.positionOrder.indexOf(round.targetProductId) + 1,
      position_order: round.positionOrder,
      timestamp: new Date().toISOString(),
      ...browsingData,
    };

    fetch("/api/human/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "study2_trial", data: trialData }),
    }).catch(console.error);

    if (currentRound < 3) {
      setCurrentRound(prev => prev + 1);
    } else {
      setStage("survey");
    }
  }, [assignment, currentRound, participantId, studyId, sessionId]);

  const handleSurveySubmit = (surveyData: any) => {
    fetch("/api/human/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "survey",
        data: { participant_id: participantId, study_type: "study2", ...surveyData, timestamp: new Date().toISOString() },
      }),
    }).catch(console.error);
    setStage("debriefing");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress */}
      {stage === "round" && (
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Round {currentRound + 1} of 4</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {CATEGORIES[assignment.rounds[currentRound].categoryId].label}
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-16 h-1.5 rounded-full ${i < currentRound ? "bg-green-500" : i === currentRound ? "bg-purple-500" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-6">
        {stage === "consent" && <ConsentScreen onConsent={() => setStage("instructions")} />}
        {stage === "instructions" && <InstructionsScreen onStart={() => { setStage("round"); }} />}
        {stage === "round" && (
          <div className="w-full max-w-5xl">
            {/* Scenario with funnel level */}
            <div className="bg-purple-50 rounded-xl p-5 mb-4">
              <p className="text-xs text-purple-500 font-medium uppercase tracking-wider mb-2 text-center">Imagine you are in the following situation</p>
              <p className="text-sm text-purple-900 font-medium text-center italic">
                "{assignment.rounds[currentRound].scenario}"
              </p>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Browse the products below and choose the one you would purchase.
              </p>
            </div>
            <BrowsingRound
              key={currentRound} // force remount on round change
              roundConfig={assignment.rounds[currentRound]}
              category={CATEGORIES[assignment.rounds[currentRound].categoryId]}
              onComplete={handleRoundComplete}
            />
          </div>
        )}
        {stage === "survey" && <SurveyScreen onSubmit={handleSurveySubmit} />}
        {stage === "debriefing" && <DebriefingScreen />}
      </div>
    </div>
  );
}

export default function Study2HumanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Loading...</div></div>}>
      <Study2Content />
    </Suspense>
  );
}
