"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CONDITIONS, INPUT_MODES, MODELS, PRODUCTS,
  shufflePositions, generateSeed, pickTargetProduct,
  type Condition, type InputMode, type TrialResult,
} from "@/lib/products";
import { PROMPTS, PROMPT_VARIANTS } from "@/lib/prompts";
import { saveResult, loadResults } from "@/lib/store";

type Phase = "idle" | "capturing" | "analyzing" | "done" | "error";

export default function ExperimentLive() {
  const [condition, setCondition] = useState<Condition>("scarcity");
  const [promptId, setPromptId] = useState("vague");
  const [promptVariant, setPromptVariant] = useState("default");
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [inputMode, setInputMode] = useState<InputMode>("text_json");
  const [temperature, setTemperature] = useState(1.0);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [targetMode, setTargetMode] = useState<"random" | number>("random");

  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [highlightedProduct, setHighlightedProduct] = useState<number | null>(null);
  const [chosenPosition, setChosenPosition] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<TrialResult | null>(null);
  const [currentOrder, setCurrentOrder] = useState<number[]>(PRODUCTS.map((p) => p.id));
  const [currentTargetId, setCurrentTargetId] = useState<number>(2);
  const [currentSeed, setCurrentSeed] = useState<number>(0);

  const [history, setHistory] = useState<TrialResult[]>([]);
  const [trialCounter, setTrialCounter] = useState(0);

  useEffect(() => {
    const saved = loadResults();
    setHistory(saved);
    setTrialCounter(saved.length);
  }, []);

  const reasoningRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reasoningRef.current) reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
  }, [streamingText]);

  useEffect(() => {
    if (!streamingText) return;
    for (const p of PRODUCTS) {
      if (streamingText.includes(p.brand)) setHighlightedProduct(p.id);
    }
  }, [streamingText]);

  const runTrial = useCallback(async () => {
    if (phase === "capturing" || phase === "analyzing") return;
    setPhase("capturing");
    setPhaseMessage("Preparing...");
    setStreamingText("");
    setHighlightedProduct(null);
    setChosenPosition(null);
    setLastResult(null);

    const newTrialId = trialCounter + 1;
    setTrialCounter(newTrialId);
    const seed = generateSeed(newTrialId);
    setCurrentSeed(seed);
    const order = shuffleEnabled
      ? shufflePositions(PRODUCTS, seed).map((p) => p.id)
      : PRODUCTS.map((p) => p.id);
    setCurrentOrder(order);
    const targetId = targetMode === "random" ? pickTargetProduct(seed) : targetMode;
    setCurrentTargetId(targetId);

    try {
      let screenshotBase64: string | undefined;
      if (inputMode === "screenshot") {
        setPhaseMessage("Capturing screenshot...");
        screenshotBase64 = await captureStimulus(condition, order, targetId);
      }
      setPhase("analyzing");
      setPhaseMessage("AI agent analyzing...");

      const res = await fetch("/api/run-trial-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition, promptType: promptId, promptVariant,
          inputMode, model: modelId,
          screenshotBase64, trialId: newTrialId,
          targetProductId: targetId, temperature, seed,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "token") setStreamingText((prev) => prev + data.text);
            else if (data.type === "result") {
              setPhase("done");
              setPhaseMessage("Done \u2014 " + (data.choseTarget ? "\u2705 Target" : "\u274c Non-target"));
              setLastResult(data as TrialResult);
              setChosenPosition(data.chosenPosition);
              saveResult(data as TrialResult);
              setHistory((prev) => [...prev, data as TrialResult]);
            } else if (data.type === "error") {
              setPhase("error");
              setPhaseMessage(data.message);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setPhase("error");
      setPhaseMessage(err.message);
    }
  }, [condition, promptId, promptVariant, modelId, inputMode, trialCounter, temperature, shuffleEnabled, targetMode, phase]);

  async function captureStimulus(cond: Condition, order: number[], targetId: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;width:1280px;height:900px;border:none;";
      iframe.src = "/stimulus?condition=" + cond + "&order=" + order.join(",") + "&target=" + targetId;
      document.body.appendChild(iframe);
      iframe.onload = async () => {
        try {
          await new Promise((r) => setTimeout(r, 1000));
          const html2canvas = (await import("html2canvas")).default;
          const canvas = await html2canvas(iframe.contentDocument!.documentElement, {
            width: 1280, height: 900, windowWidth: 1280, windowHeight: 900, useCORS: true, scale: 1,
          });
          const TW = 800, sc = TW / canvas.width;
          const resized = document.createElement("canvas");
          resized.width = TW;
          resized.height = Math.round(canvas.height * sc);
          resized.getContext("2d")!.drawImage(canvas, 0, 0, TW, resized.height);
          document.body.removeChild(iframe);
          resolve(resized.toDataURL("image/jpeg", 0.7).split(",")[1]);
        } catch (err) { document.body.removeChild(iframe); reject(err); }
      };
      iframe.onerror = () => { document.body.removeChild(iframe); reject(new Error("iframe error")); };
    });
  }

  const PC: Record<Phase, { icon: string; color: string; pulse?: boolean }> = {
    idle: { icon: "\u23f8\ufe0f", color: "bg-gray-100 text-gray-600" },
    capturing: { icon: "\ud83d\udcf8", color: "bg-yellow-100 text-yellow-700", pulse: true },
    analyzing: { icon: "\ud83d\udd0d", color: "bg-blue-100 text-blue-700", pulse: true },
    done: { icon: "\u2705", color: "bg-green-100 text-green-700" },
    error: { icon: "\u274c", color: "bg-red-100 text-red-700" },
  };
  const pc = PC[phase];
  const targetHits = history.filter((r) => r.choseTarget).length;
  const targetRate = history.length > 0 ? Math.round((targetHits / history.length) * 100) : 0;
  const orderedProducts = currentOrder.map((id) => PRODUCTS.find((p) => p.id === id)!);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <a href="/" className="text-base font-bold">{"\ud83e\uddea"} B2A Live</a>
          <a href="/results" className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">{"\ud83d\udcca"} ({history.length})</a>
          <div className={"flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold " + pc.color + (pc.pulse ? " animate-pulse" : "")}>
            <span>{pc.icon}</span>
            <span>{phaseMessage || "Ready"}</span>
          </div>
        </div>
        <button onClick={runTrial} disabled={phase === "capturing" || phase === "analyzing"}
          className="px-5 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {"\u25b6"} Run Trial
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-56 border-r bg-white overflow-auto p-3 shrink-0 text-xs space-y-4">
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\ud83c\udfaf"} Condition</p>
            {CONDITIONS.map((c) => (
              <label key={c.value} className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (condition === c.value ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50")}>
                <input type="radio" name="condition" checked={condition === c.value} onChange={() => setCondition(c.value)} className="accent-blue-600" />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\ud83d\udde3\ufe0f"} Agency</p>
            {PROMPTS.map((p) => (
              <label key={p.id} className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (promptId === p.id ? "bg-purple-50 text-purple-700" : "hover:bg-gray-50")}>
                <input type="radio" name="prompt" checked={promptId === p.id} onChange={() => setPromptId(p.id)} className="accent-purple-600" />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\ud83d\udee1\ufe0f"} Variant</p>
            {PROMPT_VARIANTS.map((v) => (
              <label key={v.id} className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (promptVariant === v.id ? "bg-green-50 text-green-700" : "hover:bg-gray-50")}>
                <input type="radio" name="variant" checked={promptVariant === v.id} onChange={() => setPromptVariant(v.id)} className="accent-green-600" />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\ud83e\udd16"} Model</p>
            {MODELS.map((m) => (
              <label key={m.id} className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (modelId === m.id ? "bg-orange-50 text-orange-700" : "hover:bg-gray-50")}>
                <input type="radio" name="model" checked={modelId === m.id} onChange={() => setModelId(m.id)} className="accent-orange-600" />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\ud83c\udfd7\ufe0f"} Input Mode</p>
            {INPUT_MODES.map((m) => (
              <label key={m.value} className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (inputMode === m.value ? "bg-teal-50 text-teal-700" : "hover:bg-gray-50")}>
                <input type="radio" name="inputMode" checked={inputMode === m.value} onChange={() => setInputMode(m.value)} className="accent-teal-600" />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\ud83c\udfaf"} Target</p>
            <label className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (targetMode === "random" ? "bg-pink-50 text-pink-700" : "hover:bg-gray-50")}>
              <input type="radio" name="target" checked={targetMode === "random"} onChange={() => setTargetMode("random")} className="accent-pink-600" />
              <span>{"\ud83d\udd04"} Random</span>
            </label>
            {PRODUCTS.map((p) => (
              <label key={p.id} className={"flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer " + (targetMode === p.id ? "bg-pink-50 text-pink-700" : "hover:bg-gray-50")}>
                <input type="radio" name="target" checked={targetMode === p.id} onChange={() => setTargetMode(p.id)} className="accent-pink-600" />
                <span>{p.brand}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1.5">{"\u26a1"} Options</p>
            <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={shuffleEnabled} onChange={(e) => setShuffleEnabled(e.target.checked)} className="accent-blue-600" />
              <span>Position Shuffle</span>
            </label>
            <div className="flex items-center gap-1.5 px-2 py-1">
              <span className="text-gray-500">Temp:</span>
              <input type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-14 border rounded px-1 py-0.5 text-xs" />
            </div>
          </div>
        </div>

        {/* CENTER: Product Grid */}
        <div className="flex-1 overflow-auto p-3 border-r">
          <div className="text-[10px] text-gray-400 mb-2 flex items-center justify-between font-mono">
            <span>{"seed=" + currentSeed + " | target=" + (PRODUCTS.find(p=>p.id===currentTargetId)?.brand || "") + " (#" + currentTargetId + ")"}</span>
            <span>{condition + " \u00b7 " + promptId + " \u00b7 " + promptVariant}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {orderedProducts.map((product, idx) => {
              const isHighlighted = highlightedProduct === product.id;
              const isChosen = chosenPosition === (idx + 1);
              const isTarget = product.id === currentTargetId;
              return (
                <div key={product.id}
                  className={"rounded-lg border text-xs transition-all duration-300 overflow-hidden " +
                    (isChosen ? "ring-2 ring-blue-500 bg-blue-50 scale-[1.02]" :
                    isHighlighted ? "ring-2 ring-yellow-400 bg-yellow-50" : "bg-white")}>
                  <div className="h-24 bg-gray-50 flex items-center justify-center relative">
                    <img src={product.image} alt={product.brand} className="h-20 w-auto object-contain" />
                    <span className="absolute top-0.5 left-1 text-[9px] text-gray-400">{"#" + (idx + 1)}</span>
                    <div className="absolute top-0.5 right-1 flex gap-0.5">
                      {isTarget && <span className="text-[8px] px-1 bg-green-100 text-green-600 rounded font-medium">TGT</span>}
                      {isChosen && <span className="text-[8px] px-1 bg-blue-100 text-blue-600 rounded font-medium">SEL</span>}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <p className="font-semibold text-gray-700 truncate">{product.brand}</p>
                    <p className="text-gray-500 truncate text-[10px]">{product.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-bold">{"$" + product.price}</span>
                      {isTarget && condition === "urgency" && (
                        <>
                          <span className="text-gray-400 line-through text-[9px]">{"$" + product.originalPrice}</span>
                          <span className="text-green-600 text-[9px]">{"-" + product.discount + "%"}</span>
                        </>
                      )}
                      <span className="text-amber-500 text-[10px]">{"\u2605" + product.rating}</span>
                      <span className="text-gray-400 text-[9px]">{"(" + product.reviews.toLocaleString() + ")"}</span>
                    </div>
                    {isTarget && condition !== "control" && (
                      <div className="mt-0.5 text-[8px] text-red-500 font-medium truncate">
                        {CONDITIONS.find((c) => c.value === condition)?.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 bg-white rounded-lg border p-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500">
                {"Trials: " + history.length + " \u00b7 Target Rate: "}
                <span className="font-bold text-blue-600">{targetRate + "%"}</span>
                {" (" + targetHits + "/" + history.length + ")"}
              </span>
            </div>
            <div className="flex gap-0.5 flex-wrap max-h-10 overflow-hidden">
              {history.slice(-80).map((r, i) => (
                <div key={i}
                  className={"w-4 h-4 rounded text-[7px] flex items-center justify-center font-bold " +
                    (r.choseTarget ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500")}
                  title={"#" + r.trialId + ": " + r.chosenBrand + " (" + r.condition + ")"}>
                  {r.choseTarget ? "\u2713" : "\u00d7"}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Agent Reasoning */}
        <div className="w-[400px] flex flex-col overflow-hidden shrink-0">
          <div className="p-2 border-b bg-white text-[10px] text-gray-500 font-mono flex justify-between">
            <span>{modelId + " \u00b7 temp=" + temperature}</span>
            {lastResult && (
              <span>{lastResult.inputTokens + "in/" + lastResult.outputTokens + "out \u00b7 $" + (lastResult.estimatedCostUsd || 0).toFixed(4) + " \u00b7 " + lastResult.latencySec + "s"}</span>
            )}
          </div>
          <div ref={reasoningRef} className="flex-1 overflow-auto p-3 bg-gray-50">
            {streamingText ? (
              <div className="bg-white rounded-lg shadow-sm p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {streamingText}
                {phase === "analyzing" && <span className="inline-block w-2 h-4 bg-blue-500 ml-0.5 animate-pulse" />}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-20">
                <p className="text-3xl mb-2">{"\ud83e\udd16"}</p>
                <p className="text-sm">{"\u25b6 Run Trial"}</p>
              </div>
            )}
            {lastResult && (
              <div className={"mt-3 bg-white rounded-lg shadow-sm p-3 border-l-4 text-xs " + (lastResult.choseTarget ? "border-green-500" : "border-red-400")}>
                <p className="font-semibold">
                  {lastResult.choseTarget ? "\u2705 Target Selected" : "\u274c Non-target Selected"}
                  {" \u2014 " + lastResult.chosenBrand}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 font-mono">
                  {"target=" + lastResult.targetBrand + "(pos " + lastResult.targetPosition + ") \u00b7 chosen=pos " + lastResult.chosenPosition + " \u00b7 seed=" + lastResult.seed}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
