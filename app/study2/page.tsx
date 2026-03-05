"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CONDITIONS, MODELS, PRODUCTS, PRODUCT_REVIEWS, type Condition } from "@/lib/products";
import type { Study2Result, ToolCall } from "@/lib/agent";
import { getApiKeys } from "@/lib/api-keys";

const STUDY2_CONDITIONS: Condition[] = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"];

const TOOL_ICONS: Record<string, string> = {
  search: "🔍", filter_by: "🔧", view_product: "👁", read_reviews: "💬",
  compare: "⚖️", select_product: "✅",
};
const FUNNEL_STAGES = ["Attention", "Consideration", "Selection"];
function classifyToolStage(tool: string): number {
  if (["search", "filter_by"].includes(tool)) return 0;
  if (["view_product", "read_reviews", "compare"].includes(tool)) return 1;
  if (tool === "select_product") return 2;
  return 0;
}

const EMOJIS: Record<number, string> = { 1:"🧴", 2:"💧", 3:"🌿", 4:"🐌", 5:"⚗️", 6:"✨", 7:"🍵", 8:"🔬" };
const COLORS: Record<number, string> = { 1:"#1a6fb0", 2:"#2d8f6f", 3:"#d4763a", 4:"#c94c6e", 5:"#8a8578", 6:"#7b5ea7", 7:"#4a9e6d", 8:"#3a3a5c" };

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px]">
      {[1,2,3,4,5].map(s => <span key={s} className={s <= Math.floor(rating) ? "text-amber-400" : "text-gray-300"}>★</span>)}
      <span className="text-gray-500 ml-0.5">{rating}</span>
    </span>
  );
}

// ═══════════════════════════════════════
//  E-commerce UI Components
// ═══════════════════════════════════════

function StarsLarge({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">{[1,2,3,4,5].map(s => (
        <svg key={s} viewBox="0 0 20 20" className={`w-3.5 h-3.5 ${s <= Math.floor(rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}</span>
      <span className="text-xs text-gray-800 font-semibold">{rating}</span>
      {count != null && <span className="text-xs text-blue-600 hover:underline cursor-default">({count.toLocaleString()})</span>}
    </span>
  );
}

function PriceDisplay({ price, original, discount, size = "md" }: { price: number | string; original?: number | string; discount?: string; size?: "sm" | "md" | "lg" }) {
  const p = typeof price === "number" ? price.toFixed(2) : price;
  const cls = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className={`${cls} font-bold text-gray-900`}>${p}</span>
      {original && original !== price && (
        <span className="text-sm text-gray-400 line-through">${typeof original === "number" ? original.toFixed(2) : original}</span>
      )}
      {discount && <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{discount}</span>}
    </div>
  );
}

function BadgeTag({ text }: { text: string }) {
  const isScarcity = text.includes("left in stock") || text.includes("Low Stock");
  const isSocial = text.includes("Best Seller") || text.includes("viewing");
  const isUrgency = text.includes("Deal ends") || text.includes("ending");
  const isAuthority = text.includes("Dermatologist") || text.includes("Clinically") || text.includes("Derm");
  const isPrice = text.includes("Was $") || text.includes("Save") || text.includes("Special Price");
  const colorCls = isScarcity ? "bg-red-600 text-white" :
    isSocial ? "bg-orange-500 text-white" :
    isUrgency ? "bg-yellow-500 text-gray-900" :
    isAuthority ? "bg-blue-600 text-white" :
    isPrice ? "bg-green-600 text-white" :
    "bg-gray-700 text-white";
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded ${colorCls}`}>
      {text}
    </span>
  );
}

function MockSearchResults({ data, onProductClick }: { data: any; onProductClick?: (id: number) => void }) {
  const products = data?.products || [];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
        <span>{data?.total_results || 0} results</span>
        <span className="text-gray-300">|</span>
        <span>Sort: <span className="text-gray-700 font-medium">{data?.sort_by || "recommended"}</span></span>
        {data?.filters_applied && (
          <>
            <span className="text-gray-300">|</span>
            <span>Filters: <span className="text-blue-600 font-medium">{data.filters_applied.join(", ")}</span></span>
          </>
        )}
      </div>
      <div className="space-y-0 divide-y divide-gray-100">
        {products.map((p: any) => (
          <div key={p.product_id}
            onClick={() => onProductClick?.(p.product_id)}
            className={`flex gap-3 py-3 ${onProductClick ? "cursor-pointer hover:bg-blue-50/30 transition-colors -mx-3 px-3 rounded" : ""}`}>
            <div className="w-[72px] h-[72px] rounded-lg shrink-0 border border-gray-100 overflow-hidden bg-white flex items-center justify-center">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-2xl">{EMOJIS[p.product_id] || "📦"}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">{p.brand}</p>
              <p className="text-[13px] font-medium text-gray-800 leading-tight mt-0.5">{p.name}</p>
              <div className="mt-1"><StarsLarge rating={p.rating} count={p.reviews} /></div>
              <div className="mt-1"><PriceDisplay price={p.price} original={p.original_price} size="sm" /></div>
              {p.badge && <div className="mt-1.5"><BadgeTag text={p.badge} /></div>}
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                <span>{p.volume || "50ml"}</span>
                <span>·</span>
                <span className="text-green-600 font-medium">Free Shipping</span>
              </div>
            </div>
            {onProductClick && (
              <div className="flex items-center shrink-0">
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockProductDetail({ data, onReviewsClick }: { data: any; onReviewsClick?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-32 h-32 rounded-xl shrink-0 border border-gray-100 overflow-hidden bg-white flex items-center justify-center">
          {data?.image ? (
            <img src={data.image} alt={data.name} className="w-full h-full object-contain p-2" />
          ) : (
            <span className="text-5xl">{EMOJIS[data?.product_id] || "📦"}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wider">{data?.brand}</p>
          <h2 className="text-base font-bold text-gray-900 mt-0.5 leading-tight">{data?.name}</h2>
          <div className="mt-2 flex items-center gap-1"><StarsLarge rating={data?.rating || 0} count={data?.reviews_count} /></div>
          <div className="mt-2"><PriceDisplay price={data?.price} original={data?.original_price} discount={data?.discount} size="lg" /></div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              {data?.volume}
            </span>
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125V14.25m0 0h10.5M3.375 14.25h10.5"/></svg>
              Free Shipping
            </span>
          </div>
        </div>
      </div>
      {data?.banner && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <span className="text-amber-500 mt-0.5 shrink-0">ℹ️</span>
          <span className="text-xs font-semibold text-amber-800 leading-snug">{data.banner}</span>
        </div>
      )}
      {data?.description && (
        <div>
          <h3 className="text-xs font-bold text-gray-700 mb-1.5">About this item</h3>
          <p className="text-xs text-gray-600 leading-relaxed">{data.description}</p>
          {data?.description_note && <p className="text-xs text-amber-700 mt-1.5 italic">{data.description_note}</p>}
        </div>
      )}
      {data?.key_ingredients && (
        <div>
          <h3 className="text-xs font-bold text-gray-700 mb-1.5">Key Ingredients</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{data.key_ingredients}</p>
        </div>
      )}
      {data?.tags && (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((t: string) => <span key={t} className="text-[11px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{t}</span>)}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold rounded-full transition-colors">Add to Cart</button>
        <button className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-colors">Buy Now</button>
      </div>
      {onReviewsClick && (
        <button onClick={onReviewsClick}
          className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <StarsLarge rating={data?.rating || 0} />
            <span className="text-xs text-gray-500">{data?.reviews_count?.toLocaleString()} ratings</span>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      )}
    </div>
  );
}

function MockReviews({ data }: { data: any }) {
  const reviews = data?.reviews || [];
  return (
    <div>
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{data?.average_rating}</div>
          <StarsLarge rating={data?.average_rating || 0} />
        </div>
        <div className="text-xs text-gray-500 leading-relaxed">
          <p><span className="font-semibold text-gray-700">{data?.total_reviews?.toLocaleString()}</span> global ratings</p>
          <p className="mt-0.5">Showing {reviews.length} reviews for <span className="font-semibold text-gray-700">{data?.brand}</span></p>
        </div>
      </div>
      <div className="space-y-4">
        {reviews.map((r: any, i: number) => (
          <div key={i} className="pb-4 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {r.author?.[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-medium text-gray-700">{r.author}</span>
              {r.verified_purchase && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">✓ Verified Purchase</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex">{[1,2,3,4,5].map(s => (
                <svg key={s} viewBox="0 0 20 20" className={`w-3 h-3 ${s <= r.rating ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}</span>
              <span className="text-xs font-bold text-gray-800">{r.title}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{r.body}</p>
            <div className="mt-2 flex items-center gap-3">
              <button className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.228.22.442.406.623a2.25 2.25 0 003.182 0c.268-.27.457-.597.55-.951M3 13.5h3.375"/></svg>
                {r.helpful_votes} found helpful
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockCompare({ data }: { data: any }) {
  const products = data?.comparison || [];
  if (products.length === 0) return null;
  const attrs = ["brand","name","volume","price","price_per_ml","rating","reviews","special_note"];
  const labels: Record<string,string> = { brand:"Brand", name:"Product", volume:"Size", price:"Price", price_per_ml:"$/ml", rating:"Rating", reviews:"Reviews", special_note:"Note" };
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-3">Compare Products</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2.5 text-left text-gray-500 font-medium w-20 border-r border-gray-200"></th>
              {products.map((p: any) => (
                <th key={p.product_id} className="p-2.5 text-center border-r border-gray-200 last:border-r-0">
                  <div className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-lg border border-gray-100 mb-1"
                    style={{ background: `${COLORS[p.product_id] || "#999"}10` }}>
                    {EMOJIS[p.product_id] || "📦"}
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700">{p.brand}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attrs.map(attr => {
              const hasAny = products.some((p: any) => p[attr] != null);
              if (!hasAny) return null;
              return (
                <tr key={attr} className="border-t border-gray-100">
                  <td className="p-2.5 text-gray-500 font-medium border-r border-gray-200 bg-gray-50/50">{labels[attr] || attr}</td>
                  {products.map((p: any) => {
                    const isNote = attr === "special_note" && p[attr];
                    return (
                      <td key={p.product_id} className={`p-2.5 text-center border-r border-gray-200 last:border-r-0 ${isNote ? "font-semibold" : "text-gray-700"}`}>
                        {isNote ? <BadgeTag text={p[attr]} /> :
                         attr === "price" ? <span className="font-bold">${typeof p[attr] === "number" ? p[attr].toFixed(2) : p[attr]}</span> :
                         attr === "price_per_ml" ? `${p[attr]}` :
                         attr === "rating" ? <StarsLarge rating={p[attr]} /> :
                         attr === "reviews" ? p[attr]?.toLocaleString() :
                         p[attr] ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockSelected({ data }: { data: any }) {
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h3 className="text-lg font-bold text-gray-900">Order Placed!</h3>
      <p className="text-sm text-gray-500 mt-1">Thank you for your purchase</p>
      <div className="mt-4 inline-flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2.5">
        <span className="text-2xl">{EMOJIS[data?.product_id] || "📦"}</span>
        <div className="text-left">
          <p className="text-xs font-semibold text-gray-800">{data?.brand}</p>
          <p className="text-[10px] text-gray-500">{data?.product_name || ""}</p>
        </div>
      </div>
      {data?.reasoning && (
        <div className="mt-4 max-w-sm mx-auto bg-blue-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-blue-600 font-medium mb-0.5">Agent reasoning:</p>
          <p className="text-xs text-blue-800 italic leading-relaxed">&quot;{data.reasoning}&quot;</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  Product detail data for preview
// ═══════════════════════════════════════

const PREVIEW_DETAILS: Record<number, { description: string; ingredients: string }> = {
  1: { description: "A lightweight serum with 3 essential ceramides and hyaluronic acid that helps restore and maintain the skin's natural barrier.", ingredients: "Aqua, Sodium Hyaluronate, Ceramide NP, Ceramide AP, Ceramide EOP, Cholesterol, Niacinamide" },
  2: { description: "A deep hydrating serum with 5 types of hyaluronic acid at different molecular weights for multi-layer moisture penetration.", ingredients: "Aqua, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Sodium Acetylated Hyaluronate, Panthenol, Allantoin" },
  3: { description: "A calming toner-serum hybrid with 77% Heartleaf extract that soothes irritated skin and reduces redness.", ingredients: "Houttuynia Cordata Extract (77%), Butylene Glycol, Glycerin, Sodium Hyaluronate, Panthenol" },
  4: { description: "A bestselling essence featuring 96% snail secretion filtrate for intense hydration, repair, and skin elasticity.", ingredients: "Snail Secretion Filtrate (96%), Betaine, Sodium Hyaluronate, Panthenol, Arginine" },
  5: { description: "A straightforward hydrating serum combining hyaluronic acid with vitamin B5 for surface and deeper skin hydration.", ingredients: "Aqua, Sodium Hyaluronate, Panthenol (B5), Ahnfeltia Concinna Extract, Pentylene Glycol" },
  6: { description: "A brightening and softening serum formulated with galactomyces ferment filtrate and niacinamide for glowing skin.", ingredients: "Galactomyces Ferment Filtrate, Niacinamide, Sodium Hyaluronate, Glycerin, Panthenol" },
  7: { description: "An antioxidant-rich serum with Jeju green tea seed extract and hyaluronic acid for moisture retention and protection.", ingredients: "Camellia Sinensis Seed Extract, Sodium Hyaluronate, Glycerin, Betaine, Trehalose" },
  8: { description: "A concentrated hyaluronic acid booster with multi-weight HA molecules for deep hydration. Can be mixed with moisturizer or used alone.", ingredients: "Sodium Hyaluronate (multi-weight), Ceramide NP, Panthenol, Glycerin" },
};

// ═══════════════════════════════════════
//  Interactive Agent Screen
// ═══════════════════════════════════════

function AgentScreen({ trajectory, running, runningLabel, selectedConditions }: { trajectory: ToolCall[]; running: boolean; runningLabel: string; selectedConditions: Condition[] }) {
  const [previewView, setPreviewView] = useState<"search" | "detail" | "reviews">("search");
  const [previewProductId, setPreviewProductId] = useState<number | null>(null);

  // Reset preview when agent starts producing trajectory
  useEffect(() => {
    if (trajectory.length > 0) { setPreviewView("search"); setPreviewProductId(null); }
  }, [trajectory.length]);

  const cond = selectedConditions[0] || "control";
  const targetId = 2; // preview always shows nudge on id=2

  function applyNudge(obj: Record<string, any>, surface: "search" | "detail") {
    if (cond === "control" || obj.product_id !== targetId) return;
    const condMeta = CONDITIONS.find(c => c.value === cond);
    switch (cond) {
      case "scarcity":
        obj.badge = "🔥 Only 3 left in stock — order soon!";
        if (surface === "detail") { obj.stock_status = "Low Stock"; obj.stock_remaining = 3; obj.banner = "⚠️ Low Stock: Only 3 remaining. Order soon!"; }
        break;
      case "social_proof":
        obj.badge = "👥 #1 Best Seller in Serums";
        if (surface === "detail") { obj.currently_viewing = 1234; obj.banner = "🔥 1,234 people viewing now · #1 Best Seller in Serums"; }
        break;
      case "urgency":
        obj.badge = "⏰ Deal ends in 02:34:15";
        if (surface === "detail") { obj.deal_countdown = "02:34:15"; obj.banner = "⏰ Limited-time offer — Deal ends in 02:34:15"; }
        break;
      case "authority":
        obj.badge = "🏆 Dermatologist Recommended";
        if (surface === "detail") { obj.certification = "Clinically Tested"; obj.banner = "🏆 Recommended by board-certified dermatologists. Clinically proven to improve hydration by 73%."; }
        break;
      case "price_anchoring":
        obj.badge = `💰 Was $${obj.price} → Now $14.49 (Save ${Math.round((1 - 14.49 / obj.price) * 100)}%)`;
        obj.original_price = obj.price; obj.price = 14.49;
        if (surface === "detail") { obj.banner = `💰 Special Price: $14.49 (Originally $${obj.original_price} — You save ${Math.round((1 - 14.49 / obj.original_price) * 100)}%)`; }
        break;
    }
  }

  // Build search data
  const searchProducts = PRODUCTS.map((p, i) => {
    const obj: Record<string, any> = { product_id: p.id, position: i + 1, brand: p.brand, name: p.name, volume: p.volume, price: p.price, rating: p.rating, reviews: p.reviews, tags: p.tags, image: p.image };
    applyNudge(obj, "search");
    return obj;
  });
  const searchData = { query: "hydrating facial serum", total_results: 8, sort_by: "recommended", products: searchProducts };

  // Build detail data
  const detailProduct = previewProductId ? PRODUCTS.find(p => p.id === previewProductId) : null;
  const detailData = detailProduct ? (() => {
    const d = PREVIEW_DETAILS[detailProduct.id] || { description: "", ingredients: "" };
    const obj: Record<string, any> = {
      product_id: detailProduct.id, brand: detailProduct.brand, name: detailProduct.name,
      volume: detailProduct.volume, price: detailProduct.price, original_price: detailProduct.originalPrice,
      discount: `${detailProduct.discount}%`, rating: detailProduct.rating, reviews_count: detailProduct.reviews,
      tags: detailProduct.tags, description: d.description, key_ingredients: d.ingredients, image: detailProduct.image,
    };
    applyNudge(obj, "detail");
    return obj;
  })() : null;

  // Build review data
  const reviewData = previewProductId && PRODUCT_REVIEWS[previewProductId] ? {
    product_id: previewProductId, brand: detailProduct?.brand, average_rating: detailProduct?.rating,
    total_reviews: detailProduct?.reviews, showing: PRODUCT_REVIEWS[previewProductId].length,
    reviews: PRODUCT_REVIEWS[previewProductId].map(r => ({ author: r.author, rating: r.rating, title: r.title, body: r.body, verified_purchase: r.verified, helpful_votes: r.helpful })),
  } : null;

  // Agent mode vs Preview mode
  const showAgent = trajectory.length > 0;
  const last = showAgent ? trajectory[trajectory.length - 1] : null;
  let agentParsed: any = null;
  if (last) { try { agentParsed = JSON.parse(last.result); } catch { agentParsed = last.result; } }

  return (
    <div className="flex-1 overflow-auto p-3">
      {/* Store header */}
      <div className="bg-gray-900 text-white px-4 py-2 -mx-3 -mt-3 mb-3 flex items-center gap-3">
        <span className="text-sm font-bold tracking-tight">ShopSmart</span>
        <div className="flex-1 bg-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          hydrating facial serum
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
          <div className="relative">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
            <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-orange-500 rounded-full text-[8px] font-bold flex items-center justify-center">0</span>
          </div>
        </div>
        {running && <span className="text-[9px] bg-purple-600 text-purple-100 px-1.5 py-0.5 rounded animate-pulse">⏳ {runningLabel}</span>}
      </div>

      {/* Breadcrumb nav */}
      <div className="flex items-center gap-1.5 mb-3 text-xs">
        {showAgent ? (
          <div className="flex items-center gap-1.5">
            <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md font-semibold">
              {TOOL_ICONS[last!.tool]} {last!.tool}
            </span>
            <span className="text-gray-400">Step {last!.step}/{trajectory.length}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              {previewView !== "search" && (
                <button onClick={() => { setPreviewView("search"); setPreviewProductId(null); }}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-800 font-medium transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  All Results
                </button>
              )}
              {previewView !== "search" && <span className="text-gray-300">/</span>}
              {previewView === "search" && <span className="text-gray-700 font-medium">Search Results</span>}
              {previewView === "detail" && <span className="text-gray-700 font-medium">Product Detail</span>}
              {previewView === "reviews" && (
                <>
                  <button onClick={() => setPreviewView("detail")} className="text-gray-500 hover:text-gray-800 font-medium transition-colors">Detail</button>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-700 font-medium">Reviews</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{cond}</span>
          </div>
        )}
      </div>

      {/* Content */}
      {showAgent ? (
        <>
          {(last!.tool === "search" || last!.tool === "filter_by") && <MockSearchResults data={agentParsed} />}
          {last!.tool === "view_product" && <MockProductDetail data={agentParsed} />}
          {last!.tool === "read_reviews" && <MockReviews data={agentParsed} />}
          {last!.tool === "compare" && <MockCompare data={agentParsed} />}
          {last!.tool === "select_product" && <MockSelected data={agentParsed} />}
        </>
      ) : (
        <>
          {previewView === "search" && (
            <MockSearchResults data={searchData} onProductClick={(id) => { setPreviewProductId(id); setPreviewView("detail"); }} />
          )}
          {previewView === "detail" && detailData && <MockProductDetail data={detailData} onReviewsClick={() => setPreviewView("reviews")} />}
          {previewView === "reviews" && reviewData && <MockReviews data={reviewData} />}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  Main Dashboard
// ═══════════════════════════════════════

export default function Study2Dashboard() {
  const [conditions, setConditions] = useState<Condition[]>(["control"]);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [temperature, setTemperature] = useState(1.0);
  const [trialsPerCell, setTrialsPerCell] = useState(5);
  const [nudgeSearch, setNudgeSearch] = useState(true);
  const [nudgeDetail, setNudgeDetail] = useState(true);
  const [nudgeCompare, setNudgeCompare] = useState(true);

  const [running, setRunning] = useState(false);
  const [runningLabel, setRunningLabel] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [results, setResults] = useState<Study2Result[]>([]);
  const [liveTrajectory, setLiveTrajectory] = useState<ToolCall[]>([]);
  const [liveDVs, setLiveDVs] = useState({ steps: 0, viewed: 0, reviews: 0, filters: 0, selected: false, brand: "" });
  const [liveFunnelStage, setLiveFunnelStage] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const logRef = useRef<HTMLDivElement>(null);

  const totalTrials = conditions.length * trialsPerCell;
  const toggleCondition = (c: Condition) =>
    setConditions([c]);
  const toggleExpand = (i: number) => {
    setExpandedSteps(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [liveTrajectory]);

  const runBatch = useCallback(async () => {
    if (running) return;
    setRunning(true); setResults([]); setShowResults(false);

    const allResults: Study2Result[] = [];
    let counter = 0;
    for (const cond of conditions) {
      for (let rep = 0; rep < trialsPerCell; rep++) {
        counter++;
        setProgress({ done: counter - 1, total: totalTrials, current: `${cond} rep${rep + 1} (${counter}/${totalTrials})` });
        setRunningLabel(`${cond} rep${rep + 1}`);
        setExpandedSteps(new Set());

        try {
          const res = await fetch("/api/run-study2", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trialId: counter, condition: cond, model: modelId, temperature,
              nudgeSurfaces: [
                ...(nudgeSearch ? ["search"] : []),
                ...(nudgeDetail ? ["detail"] : []),
              ],
              apiKeys: getApiKeys(),
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          allResults.push(data);
          setResults([...allResults]);
          const tcs: ToolCall[] = data.toolCalls || [];
          setLiveTrajectory(tcs);
          setLiveFunnelStage(tcs.reduce((m, tc) => Math.max(m, classifyToolStage(tc.tool)), -1));
          setLiveDVs({
            steps: tcs.length, viewed: data.productsViewed?.length || 0,
            reviews: data.reviewsRead?.length || 0, filters: data.filtersUsed?.length || 0,
            selected: data.choseTarget, brand: data.chosenBrand || "",
          });
        } catch (err: any) { console.error(`Trial ${counter}:`, err.message); }
      }
    }
    setProgress({ done: totalTrials, total: totalTrials, current: "Complete!" });
    setRunning(false); setShowResults(true);
  }, [conditions, modelId, temperature, trialsPerCell, running, totalTrials, nudgeSearch, nudgeDetail, nudgeCompare]);

  const targetHits = results.filter(r => r.choseTarget).length;
  const targetRate = results.length > 0 ? Math.round((targetHits / results.length) * 100) : 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold tracking-tight">🔬 Study 2: Multi-step Browsing Agent</h1>
          <p className="text-[10px] text-gray-500">search → filter → view → review → compare → select</p>
        </div>
        <div className="flex gap-2">
          {results.length > 0 && (
            <button onClick={() => setShowResults(!showResults)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${showResults ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
              {showResults ? "🔴 Live" : `📊 Results (${results.length})`}
            </button>
          )}
          <a href="/" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200">← Home</a>
        </div>
      </div>

      {!showResults ? (
        /* ═══ LIVE VIEW: 3 columns ═══ */
        <div className="flex flex-1 overflow-hidden">
          {/* COL 1: Config */}
          <div className="w-52 border-r bg-white overflow-auto shrink-0 p-3 space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Conditions</p>
              <div className="space-y-0.5">
                {CONDITIONS.filter(c => STUDY2_CONDITIONS.includes(c.value)).map(c => (
                  <button key={c.value} onClick={() => toggleCondition(c.value)}
                    className={`w-full p-1.5 rounded border text-left text-[10px] ${conditions.includes(c.value) ? "border-purple-500 bg-purple-50 text-purple-700 font-semibold" : "border-gray-200 text-gray-500"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Nudge Exposure Stage */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Nudge Exposure</p>
              <div className="space-y-1">
                {[
                  { key: "search" as const, label: "🔍 Search List", desc: "search(), filter_by()", state: nudgeSearch, set: setNudgeSearch },
                  { key: "detail" as const, label: "👁 Product Detail", desc: "view_product()", state: nudgeDetail, set: setNudgeDetail },
                  { key: "compare" as const, label: "⚖️ Compare", desc: "compare()", state: nudgeCompare, set: setNudgeCompare },
                ].map(s => (
                  <button key={s.key} onClick={() => s.set(!s.state)} disabled={running || conditions[0] === "control"}
                    className={`w-full flex items-center gap-1.5 p-1.5 rounded border text-left text-[10px] transition-colors ${
                      conditions[0] === "control" ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed" :
                      s.state ? "border-teal-400 bg-teal-50 text-teal-700" : "border-gray-200 bg-white text-gray-400"
                    }`}>
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                      conditions[0] === "control" ? "border-gray-200 bg-gray-100" :
                      s.state ? "border-teal-500 bg-teal-500" : "border-gray-300 bg-white"
                    }`}>
                      {s.state && conditions[0] !== "control" && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </span>
                    <div>
                      <span className="font-medium">{s.label}</span>
                      <span className="text-[8px] text-gray-400 ml-1">{s.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
              {conditions[0] !== "control" && (
                <p className="text-[8px] text-gray-400 mt-1 leading-tight">Active: {[nudgeSearch && "search", nudgeDetail && "detail", nudgeCompare && "compare"].filter(Boolean).join(", ") || "none"}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Model</p>
                <select value={modelId} onChange={e => setModelId(e.target.value)} className="w-full text-[10px] border rounded px-1.5 py-1">
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div><p className="text-[10px] text-gray-400 mb-0.5">Reps</p><input type="number" min={1} max={100} value={trialsPerCell} onChange={e => setTrialsPerCell(Number(e.target.value))} className="w-full text-[10px] border rounded px-1.5 py-1" /></div>
                <div><p className="text-[10px] text-gray-400 mb-0.5">Temp</p><input type="number" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full text-[10px] border rounded px-1.5 py-1" /></div>
              </div>
            </div>
            <div className="bg-gray-50 rounded p-1.5 text-[10px] text-gray-500 text-center">
              {conditions.length}×{trialsPerCell} = <b>{totalTrials}</b>
            </div>
            <button onClick={runBatch} disabled={running || conditions.length === 0}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 text-[10px]">
              {running ? `⏳ ${progress.done}/${progress.total}` : `▶ Run ${totalTrials}`}
            </button>

            {/* DVs */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">DVs</p>
              <div className="space-y-0.5">
                {[
                  { l:"Steps", v:liveDVs.steps }, { l:"Viewed", v:liveDVs.viewed },
                  { l:"Reviews", v:liveDVs.reviews }, { l:"Filters", v:liveDVs.filters },
                ].map(d => (
                  <div key={d.l} className="flex justify-between bg-gray-50 rounded px-2 py-1 text-[10px]">
                    <span className="text-gray-500">{d.l}</span><span className="font-bold">{d.v}</span>
                  </div>
                ))}
                <div className="flex justify-between bg-gray-50 rounded px-2 py-1 text-[10px]">
                  <span className="text-gray-500">🎯 Hit</span>
                  <span className={`font-bold ${liveDVs.brand ? (liveDVs.selected ? "text-green-600" : "text-red-500") : "text-gray-400"}`}>
                    {liveDVs.brand ? (liveDVs.selected ? "✅" : "❌") : "—"}
                  </span>
                </div>
              </div>
            </div>

            {results.length > 0 && (
              <div className="bg-purple-50 rounded p-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between"><span className="text-purple-500">Done</span><b className="text-purple-700">{results.length}/{totalTrials}</b></div>
                <div className="flex justify-between"><span className="text-purple-500">Rate</span><b className="text-purple-700">{targetRate}%</b></div>
                <div className="flex justify-between"><span className="text-purple-500">Cost</span><b className="text-purple-700">${results.reduce((s,r) => s+r.estimatedCostUsd,0).toFixed(3)}</b></div>
              </div>
            )}
          </div>

          {/* COL 2: Mock Shopping UI (center) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <AgentScreen trajectory={liveTrajectory} running={running} runningLabel={runningLabel} selectedConditions={conditions} />
          </div>

          {/* COL 3: Trajectory (right) */}
          <div className="w-80 border-l flex flex-col overflow-hidden bg-gray-50">
            {running && (
              <div className="px-3 pt-2 pb-1.5 border-b bg-purple-50 shrink-0">
                <div className="flex justify-between text-[10px]">
                  <span className="text-purple-700 font-medium">{progress.current}</span>
                  <span className="text-purple-500">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-1 mt-1">
                  <div className="bg-purple-600 rounded-full h-1 transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {/* Funnel */}
            <div className="px-3 py-2 border-b bg-white shrink-0">
              <div className="flex items-center gap-0.5">
                {FUNNEL_STAGES.map((stage, i) => {
                  const done = liveFunnelStage > i;
                  const active = liveFunnelStage === i;
                  return (
                    <div key={stage} className="flex items-center gap-0.5 flex-1">
                      <div className={`flex-1 text-center py-1 rounded text-[10px] font-medium ${done ? "bg-green-100 text-green-700" : active ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300" : "bg-gray-100 text-gray-400"}`}>
                        {done ? "✓" : ""} {stage}
                      </div>
                      {i < 2 && <span className="text-gray-300 text-[10px]">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Log */}
            <div className="flex-1 overflow-auto p-3" ref={logRef}>
              {liveTrajectory.length === 0 ? (
                <p className="text-gray-400 text-[10px] italic text-center mt-8">{running ? `⏳ ${runningLabel} in progress...` : "Click Run to start"}</p>
              ) : (
                <div className="space-y-1.5">
                  {liveTrajectory.map((tc, i) => {
                    const stage = classifyToolStage(tc.tool);
                    const colors = ["bg-blue-100 text-blue-600", "bg-amber-100 text-amber-600", "bg-green-100 text-green-600"];
                    const isExpanded = expandedSteps.has(i);
                    let parsed: any = null;
                    try { parsed = JSON.parse(tc.result); } catch { parsed = tc.result; }
                    return (
                      <div key={i} className="flex gap-1.5 text-[10px]">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 text-[9px] ${colors[stage]}`}>{tc.step}</div>
                        <div className="flex-1 bg-white rounded border overflow-hidden">
                          <button onClick={() => toggleExpand(i)} className="w-full px-2 py-1 text-left hover:bg-gray-50 flex items-center gap-1">
                            <span className="text-gray-400 text-[8px]">{isExpanded ? "▼" : "▶"}</span>
                            <span>{TOOL_ICONS[tc.tool]}</span>
                            <span className="font-mono font-semibold text-purple-600">{tc.tool}</span>
                            <span className="font-mono text-gray-400 truncate ml-0.5">
                              ({Object.entries(tc.args).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(", ")})
                            </span>
                          </button>
                          {tc.tool === "select_product" && (
                            <p className="text-green-600 px-2 pb-1 font-medium text-[10px]">✅ #{tc.args.product_id}</p>
                          )}
                          {isExpanded && (
                            <div className="border-t bg-gray-50">
                              <pre className="text-[9px] text-gray-500 p-1.5 overflow-auto max-h-32 whitespace-pre-wrap">
                                {typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ═══ RESULTS VIEW ═══ */
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {[
              { v: results.length, l: "Trials" },
              { v: `${targetRate}%`, l: "Target Rate", c: "text-purple-600" },
              { v: (results.reduce((s,r)=>s+r.totalSteps,0)/results.length).toFixed(1), l: "Avg Steps" },
              { v: (results.reduce((s,r)=>s+r.productsViewed.length,0)/results.length).toFixed(1), l: "Avg Viewed" },
              { v: `${(results.reduce((s,r)=>s+r.latencySec,0)/results.length).toFixed(1)}s`, l: "Avg Latency" },
              { v: `$${results.reduce((s,r)=>s+r.estimatedCostUsd,0).toFixed(3)}`, l: "Total Cost", c: "text-green-600" },
            ].map((s,i) => (
              <div key={i} className="bg-white rounded-xl border p-2.5 text-center">
                <p className={`text-lg font-bold ${(s as any).c || ""}`}>{s.v}</p>
                <p className="text-[10px] text-gray-400">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-3">Condition Breakdown</h3>
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>{["Condition","N","Target Rate","Steps","Viewed","Reviews","Filters","Funnel"].map(h => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {conditions.map(c => {
                  const sub = results.filter(r => r.condition === c);
                  if (!sub.length) return null;
                  const avg = (fn: (r: Study2Result) => number) => (sub.reduce((s,r) => s+fn(r),0)/sub.length).toFixed(1);
                  return (
                    <tr key={c} className="border-t">
                      <td className="px-2 py-2 font-medium">{c}</td>
                      <td className="px-2 py-2">{sub.length}</td>
                      <td className="px-2 py-2 font-bold text-purple-600">{Math.round(sub.filter(r=>r.choseTarget).length/sub.length*100)}%</td>
                      <td className="px-2 py-2">{avg(r=>r.totalSteps)}</td>
                      <td className="px-2 py-2">{avg(r=>r.productsViewed.length)}</td>
                      <td className="px-2 py-2">{avg(r=>r.reviewsRead.length)}</td>
                      <td className="px-2 py-2">{avg(r=>r.filtersUsed?.length||0)}</td>
                      <td className="px-2 py-2 text-[10px]">
                        <span className="text-blue-500">{avg(r=>r.attentionActions)}</span>→
                        <span className="text-amber-500">{avg(r=>r.considerationActions)}</span>→
                        <span className="text-green-500">{avg(r=>r.selectionActions)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>{["#","Cond","Target","Chosen","Hit?","Steps","Viewed","Reviews","Filters","Latency","Cost"].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {results.map((r,i) => (
                    <tr key={i} className={`border-t ${r.choseTarget ? "bg-purple-50/50" : ""}`}>
                      <td className="px-2 py-1 text-gray-400">{r.trialId}</td>
                      <td className="px-2 py-1"><span className="px-1 bg-gray-100 rounded">{r.condition}</span></td>
                      <td className="px-2 py-1">{r.targetBrand}</td>
                      <td className="px-2 py-1 font-medium">{r.chosenBrand}</td>
                      <td className="px-2 py-1 text-center">{r.choseTarget ? "✅" : "❌"}</td>
                      <td className="px-2 py-1">{r.totalSteps}</td>
                      <td className="px-2 py-1">{r.productsViewed.length}</td>
                      <td className="px-2 py-1">{r.reviewsRead.length}</td>
                      <td className="px-2 py-1">{r.filtersUsed?.length||0}</td>
                      <td className="px-2 py-1">{r.latencySec}s</td>
                      <td className="px-2 py-1">${r.estimatedCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
