"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PRODUCTS, type Condition, type Product } from "@/lib/products";

// ──────────────────────────────────────────────
//  Mock E-commerce Stimulus Page
//  URL params: ?condition=X&order=1,3,5,2,4,6,7,8&target=2
// ──────────────────────────────────────────────

function StimulusContent() {
  const params = useSearchParams();
  const condition = (params.get("condition") as Condition) || "control";
  const targetId = Number(params.get("target")) || 2; // default: Torriden

  const orderParam = params.get("order");
  let products: Product[];
  if (orderParam) {
    const ids = orderParam.split(",").map(Number);
    products = ids.map((id) => PRODUCTS.find((p) => p.id === id)!).filter(Boolean);
    if (products.length < PRODUCTS.length) {
      const usedIds = new Set(products.map((p) => p.id));
      products.push(...PRODUCTS.filter((p) => !usedIds.has(p.id)));
    }
  } else {
    products = [...PRODUCTS];
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <span className="text-xl font-bold text-gray-800 tracking-tight">ShopSmart</span>
          </div>
          <div className="flex-1 max-w-md mx-6">
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-500">
              <span className="mr-2">🔍</span>
              facial serum
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>🛒 Cart (0)</span>
            <span>👤 Account</span>
          </div>
        </div>
      </header>

      {/* Category Bar */}
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
          <span>Beauty & Personal Care</span>
          <span>›</span>
          <span>Skincare</span>
          <span>›</span>
          <span className="font-semibold text-gray-800">Serums & Essences</span>
        </div>
        <p className="text-sm text-gray-500">
          1–8 of 8 results for <span className="font-semibold text-orange-700">&quot;facial serum&quot;</span>
          &nbsp;&middot;&nbsp; Sort by: <span className="font-medium">Recommended</span>
        </p>
      </div>

      {/* Product Grid — 2×4 */}
      <div className="max-w-[1200px] mx-auto px-4 pb-8">
        <div className="grid grid-cols-4 gap-4" id="product-grid">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              condition={condition}
              position={index + 1}
              isTarget={product.id === targetId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  condition,
  position,
  isTarget,
}: {
  product: Product;
  condition: Condition;
  position: number;
  isTarget: boolean;
}) {
  const showBadge = isTarget && condition !== "control";

  return (
    <div
      className="bg-white rounded-lg border hover:shadow-md transition-shadow overflow-hidden flex flex-col"
      data-product-id={product.id}
      data-position={position}
      data-is-target={isTarget}
    >
      {/* Product Image */}
      <div className={`h-44 bg-gradient-to-br ${product.color} flex items-center justify-center relative`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.name}
          className="h-36 w-auto object-contain drop-shadow-sm"
        />
        <span className="absolute bottom-1 right-1 text-[9px] text-gray-400 bg-white/80 px-1 rounded">
          #{position}
        </span>
      </div>

      {/* Product Info */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{product.brand}</p>
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight mb-1.5">{product.name}</h3>
        <p className="text-xs text-gray-500 mb-1">{product.volume}</p>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-1.5">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-xs ${star <= Math.floor(product.rating) ? "text-amber-400" : "text-gray-300"}`}>★</span>
            ))}
          </div>
          <span className="text-xs text-gray-500">{product.rating}</span>
          <span className="text-xs text-gray-400">({product.reviews.toLocaleString()})</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-lg font-bold text-gray-800">${product.price.toFixed(2)}</span>
          {product.discount > 0 && (
            <>
              <span className="text-xs text-gray-400 line-through">${product.originalPrice.toFixed(2)}</span>
              <span className="text-xs text-green-600">-{product.discount}%</span>
            </>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {product.tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
        </div>

        <div className="flex-1" />

        {/* Marketing Badges — Target product only */}
        {showBadge && condition === "scarcity" && (
          <div className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-1.5 rounded mb-2 text-center">
            🔥 Only 3 left in stock — order soon!
          </div>
        )}
        {showBadge && condition === "social_proof" && (
          <div className="text-xs text-orange-600 font-semibold bg-orange-50 px-2 py-1.5 rounded mb-2 text-center">
            👥 1,234 people viewing · #1 Best Seller
          </div>
        )}
        {showBadge && condition === "urgency" && (
          <div className="text-xs text-yellow-700 font-semibold bg-yellow-50 px-2 py-1.5 rounded mb-2 text-center">
            ⏰ Deal ends in 02:34:15
          </div>
        )}

        <button className="w-full py-1.5 rounded-full text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-gray-800 transition">
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default function StimulusPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading stimulus...</div>}>
      <StimulusContent />
    </Suspense>
  );
}
