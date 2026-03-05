"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getApiKeys, type ApiKeys } from "@/lib/api-keys";

const KEY_STORAGE = "b2a-api-keys";

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeys>({ openai: "", anthropic: "", gemini: "" });
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    setKeys(getApiKeys());
  }, []);

  const handleSave = () => {
    localStorage.setItem(KEY_STORAGE, JSON.stringify(keys));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    localStorage.removeItem(KEY_STORAGE);
    setKeys({ openai: "", anthropic: "", gemini: "" });
  };

  const mask = (key: string) => {
    if (!key || showKeys) return key;
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">← Back to Home</Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">🔑 API Key Settings</h1>
        <p className="text-sm text-gray-500 mb-6">
          API keys are stored in your browser's localStorage only. They are sent to the server per-request and never persisted on the server.
        </p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {[
            { id: "openai", label: "OpenAI", placeholder: "sk-...", color: "green" },
            { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-...", color: "blue" },
            { id: "gemini", label: "Google Gemini", placeholder: "AI...", color: "yellow" },
          ].map(({ id, label, placeholder, color }) => (
            <div key={id}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{label} API Key</label>
              <input
                type={showKeys ? "text" : "password"}
                value={keys[id as keyof ApiKeys]}
                onChange={(e) => setKeys(prev => ({ ...prev, [id]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {keys[id as keyof ApiKeys] && (
                <p className="text-xs text-gray-400 mt-1">Current: {mask(keys[id as keyof ApiKeys])}</p>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} className="rounded" />
              Show keys
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {saved ? "✓ Saved!" : "Save Keys"}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs text-yellow-800">
            <strong>Security note:</strong> Keys are stored in localStorage and sent to the Next.js API route (server-side) for each LLM call. They are never logged or persisted on the server. For production use, consider using environment variables on Vercel instead.
          </p>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p className="font-semibold mb-2">Which keys do you need?</p>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>• <strong>OpenAI</strong> — for GPT-4o, GPT-4o Mini</li>
            <li>• <strong>Anthropic</strong> — for Claude Sonnet 4.5, Claude Haiku 4.5</li>
            <li>• <strong>Gemini</strong> — for Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
