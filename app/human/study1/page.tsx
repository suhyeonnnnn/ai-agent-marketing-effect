"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  CATEGORIES,
  CATEGORY_LIST,
  type CategoryId,
  type CategoryConfig,
} from "@/lib/categories";
import { CONDITIONS, PRODUCT_REVIEWS, type Condition } from "@/lib/products";
import {
  generateStudy1Assignment,
  type ExperimentAssignment,
  type RoundConfig,
  PROLIFIC_COMPLETION_URL,
  getCompletionCode,
} from "@/lib/human-experiment";

// ═══════════════════════════════════════
//  Experiment Stages
// ═══════════════════════════════════════

type Stage = "consent" | "instructions" | "round" | "survey" | "debriefing";

// ═══════════════════════════════════════
//  Badge Component (reused from agent experiment)
// ═══════════════════════════════════════

function BadgeTag({ text, condition }: { text: string; condition?: string }) {
  const colorCls =
    condition === "scarcity"
      ? "bg-red-600 text-white"
      : condition?.startsWith("social_proof")
        ? "bg-orange-500 text-white"
        : condition === "urgency"
          ? "bg-yellow-500 text-gray-900"
          : condition?.startsWith("authority")
            ? "bg-blue-600 text-white"
            : condition === "price_anchoring"
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-white";
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${colorCls}`}
    >
      {text}
    </span>
  );
}

function getCategoryBadge(
  condition: string,
  category: CategoryConfig,
  product?: any
): string {
  const cm = category.marketing;
  switch (condition) {
    case "scarcity":
      return "🔥 Only 3 left in stock — order soon!";
    case "social_proof_a":
      return `👥 ${cm.socialProofBadgeA}`;
    case "urgency":
      return "⏰ Only available today";
    case "authority_a":
      return `🏅 ${cm.authorityBadgeA}`;
    case "price_anchoring": {
      if (!product) return "";
      const orig = cm.anchoringOriginalPrice;
      const pct = Math.round((1 - product.price / orig) * 100);
      const origStr = "$" + orig.toFixed(2);
      const nowStr = "$" + product.price.toFixed(2);
      return `💰 Was ${origStr} → Now ${nowStr} (Save ${pct}%)`;
    }
    default:
      return "";
  }
}

// ═══════════════════════════════════════
//  Product Grid Component
// ═══════════════════════════════════════

function ProductGrid({
  roundConfig,
  category,
  onSelect,
}: {
  roundConfig: RoundConfig;
  category: CategoryConfig;
  onSelect: (productId: number) => void;
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<any | null>(null);
  const { condition, targetProductId, positionOrder } = roundConfig;

  const ordered = positionOrder.map(
    (id) => category.products.find((p) => p.id === id)!
  );

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
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <div className="relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-orange-500 rounded-full text-[8px] font-bold flex items-center justify-center">
              0
            </span>
          </div>
        </div>
      </div>

      {/* Results info */}
      <div className="bg-white border-x px-5 py-2 flex items-center gap-2 text-sm text-gray-500">
        <span>{ordered.length} results</span>
        <span className="text-gray-300">|</span>
        <span>
          Sort: <span className="text-gray-700 font-medium">Recommended</span>
        </span>
      </div>

      {/* Product Grid 4×2 */}
      <div className="bg-white border rounded-b-xl p-4">
        <div className="grid grid-cols-4 gap-3">
          {ordered.map((p) => {
            const isTarget = p.id === targetProductId;
            const isPriceAnchoring = isTarget && condition === "price_anchoring";
            const showBadge = isTarget && condition !== "control";
            const anchoringOriginalPrice = category.marketing.anchoringOriginalPrice;

            return (
              <button
                key={p.id}
                onClick={() => setConfirmProduct(p)}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`bg-white rounded-lg border p-3 text-left transition-all cursor-pointer
                  ${hoveredId === p.id ? "ring-2 ring-blue-400 shadow-md border-blue-300" : "border-gray-200 hover:shadow-sm"}`}
              >
                {/* Product Image */}
                <div className="w-full h-28 rounded-md flex items-center justify-center mb-2 bg-gray-50 overflow-hidden">
                  <img
                    src={`/images/products/${roundConfig.categoryId}_${p.id}.jpg`}
                    alt={p.name}
                    className="h-full object-contain"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = "none";
                      const parent = img.parentElement;
                      if (parent) parent.innerHTML = `<span class="text-3xl">📦</span>`;
                    }}
                  />
                </div>

                {/* Info */}
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {p.brand}
                </p>
                <p className="text-xs font-medium text-gray-800 leading-snug mt-0.5 line-clamp-2">
                  {p.name}
                </p>

                {/* Rating */}
                <div className="mt-1.5 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      viewBox="0 0 20 20"
                      className={`w-3 h-3 ${s <= Math.floor(p.rating) ? "text-yellow-400" : "text-gray-200"}`}
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-[10px] text-gray-600 font-medium ml-0.5">
                    {p.rating}
                  </span>
                  <span className="text-[10px] text-blue-600 ml-0.5">
                    ({p.reviews.toLocaleString()})
                  </span>
                </div>

                {/* Price */}
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gray-900">
                    ${p.price.toFixed(2)}
                  </span>
                  {isPriceAnchoring && (
                    <>
                      <span className="text-[10px] text-gray-400 line-through">
                        ${anchoringOriginalPrice.toFixed(2)}
                      </span>
                      <span className="text-[9px] font-semibold text-green-600 bg-green-50 px-1 py-0.5 rounded">
                        Save {Math.round((1 - p.price / anchoringOriginalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>

                {/* Badge */}
                {showBadge && (
                  <div className="mt-1.5">
                    <BadgeTag
                      condition={condition}
                      text={getCategoryBadge(condition, category, p)}
                    />
                  </div>
                )}

                <div className="mt-1.5 text-[9px] text-green-600 font-medium">
                  Free Shipping
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmProduct(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Your Selection</h3>
            <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={`/images/products/${roundConfig.categoryId}_${confirmProduct.id}.jpg`}
                  alt={confirmProduct.name}
                  className="h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">{confirmProduct.brand}</p>
                <p className="text-sm font-medium text-gray-900">{confirmProduct.name}</p>
                <p className="text-sm font-bold text-gray-900 mt-1">${confirmProduct.price.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-5">Are you sure you want to select this product?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmProduct(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => { onSelect(confirmProduct.id); setConfirmProduct(null); }}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Yes, Select This
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  Consent Screen
// ═══════════════════════════════════════

function ConsentScreen({ onConsent }: { onConsent: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Research Study Consent Form</h1>
      <p className="text-sm text-gray-500 mb-6">KAIST Graduate School of Business · AI & Business Analytics Lab</p>

      <div className="prose prose-sm text-gray-700 space-y-4 mb-6">
        <p><strong>Study Title:</strong> Online Shopping Decision Making</p>
        <p><strong>Purpose:</strong> This study examines how people make product choices when shopping online. You will browse simulated e-commerce product listings and make purchase decisions across 4 different product categories.</p>
        <p><strong>Duration:</strong> Approximately 10 minutes.</p>
        <p><strong>What you will do:</strong> In each round, you will see a set of products on a simulated shopping page. You will read the product information and choose the product you would most likely purchase. There are no right or wrong answers.</p>
        <p><strong>Compensation:</strong> You will receive $1.75 upon successful completion through Prolific.</p>
        <p><strong>Risks:</strong> This study involves minimal risk. The tasks are similar to everyday online shopping.</p>
        <p><strong>Confidentiality:</strong> Your responses are anonymous. Data will be identified only by your Prolific ID and used for academic research purposes only.</p>
        <p><strong>Voluntary Participation:</strong> Participation is voluntary. You may withdraw at any time without penalty by closing the browser window.</p>
        <p><strong>Contact:</strong> For questions about this study, contact the research team via Prolific messaging.</p>
      </div>

      <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border cursor-pointer mb-6">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">
          I have read and understood the information above. I am 18 years or older and I agree to participate in this study.
        </span>
      </label>

      <button
        onClick={onConsent}
        disabled={!checked}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        I Agree — Continue
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  Instructions Screen
// ═══════════════════════════════════════

function InstructionsScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Instructions</h2>
      <p className="text-sm text-gray-500 mb-6">Please read carefully before starting.</p>

      <div className="space-y-4 text-sm text-gray-700 mb-8">
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
          <p>You will complete <strong>4 shopping rounds</strong>. Each round features a different product category (e.g., skincare, electronics, groceries, clothing).</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
          <p>In each round, you will see <strong>8 products</strong> displayed on a simulated shopping page. Review the products and <strong>click on the one you would most likely purchase</strong>.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
          <p>There are <strong>no right or wrong answers</strong>. Choose based on your personal preference, just as you would in real online shopping.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
          <p>After the 4 rounds, you will answer a short <strong>5-question survey</strong>.</p>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        Start Shopping →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  Survey Screen
// ═══════════════════════════════════════

function SurveyScreen({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [q1, setQ1] = useState<string[]>([]);
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState("");

  const toggleQ1 = (val: string) => {
    setQ1((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const canSubmit = q1.length > 0 && q2 && q3 && q4 && q5;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Post-Shopping Survey</h2>
      <p className="text-sm text-gray-500 mb-6">Almost done! Please answer these 5 quick questions.</p>

      <div className="space-y-6">
        {/* Q1 — Attention check (moved first while memory is fresh) */}
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">
            1. Which of the following categories did you <strong>NOT</strong> shop for in this study?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {["Facial Serum", "Headphones", "Organic Milk", "Smartwatch", "Women's Dress"].map((opt) => (
              <button
                key={opt}
                onClick={() => setQ5(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors
                  ${q5 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {q5 === opt ? "● " : "○ "}{opt}
              </button>
            ))}
          </div>
        </div>

        {/* Q2 */}
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">
            2. When choosing products, which factors were most important to you? (Select all that apply)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {["Price", "Rating & Reviews", "Brand", "Product Description", "Promotional Badge", "Gut Feeling"].map((opt) => (
              <button
                key={opt}
                onClick={() => toggleQ1(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors
                  ${q1.includes(opt) ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {q1.includes(opt) ? "✓ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>

        {/* Q3 */}
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">
            3. How often do you shop online?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {["Daily", "A few times a week", "A few times a month", "Rarely"].map((opt) => (
              <button
                key={opt}
                onClick={() => setQ2(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors
                  ${q2 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {q2 === opt ? "● " : "○ "}{opt}
              </button>
            ))}
          </div>
        </div>

        {/* Q4 */}
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">4. Age range</p>
          <div className="grid grid-cols-3 gap-2">
            {["18-24", "25-34", "35-44", "45-54", "55+"].map((opt) => (
              <button
                key={opt}
                onClick={() => setQ3(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-center transition-colors
                  ${q3 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Q5 */}
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">5. Gender</p>
          <div className="grid grid-cols-2 gap-2">
            {["Male", "Female", "Non-binary", "Prefer not to say"].map((opt) => (
              <button
                key={opt}
                onClick={() => setQ4(opt)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors
                  ${q4 === opt ? "bg-blue-50 border-blue-400 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {q4 === opt ? "● " : "○ "}{opt}
              </button>
            ))}
          </div>
        </div>


      </div>

      <button
        onClick={() =>
          onSubmit({
            q1_important_factors: q1,
            q2_shopping_frequency: q2,
            q3_age: q3,
            q4_gender: q4,
            q5_attention_check: q5,
            attention_check_passed: q5 === "Headphones",
          })
        }
        disabled={!canSubmit}
        className="w-full mt-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Submit Survey
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  Debriefing Screen
// ═══════════════════════════════════════

function DebriefingScreen() {
  const code = getCompletionCode("study1");

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h2>
      <p className="text-sm text-gray-600 mb-6">You have completed the study.</p>

      <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">About This Study</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          This research investigates how e-commerce marketing communication strategies
          affect product selection. Some products displayed promotional badges (e.g.,
          &quot;Best Seller&quot;, &quot;Limited Stock&quot;) that were <strong>randomly assigned
          for research purposes</strong> and do not reflect actual product attributes.
        </p>
      </div>

      <div className="bg-blue-50 rounded-xl p-6 mb-6">
        <p className="text-sm text-gray-700 mb-2">Your Prolific completion code:</p>
        <p className="text-3xl font-mono font-bold text-blue-700 tracking-wider">{code}</p>
      </div>

      <a
        href={`${PROLIFIC_COMPLETION_URL}?cc=${code}`}
        className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        Return to Prolific →
      </a>
    </div>
  );
}

// ═══════════════════════════════════════
//  Main Study 1 Component
// ═══════════════════════════════════════

function Study1Content() {
  const searchParams = useSearchParams();

  // ★ Stable IDs: use useRef so they never change across re-renders
  const idsRef = useRef({
    participantId: searchParams.get("PROLIFIC_PID") || searchParams.get("pid") || "test_local",
    studyId: searchParams.get("STUDY_ID") || "study1_test",
    sessionId: searchParams.get("SESSION_ID") || "session_local",
  });
  const { participantId, studyId, sessionId } = idsRef.current;

  // ★ Generate assignment synchronously on first render (no useEffect flash)
  const assignmentRef = useRef<ExperimentAssignment | null>(null);
  if (!assignmentRef.current) {
    assignmentRef.current = generateStudy1Assignment(participantId, studyId, sessionId);
  }
  const assignment = assignmentRef.current;

  const [stage, setStage] = useState<Stage>("consent");
  const [currentRound, setCurrentRound] = useState(0); // 0-indexed
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [trialResults, setTrialResults] = useState<any[]>([]);

  // Log assignment once on mount
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

  const handleConsent = () => setStage("instructions");
  const handleStart = () => {
    setStage("round");
    setRoundStartTime(Date.now());
  };

  const handleProductSelect = useCallback(
    (productId: number) => {
      if (!assignment) return;
      const round = assignment.rounds[currentRound];
      const responseTime = Date.now() - roundStartTime;

      const trialData = {
        participant_id: participantId,
        study_id: studyId,
        session_id: sessionId,
        round: round.round,
        category: round.categoryId,
        condition: round.condition,
        target_product_id: round.targetProductId,
        target_position: round.positionOrder.indexOf(round.targetProductId) + 1,
        selected_product_id: productId,
        chose_target: productId === round.targetProductId ? 1 : 0,
        response_time_ms: responseTime,
        position_order: round.positionOrder,
        timestamp: new Date().toISOString(),
      };

      // Log trial
      fetch("/api/human/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "study1_trial", data: trialData }),
      }).catch(console.error);

      setTrialResults((prev) => [...prev, trialData]);

      // Next round or survey
      if (currentRound < 3) {
        setCurrentRound((prev) => prev + 1);
        setRoundStartTime(Date.now());
      } else {
        setStage("survey");
      }
    },
    [assignment, currentRound, roundStartTime, participantId, studyId, sessionId]
  );

  const handleSurveySubmit = (surveyData: any) => {
    fetch("/api/human/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "survey",
        data: {
          participant_id: participantId,
          study_type: "study1",
          ...surveyData,
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(console.error);

    setStage("debriefing");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress Bar */}
      {stage === "round" && (
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Round {currentRound + 1} of 4
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {CATEGORIES[assignment.rounds[currentRound].categoryId].label}
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-16 h-1.5 rounded-full ${
                  i < currentRound
                    ? "bg-green-500"
                    : i === currentRound
                      ? "bg-blue-500"
                      : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {stage === "consent" && <ConsentScreen onConsent={handleConsent} />}
        {stage === "instructions" && <InstructionsScreen onStart={handleStart} />}
        {stage === "round" && (
          <div className="w-full max-w-5xl">
            {/* Scenario */}
            <div className="bg-blue-50 rounded-xl p-5 mb-4">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wider mb-2 text-center">Imagine you are in the following situation</p>
              <p className="text-sm text-blue-900 font-medium text-center italic">
                "{assignment.rounds[currentRound].scenario}"
              </p>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Click on the product you would choose.
              </p>
            </div>

            <ProductGrid
              roundConfig={assignment.rounds[currentRound]}
              category={CATEGORIES[assignment.rounds[currentRound].categoryId]}
              onSelect={handleProductSelect}
            />
          </div>
        )}
        {stage === "survey" && <SurveyScreen onSubmit={handleSurveySubmit} />}
        {stage === "debriefing" && <DebriefingScreen />}
      </div>
    </div>
  );
}

export default function Study1HumanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Loading...</div></div>}>
      <Study1Content />
    </Suspense>
  );
}
