"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-2xl w-full px-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🧪 Shopping Agent Experiment Lab</h1>
          <p className="text-gray-500 mt-2">Do persuasion strategies designed for humans affect AI shopping agents?</p>
          <p className="text-xs text-gray-400 mt-1">KAIST AIBA Lab · Lee Suhyeon</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/study1"
            className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📋</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Single-turn</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Study 1</h2>
            <p className="text-sm text-gray-600 mb-3">Single-page Nudge Effect</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              4 conditions × 3 agency levels × 3 input modes.
              Agent sees one product grid and makes a single choice.
            </p>
            <div className="mt-4 flex flex-wrap gap-1">
              {["Text JSON", "Text Flat", "Screenshot"].map((t) => (
                <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
            <p className="text-xs text-blue-500 font-medium mt-4 group-hover:underline">Open Dashboard →</p>
          </Link>

          <Link href="/study2"
            className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-purple-400 hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔬</span>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Multi-step</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Study 2</h2>
            <p className="text-sm text-gray-600 mb-3">Multi-step Browsing Agent</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              6 conditions via tool-use API.
              Agent searches, views, reads reviews, and selects.
            </p>
            <div className="mt-4 flex flex-wrap gap-1">
              {["search", "filter_by", "view_product", "read_reviews", "select"].map((t) => (
                <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{t}</span>
              ))}
            </div>
            <p className="text-xs text-purple-500 font-medium mt-4 group-hover:underline">Open Dashboard →</p>
          </Link>
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <Link href="/settings" className="text-xs text-gray-400 hover:text-gray-600">🔑 API Key Settings</Link>
          <Link href="/stimulus" className="text-xs text-gray-400 hover:text-gray-600">🖼 Stimulus Preview</Link>
          <Link href="/results" className="text-xs text-gray-400 hover:text-gray-600">📊 Results Analysis</Link>
        </div>
      </div>
    </div>
  );
}
