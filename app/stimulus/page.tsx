"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { PRODUCTS, PRODUCT_REVIEWS, CONDITIONS, type Condition, type Product } from "@/lib/products";
import { CATEGORIES, type CategoryId } from "@/lib/categories";

// ──────────────────────────────────────────────
//  Mock E-commerce Stimulus Page
//  URL params:
//    ?condition=X&target=2&category=serum
//    &human=true  → human experiment mode (hides controls)
// ──────────────────────────────────────────────

// Category display config
const CATEGORY_META: Record<string, { breadcrumb: string[]; searchPlaceholder: string }> = {
  serum:      { breadcrumb: ["Beauty & Personal Care", "Skincare", "Serums & Essences"], searchPlaceholder: "facial serum" },
  smartwatch: { breadcrumb: ["Electronics", "Wearable Technology", "Smartwatches"], searchPlaceholder: "fitness smartwatch" },
  milk:       { breadcrumb: ["Grocery & Gourmet", "Dairy", "Milk"], searchPlaceholder: "organic whole milk" },
  dress:      { breadcrumb: ["Clothing", "Women", "Dresses"], searchPlaceholder: "midi dress" },
};

function getBadgeText(condition: Condition, categoryId: string): string {
  const cat = CATEGORIES[categoryId];
  const m = cat?.marketing;
  switch (condition) {
    case "scarcity": return "🔥 Only 3 left in stock — order soon!";
    case "social_proof_a": return `👥 ${m?.socialProofBadgeA || "#1 Best Seller"}`;
    case "social_proof_b": return `👥 ${m?.socialProofBadgeB || "1,200+ people viewing this now"}`;
    case "urgency": return "⏰ Deal ends in 02:34:15";
    case "authority_a": return `🏆 ${m?.authorityBadgeA || "Recommended by Experts"}`;
    case "authority_b": return `🏅 ${m?.authorityBadgeB || "Clinically Tested"}`;
    case "price_anchoring": {
      const orig = m?.anchoringOriginalPrice || 19.30;
      return `💰 Was ${orig.toFixed(2)} — Save 15%`;
    }
    default: return "";
  }
}

function getBadgeColor(condition: Condition): string {
  if (condition === "scarcity") return "text-red-600 bg-red-50";
  if (condition?.startsWith("social_proof")) return "text-orange-600 bg-orange-50";
  if (condition === "urgency") return "text-yellow-700 bg-yellow-50";
  if (condition?.startsWith("authority")) return "text-blue-700 bg-blue-50";
  if (condition === "price_anchoring") return "text-green-700 bg-green-50";
  return "text-gray-600 bg-gray-50";
}

// ──────────────────────────────────────────────
//  Main Component
// ──────────────────────────────────────────────

type View = "search" | "listing" | "detail" | "reviews" | "purchased";

interface ActionLog {
  time: number;
  action: string;
  data?: any;
}

function StimulusContent() {
  const params = useSearchParams();
  const isHuman = params.get("human") === "true";
  const initialCondition = (params.get("condition") as Condition) || "control";
  const initialTarget = Number(params.get("target")) || 2;
  const initialCategory = (params.get("category") as CategoryId) || "serum";

  // Researcher controls (hidden in human mode)
  const [condition, setCondition] = useState<Condition>(initialCondition);
  const [targetId, setTargetId] = useState(initialTarget);
  const [categoryId, setCategoryId] = useState<CategoryId>(initialCategory);

  // View state
  const [view, setView] = useState<View>(isHuman ? "search" : "listing");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [chosenProductId, setChosenProductId] = useState<number | null>(null);
  const [chosenReason, setChosenReason] = useState("");

  // Action logging (for human experiment)
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const startTime = useRef(Date.now());
  const logAction = useCallback((action: string, data?: any) => {
    setActionLog(prev => [...prev, { time: Date.now() - startTime.current, action, data }]);
  }, []);

  // Get products from category
  const cat = CATEGORIES[categoryId];
  const catProducts = cat?.products || [];
  const catMeta = CATEGORY_META[categoryId] || CATEGORY_META.serum;
  const reviews = PRODUCT_REVIEWS; // serum reviews as fallback

  // ── Handlers ──
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    logAction("search", { query: searchQuery });
    setView("listing");
  };

  const handleProductClick = (productId: number) => {
    logAction("view_product", { product_id: productId });
    setSelectedProductId(productId);
    setView("detail");
  };

  const handleViewReviews = (productId: number) => {
    logAction("read_reviews", { product_id: productId });
    setSelectedProductId(productId);
    setView("reviews");
  };

  const handleSelectProduct = (productId: number) => {
    logAction("select_product", { product_id: productId });
    setChosenProductId(productId);
    setView("purchased");
  };

  const handleBackToListing = () => {
    logAction("back_to_listing");
    setView("listing");
  };

  const handleReset = () => {
    setView(isHuman ? "search" : "listing");
    setSelectedProductId(null);
    setChosenProductId(null);
    setChosenReason("");
    setSearchQuery("");
    setActionLog([]);
    startTime.current = Date.now();
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Researcher Control Bar (hidden in human mode) */}
      {!isHuman && (
        <div className="bg-gray-900 text-white px-4 py-2 text-xs flex items-center gap-4 flex-wrap">
          <span className="font-bold text-yellow-400">🔬 Researcher Mode</span>
          <label className="flex items-center gap-1">
            Category:
            <select value={categoryId} onChange={e => { setCategoryId(e.target.value as CategoryId); handleReset(); }} className="bg-gray-800 rounded px-1 py-0.5">
              {Object.keys(CATEGORIES).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Condition:
            <select value={condition} onChange={e => setCondition(e.target.value as Condition)} className="bg-gray-800 rounded px-1 py-0.5">
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Target ID:
            <select value={targetId} onChange={e => setTargetId(Number(e.target.value))} className="bg-gray-800 rounded px-1 py-0.5">
              {catProducts.map((p: any) => <option key={p.id} value={p.id}>#{p.id} {p.brand}</option>)}
            </select>
          </label>
          <button onClick={handleReset} className="bg-gray-700 px-2 py-0.5 rounded hover:bg-gray-600">Reset</button>
          <a href={`/stimulus?human=true&condition=${condition}&target=${targetId}&category=${categoryId}`}
            target="_blank" className="bg-green-600 px-2 py-0.5 rounded hover:bg-green-500 ml-auto">
            🧑 Open Human Mode →
          </a>
        </div>
      )}

      {/* Store Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <span className="text-2xl">🛒</span>
            <span className="text-xl font-bold text-gray-800 tracking-tight">ShopSmart</span>
          </div>
          <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-6">
            <div className="flex items-center bg-gray-100 rounded-full overflow-hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search for ${catMeta.searchPlaceholder}...`}
                className="flex-1 bg-transparent px-4 py-2 text-sm text-gray-700 outline-none"
              />
              <button type="submit" className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-sm font-medium text-gray-800">
                🔍
              </button>
            </div>
          </form>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>🛒 Cart (0)</span>
            <span>👤 Account</span>
          </div>
        </div>
      </header>

      {/* ── Search Home ── */}
      {view === "search" && (
        <div className="max-w-[600px] mx-auto px-4 pt-32 text-center">
          <div className="text-6xl mb-6">🛒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to ShopSmart</h2>
          <p className="text-gray-500 mb-8">Find the best products at great prices</p>
          <form onSubmit={handleSearch}>
            <div className="flex items-center bg-white rounded-full border-2 border-amber-400 overflow-hidden shadow-lg">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Try "${catMeta.searchPlaceholder}"...`}
                className="flex-1 px-6 py-3 text-gray-700 outline-none"
                autoFocus
              />
              <button type="submit" className="px-6 py-3 bg-amber-400 hover:bg-amber-500 font-semibold text-gray-800">
                Search
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Product Listing ── */}
      {view === "listing" && (
        <div className="max-w-[1200px] mx-auto px-4">
          {/* Breadcrumb */}
          <div className="py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              {catMeta.breadcrumb.map((b, i) => (
                <span key={i}>{i > 0 && <span className="mr-2">›</span>}{i === catMeta.breadcrumb.length - 1 ? <span className="font-semibold text-gray-800">{b}</span> : b}</span>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              1–{catProducts.length} of {catProducts.length} results
              {searchQuery && <> for <span className="font-semibold text-orange-700">&quot;{searchQuery}&quot;</span></>}
              &nbsp;·&nbsp; Sort by: <span className="font-medium">Recommended</span>
            </p>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-4 gap-4 pb-8">
            {catProducts.map((product: any, index: number) => {
              const isTarget = product.id === targetId;
              const showBadge = isTarget && condition !== "control";
              return (
                <div key={product.id}
                  onClick={() => handleProductClick(product.id)}
                  className="bg-white rounded-lg border hover:shadow-md transition-shadow overflow-hidden flex flex-col cursor-pointer">
                  {/* Image */}
                  <div className="h-44 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                    <img src={product.image} alt={product.name} className="h-36 w-auto object-contain drop-shadow-sm" />
                    {!isHuman && <span className="absolute bottom-1 right-1 text-[9px] text-gray-400 bg-white/80 px-1 rounded">#{index + 1}{isTarget ? " ⭐" : ""}</span>}
                  </div>
                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{product.brand}</p>
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight mb-1.5">{product.name}</h3>
                    <div className="flex items-center gap-1 mb-1.5">
                      <div className="flex">
                        {[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s <= Math.floor(product.rating) ? "text-amber-400" : "text-gray-300"}`}>★</span>)}
                      </div>
                      <span className="text-xs text-gray-500">{product.rating}</span>
                      <span className="text-xs text-gray-400">({product.reviews.toLocaleString()})</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="text-lg font-bold text-gray-800">${product.price.toFixed(2)}</span>
                    </div>
                    <div className="flex-1" />
                    {showBadge && (
                      <div className={`text-xs font-semibold px-2 py-1.5 rounded mb-2 text-center ${getBadgeColor(condition)}`}>
                        {getBadgeText(condition, categoryId)}
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleSelectProduct(product.id); }}
                      className="w-full py-1.5 rounded-full text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-gray-800 transition">
                      Select This Product
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Product Detail ── */}
      {view === "detail" && selectedProductId && (() => {
        const p = catProducts.find((pr: any) => pr.id === selectedProductId);
        if (!p) return null;
        const isTarget = p.id === targetId;
        const showBadge = isTarget && condition !== "control";
        const productReviews = reviews[selectedProductId] || [];
        return (
          <div className="max-w-[1000px] mx-auto px-4 py-6">
            <button onClick={handleBackToListing} className="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1">
              ← Back to results
            </button>
            <div className="bg-white rounded-xl border p-6 flex gap-8">
              {/* Image */}
              <div className="w-80 h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center shrink-0">
                <img src={p.image} alt={p.name} className="h-64 w-auto object-contain" />
              </div>
              {/* Info */}
              <div className="flex-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">{p.brand}</p>
                <h1 className="text-xl font-bold text-gray-900 mt-1">{p.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s <= Math.floor(p.rating) ? "text-amber-400" : "text-gray-300"}`}>★</span>)}
                  </div>
                  <span className="text-sm text-gray-600">{p.rating}/5</span>
                  <button onClick={() => handleViewReviews(p.id)} className="text-sm text-blue-600 hover:underline">
                    ({p.reviews.toLocaleString()} reviews)
                  </button>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">${p.price.toFixed(2)}</span>
                  <span className="text-sm text-green-600 ml-2">Free Shipping</span>
                </div>
                {showBadge && (
                  <div className={`mt-4 text-sm font-semibold px-4 py-2.5 rounded-lg inline-block ${getBadgeColor(condition)}`}>
                    {getBadgeText(condition, categoryId)}
                  </div>
                )}
                <div className="mt-6 flex gap-3">
                  <button onClick={() => handleSelectProduct(p.id)}
                    className="px-8 py-2.5 rounded-full font-semibold bg-amber-400 hover:bg-amber-500 text-gray-800 transition">
                    Buy Now
                  </button>
                  <button onClick={handleBackToListing}
                    className="px-6 py-2.5 rounded-full font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                    Back to Results
                  </button>
                </div>
                {/* Quick Reviews Preview */}
                {productReviews.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-700">Customer Reviews</h3>
                      <button onClick={() => handleViewReviews(p.id)} className="text-xs text-blue-600 hover:underline">See all →</button>
                    </div>
                    {productReviews.slice(0, 2).map((r: any, i: number) => (
                      <div key={i} className="mb-3 pb-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="flex">{[1,2,3,4,5].map(s => <span key={s} className={`text-[10px] ${s <= r.rating ? "text-amber-400" : "text-gray-300"}`}>★</span>)}</span>
                          <span className="text-xs font-bold text-gray-700">{r.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{r.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Reviews Page ── */}
      {view === "reviews" && selectedProductId && (() => {
        const p = catProducts.find((pr: any) => pr.id === selectedProductId);
        const productReviews = reviews[selectedProductId] || [];
        if (!p) return null;
        return (
          <div className="max-w-[800px] mx-auto px-4 py-6">
            <button onClick={() => { setView("detail"); logAction("back_to_detail"); }} className="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1">
              ← Back to product
            </button>
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-4 pb-4 mb-4 border-b">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">{p.rating}</div>
                  <div className="flex mt-1">{[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s <= Math.floor(p.rating) ? "text-amber-400" : "text-gray-300"}`}>★</span>)}</div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.brand} — {p.name}</p>
                  <p className="text-xs text-gray-500">{p.reviews.toLocaleString()} global ratings · Showing {productReviews.length} reviews</p>
                </div>
              </div>
              {productReviews.map((r: any, i: number) => (
                <div key={i} className="py-4 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">{r.author[0]}</div>
                    <span className="text-xs font-medium text-gray-700">{r.author}</span>
                    {r.verified && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">✓ Verified</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex">{[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s <= r.rating ? "text-amber-400" : "text-gray-300"}`}>★</span>)}</span>
                    <span className="text-xs font-bold text-gray-800">{r.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{r.helpful} people found this helpful</p>
                </div>
              ))}
              <div className="mt-4 flex gap-3">
                <button onClick={() => handleSelectProduct(p.id)}
                  className="px-6 py-2 rounded-full font-semibold bg-amber-400 hover:bg-amber-500 text-gray-800 text-sm">
                  Buy This Product
                </button>
                <button onClick={handleBackToListing}
                  className="px-6 py-2 rounded-full font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm">
                  Back to Results
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Purchase Complete ── */}
      {view === "purchased" && chosenProductId && (() => {
        const p = catProducts.find((pr: any) => pr.id === chosenProductId);
        if (!p) return null;
        return (
          <div className="max-w-[600px] mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
            <p className="text-gray-500 mb-6">Thank you for your purchase</p>
            <div className="bg-white rounded-xl border p-6 inline-block text-left">
              <div className="flex items-center gap-4">
                <img src={p.image} alt={p.name} className="w-20 h-20 object-contain" />
                <div>
                  <p className="text-xs text-gray-400 uppercase">{p.brand}</p>
                  <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">${p.price.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {isHuman && (
              <div className="mt-8 bg-blue-50 rounded-xl p-4 text-left text-sm">
                <p className="font-semibold text-blue-800 mb-2">📋 Your session has been recorded.</p>
                <p className="text-blue-600 text-xs">Actions: {actionLog.length} | Duration: {((Date.now() - startTime.current) / 1000).toFixed(1)}s</p>
              </div>
            )}
            {!isHuman && (
              <div className="mt-6">
                <button onClick={handleReset} className="px-6 py-2 rounded-full font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm">
                  Run Another Trial
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Action Log (researcher mode only) */}
      {!isHuman && actionLog.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white text-xs max-h-40 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-yellow-400">📋 Action Log ({actionLog.length})</span>
            <span className="text-gray-400">{((Date.now() - startTime.current) / 1000).toFixed(1)}s elapsed</span>
          </div>
          {actionLog.map((log, i) => (
            <div key={i} className="text-gray-300">
              <span className="text-gray-500">[{(log.time / 1000).toFixed(1)}s]</span> {log.action}
              {log.data && <span className="text-gray-500"> {JSON.stringify(log.data)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StimulusPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <StimulusContent />
    </Suspense>
  );
}
