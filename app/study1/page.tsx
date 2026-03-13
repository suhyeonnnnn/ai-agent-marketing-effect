"use client";

import { useState, useCallback, useRef } from "react";
import {
  CONDITIONS, INPUT_MODES, MODELS, PRODUCTS,
  generateSeed, shufflePositions, pickTargetProduct,
  type Condition, type InputMode, type TrialResult,
} from "@/lib/products";
import { PROMPTS, PROMPT_VARIANTS } from "@/lib/prompts";
import { saveResults } from "@/lib/store";
import { getApiKeys } from "@/lib/api-keys";
import { CATEGORY_LIST, type CategoryId, type CategoryConfig, withLocalImages } from "@/lib/categories";

const STUDY1_CONDITIONS: Condition[] = ["control", "scarcity", "social_proof_a", "social_proof_b", "urgency", "authority_a", "authority_b", "price_anchoring"];

/** Get category-specific badge text, falling back to default CONDITIONS badge */
function getCategoryBadge(condition: string, condMeta: any, category?: CategoryConfig, product?: any): string {
  const cm = category?.marketing;
  if (!cm) return condMeta?.badge || "";
  switch (condition) {
    case "social_proof_a": return cm.socialProofBadgeA || condMeta?.badge || "";
    case "social_proof_b": return cm.socialProofBadgeB || condMeta?.badge || "";
    case "authority_a": return cm.authorityBadgeA || condMeta?.badge || "";
    case "authority_b": return cm.authorityBadgeB || condMeta?.badge || "";
    case "price_anchoring": {
      if (!product) return condMeta?.badge || "";
      const orig = cm.anchoringOriginalPrice || product.originalPrice || (product.price * 1.2);
      const pct = Math.round((1 - product.price / orig) * 100);
      return `Was $${orig.toFixed(2)} \u2192 Now $${product.price.toFixed(2)} (Save ${pct}%)`;
    }
    default: return condMeta?.badge || "";
  }
}
const EMOJIS: Record<number, string> = { 1:"🧴", 2:"💧", 3:"🌿", 4:"🐌", 5:"⚗️", 6:"✨", 7:"🍵", 8:"🔬" };
const COLORS: Record<number, string> = { 1:"#1a6fb0", 2:"#2d8f6f", 3:"#d4763a", 4:"#c94c6e", 5:"#8a8578", 6:"#7b5ea7", 7:"#4a9e6d", 8:"#3a3a5c" };

// ═══════════════════════════════════════
//  E-commerce UI Components (Study 1)
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
      {count != null && <span className="text-xs text-blue-600">({count.toLocaleString()})</span>}
    </span>
  );
}

function BadgeTag({ text, condition }: { text: string; condition?: string }) {
  const colorCls = condition === "scarcity" ? "bg-red-600 text-white" :
    condition?.startsWith("social_proof") ? "bg-orange-500 text-white" :
    condition === "urgency" ? "bg-yellow-500 text-gray-900" :
    condition?.startsWith("authority") ? "bg-blue-600 text-white" :
    condition === "price_anchoring" ? "bg-green-600 text-white" :
    "bg-gray-700 text-white";
  return <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded ${colorCls}`}>{text}</span>;
}

function MockProductGrid({ condition, targetId, positionOrder, chosenId, category }: {
  condition: Condition; targetId: number; positionOrder: number[]; chosenId?: number; category?: CategoryConfig;
}) {
  const condMeta = CONDITIONS.find(c => c.value === condition);
  const catProducts = category?.products || PRODUCTS;
  const ordered = positionOrder.length > 0
    ? positionOrder.map(id => catProducts.find((p: any) => p.id === id)!).filter(Boolean)
    : catProducts;

  return (
    <div className="flex-1 overflow-auto p-3">
      {/* Store header */}
      <div className="bg-gray-900 text-white px-4 py-2 -mx-3 -mt-3 mb-3 flex items-center gap-3">
        <span className="text-sm font-bold tracking-tight">ShopSmart</span>
        <div className="flex-1 bg-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          {category?.searchQuery || "hydrating facial serum"}
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
          <div className="relative">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
            <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-orange-500 rounded-full text-[8px] font-bold flex items-center justify-center">0</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-gray-700 font-medium">Search Results</span>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{condition}</span>
      </div>

      {/* Results info */}
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
        <span>{ordered.length} results</span>
        <span className="text-gray-300">|</span>
        <span>Sort: <span className="text-gray-700 font-medium">recommended</span></span>
      </div>

      {/* Product grid 4×2 */}
      <div className="grid grid-cols-4 gap-2.5">
        {ordered.map((p) => {
          const isTarget = p.id === targetId;
          const isChosen = p.id === chosenId;
          const isPriceAnchoring = isTarget && condition === "price_anchoring";
          const showBadge = isTarget && condition !== "control" && condMeta;
          const anchoringOriginalPrice = category?.marketing?.anchoringOriginalPrice ?? p.originalPrice ?? (p.price * 1.2);
          const price = p.price;  // ★ Price NEVER changes — anchoring is framing only

          return (
            <div key={p.id}
              className={`bg-white rounded-lg border p-2.5 relative transition-shadow hover:shadow-sm
                ${isChosen ? "ring-2 ring-blue-500 shadow-md" : ""}`}>
              {isChosen && (
                <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-blue-500 text-white text-[9px] font-bold pl-1.5 pr-2 py-0.5 rounded-full shadow">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Selected
                </div>
              )}
              {/* Image */}
              <div className="w-full h-24 rounded-md flex items-center justify-center mb-2 bg-gray-50 overflow-hidden">
                <img src={p.image} alt={p.name} className="h-full object-contain" onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; const parent = img.parentElement; if (parent) parent.innerHTML = `<span class="text-2xl">${EMOJIS[p.id] || '📦'}</span>`; }} />
              </div>
              {/* Info */}
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{p.brand}</p>
              <p className="text-[11px] font-medium text-gray-800 leading-snug mt-0.5 line-clamp-2">{p.name}</p>
              <div className="mt-1">
                <span className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} viewBox="0 0 20 20" className={`w-2.5 h-2.5 ${s <= Math.floor(p.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                  <span className="text-[10px] text-gray-600 font-medium ml-0.5">{p.rating}</span>
                  <span className="text-[10px] text-blue-600 ml-0.5">({p.reviews.toLocaleString()})</span>
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[13px] font-bold text-gray-900">${price.toFixed(2)}</span>
                {isPriceAnchoring && <span className="text-[10px] text-gray-400 line-through">${anchoringOriginalPrice.toFixed(2)}</span>}
                {isPriceAnchoring && <span className="text-[9px] font-semibold text-green-600 bg-green-50 px-1 py-0.5 rounded">Save {Math.round((1 - p.price / anchoringOriginalPrice) * 100)}%</span>}
              </div>
              {showBadge && (
                <div className="mt-1.5"><BadgeTag condition={condition} text={`${condition === "scarcity" ? "🔥" : condition?.startsWith("social_proof") ? "👥" : condition === "urgency" ? "⏰" : condition?.startsWith("authority") ? "🏆" : condition === "price_anchoring" ? "💰" : ""} ${getCategoryBadge(condition, condMeta, category, p)}`} /></div>
              )}
              <div className="mt-1.5 text-[9px] text-green-600 font-medium">Free Shipping</div>
            </div>
          );
        })}
      </div>

      {/* Agent response */}
      {chosenId != null && (
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="text-xs font-bold text-gray-800">
              Agent chose: {catProducts.find((p: any) => p.id === chosenId)?.brand || "Unknown"}
            </span>
            <span className={`text-xs font-bold ml-auto ${chosenId === targetId ? "text-green-600" : "text-red-500"}`}>
              {chosenId === targetId ? "✅ Hit" : "❌ Miss"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  Main Dashboard
// ═══════════════════════════════════════

export default function Study1Dashboard() {
  const [categoryId, setCategoryId] = useState<CategoryId>("serum");
  const activeCategory = withLocalImages(CATEGORY_LIST.find(c => c.id === categoryId) || CATEGORY_LIST[0]);
  const [conditions, setConditions] = useState<Condition[]>(["control"]);
  const [promptIds, setPromptIds] = useState<string[]>(["vague"]);
  const [promptVariant, setPromptVariant] = useState("default");
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [inputMode, setInputMode] = useState<InputMode>("text_json");
  const [temperature, setTemperature] = useState(1.0);
  const [trialsPerCell, setTrialsPerCell] = useState(10);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [targetRotation, setTargetRotation] = useState(true);
  const [enableManipCheck, setEnableManipCheck] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "", cost: 0 });
  const [results, setResults] = useState<TrialResult[]>([]);
  // Current trial state for live grid
  const [liveTrial, setLiveTrial] = useState<{ condition: Condition; targetId: number; positionOrder: number[]; chosenId?: number; reasoning?: string } | null>(null);

  const totalTrials = conditions.length * promptIds.length * trialsPerCell;

  const toggleCondition = (c: Condition) =>
    setConditions([c]);
  const togglePrompt = (p: string) =>
    setPromptIds((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const runBatch = useCallback(async () => {
    if (running) return;
    setRunning(true); setResults([]);

    const allResults: TrialResult[] = [];
    let counter = 0, totalCost = 0;
    const total = totalTrials;
    setProgress({ done: 0, total, current: "Starting...", cost: 0 });

    for (const cond of conditions) {
      for (const prompt of promptIds) {
        for (let rep = 0; rep < trialsPerCell; rep++) {
          counter++;
          const seed = generateSeed(counter);
          const catProducts = activeCategory.products as any[];
          const targetId = targetRotation ? pickTargetProduct(seed, catProducts) : catProducts[1]?.id || 2;
          const shuffled = shufflePositions(catProducts as any, seed);
          const posOrder = shuffled.map(p => p.id);

          setProgress({ done: counter - 1, total, current: `${cond} × ${prompt} (${counter}/${total})`, cost: totalCost });
          setLiveTrial({ condition: cond, targetId, positionOrder: posOrder });

          try {
            const res = await fetch("/api/run-trial", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ condition: cond, promptType: prompt, promptVariant, inputMode, model: modelId, trialId: counter, targetProductId: targetId, temperature, seed, enableManipCheck, apiKeys: getApiKeys(), categoryId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            allResults.push(data as TrialResult);
            totalCost += data.estimatedCostUsd || 0;
            setResults([...allResults]);

            // Show chosen product
            setLiveTrial({ condition: cond, targetId, positionOrder: data.positionOrder || posOrder, chosenId: data.chosenProductId, reasoning: data.reasoning });
          } catch (err: any) { console.error(`Trial ${counter}:`, err.message); }
        }
      }
    }
    saveResults(allResults);
    setProgress({ done: total, total, current: "Complete!", cost: totalCost });
    setRunning(false);
  }, [conditions, promptIds, promptVariant, modelId, inputMode, temperature, trialsPerCell, shuffleEnabled, targetRotation, enableManipCheck, running, totalTrials, categoryId, activeCategory]);

  const targetHits = results.filter(r => r.choseTarget).length;
  const targetRate = results.length > 0 ? Math.round((targetHits / results.length) * 100) : 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold tracking-tight">📋 Study 1: Single-turn Nudge Effect</h1>
          <p className="text-[10px] text-gray-500">Agent sees one product grid → makes a single choice</p>
        </div>
        <a href="/" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200">← Home</a>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* COL 1: Config */}
        <div className="w-52 border-r bg-white overflow-auto shrink-0 p-3 space-y-3">
          {/* Category Selector */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Category</p>
            <div className="space-y-0.5">
              {CATEGORY_LIST.map(cat => (
                <button key={cat.id} onClick={() => setCategoryId(cat.id)}
                  className={`w-full p-1.5 rounded border text-left text-[10px] flex items-center gap-1.5 ${
                    categoryId === cat.id ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}>
                  <span>{cat.id === "serum" ? "🧴" : cat.id === "smartwatch" ? "⌚" : cat.id === "milk" ? "🥛" : "👗"}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Conditions</p>
            <div className="space-y-0.5">
              {CONDITIONS.filter(c => STUDY1_CONDITIONS.includes(c.value)).map(c => (
                <button key={c.value} onClick={() => toggleCondition(c.value)}
                  className={`w-full p-1.5 rounded border text-left text-[10px] ${conditions.includes(c.value) ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold" : "border-gray-200 text-gray-500"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Agency</p>
            <div className="space-y-0.5">
              {PROMPTS.map(p => (
                <button key={p.id} onClick={() => togglePrompt(p.id)}
                  className={`w-full p-1.5 rounded border text-left text-[10px] ${promptIds.includes(p.id) ? "border-purple-500 bg-purple-50 text-purple-700 font-semibold" : "border-gray-200 text-gray-500"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Model</p>
              <select value={modelId} onChange={e => setModelId(e.target.value)} className="w-full text-[10px] border rounded px-1.5 py-1">
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Input Mode</p>
              <div className="space-y-0.5">
                {INPUT_MODES.map(m => (
                  <button key={m.value} onClick={() => setInputMode(m.value)}
                    className={`w-full p-1 rounded border text-[9px] text-left ${inputMode === m.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Variant</p>
              <select value={promptVariant} onChange={e => setPromptVariant(e.target.value)} className="w-full text-[10px] border rounded px-1.5 py-1">
                {PROMPT_VARIANTS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div><p className="text-[10px] text-gray-400 mb-0.5">Reps</p><input type="number" min={1} max={500} value={trialsPerCell} onChange={e => setTrialsPerCell(Number(e.target.value))} className="w-full text-[10px] border rounded px-1.5 py-1" /></div>
            <div><p className="text-[10px] text-gray-400 mb-0.5">Temp</p><input type="number" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full text-[10px] border rounded px-1.5 py-1" /></div>
          </div>
          <div className="flex gap-1">
            {[
              { label: "Shuf", val: shuffleEnabled, set: () => setShuffleEnabled(!shuffleEnabled) },
              { label: "Rot", val: targetRotation, set: () => setTargetRotation(!targetRotation) },
              { label: "MC", val: enableManipCheck, set: () => setEnableManipCheck(!enableManipCheck) },
            ].map(t => (
              <button key={t.label} onClick={t.set}
                className={`flex-1 py-1 rounded text-[9px] font-medium border ${t.val ? "bg-green-50 text-green-700 border-green-300" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                {t.val ? "✓" : "✗"} {t.label}
              </button>
            ))}
          </div>
          <div className="bg-gray-50 rounded p-1.5 text-[10px] text-gray-500 text-center">
            {conditions.length}×{promptIds.length}×{trialsPerCell} = <b>{totalTrials}</b>
          </div>
          <button onClick={runBatch} disabled={running || conditions.length === 0 || promptIds.length === 0}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 text-[10px]">
            {running ? `⏳ ${progress.done}/${progress.total} · $${progress.cost.toFixed(3)}` : `▶ Run ${totalTrials}`}
          </button>

          {/* Batch stats */}
          {results.length > 0 && (
            <div className="bg-blue-50 rounded p-2 space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-blue-500">Done</span><b className="text-blue-700">{results.length}/{totalTrials}</b></div>
              <div className="flex justify-between"><span className="text-blue-500">Rate</span><b className="text-blue-700">{targetRate}%</b></div>
              <div className="flex justify-between"><span className="text-blue-500">Cost</span><b className="text-blue-700">${results.reduce((s,r) => s+(r.estimatedCostUsd||0),0).toFixed(3)}</b></div>
            </div>
          )}
        </div>

        {/* COL 2: Mock Shopping UI (center) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <MockProductGrid
            condition={liveTrial?.condition || conditions[0] || "control"}
            targetId={liveTrial?.targetId || 2}
            positionOrder={liveTrial?.positionOrder || activeCategory.products.map(p => p.id)}
            chosenId={liveTrial?.chosenId}
            category={activeCategory}
          />
        </div>

        {/* COL 3: Results table (right) */}
        <div className="w-[480px] border-l overflow-auto shrink-0 p-3 space-y-3">
          {running && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 shrink-0">
              <div className="flex justify-between text-[10px]">
                <span className="text-blue-700 font-medium">{progress.current}</span>
                <span className="text-blue-500">${progress.cost.toFixed(3)}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-1 mt-1.5">
                <div className="bg-blue-600 rounded-full h-1 transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2">
            {[
              { v: results.length, l: "Trials" },
              { v: `${targetRate}%`, l: "Target Rate", c: "text-blue-600" },
              { v: targetHits, l: "Hits" },
              { v: results.length > 0 ? `${(results.reduce((s,r)=>s+r.latencySec,0)/results.length).toFixed(1)}s` : "—", l: "Avg Lat" },
              { v: `$${results.reduce((s,r)=>s+(r.estimatedCostUsd||0),0).toFixed(3)}`, l: "Cost", c: "text-green-600" },
            ].map((s,i) => (
              <div key={i} className="bg-white rounded-lg border p-2 text-center">
                <p className={`text-lg font-bold ${(s as any).c || ""}`}>{s.v}</p>
                <p className="text-[9px] text-gray-400">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="max-h-[calc(100vh-220px)] overflow-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>{["#","Cond","Agency","Mode","Target","Chosen","Hit?","MC","Lat","Cost"].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={`border-t hover:bg-gray-50 ${r.choseTarget ? "bg-blue-50/50" : ""}`}>
                      <td className="px-2 py-1 text-gray-400">{r.trialId}</td>
                      <td className="px-2 py-1"><span className="px-1 bg-gray-100 rounded">{r.condition}</span></td>
                      <td className="px-2 py-1">{r.promptType}</td>
                      <td className="px-2 py-1">{r.inputMode}</td>
                      <td className="px-2 py-1 font-medium">{r.targetBrand}</td>
                      <td className="px-2 py-1 font-medium">{r.chosenBrand}</td>
                      <td className="px-2 py-1 text-center">{r.choseTarget ? "✅" : "❌"}</td>
                      <td className="px-2 py-1 text-center">{r.manipulationCheck?.noticed ? "👁" : r.condition === "control" ? "—" : "🚫"}</td>
                      <td className="px-2 py-1">{r.latencySec}s</td>
                      <td className="px-2 py-1">${(r.estimatedCostUsd||0).toFixed(4)}</td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-[10px]">Click Run to start experiment</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
