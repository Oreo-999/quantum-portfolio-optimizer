import React, { useState, useRef, useCallback } from "react";

const MAX_TICKERS = 10;

const POPULAR = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "BRK-B", "V"];

export default function TickerInput({
  tickers, setTickers,
  riskTolerance, setRiskTolerance,
  apiKey, setApiKey,
  useSimulator, setUseSimulator,
  onSubmit, loading, error,
}) {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const inputRef = useRef(null);

  const addTicker = useCallback((raw) => {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
      setInputError("Invalid ticker format");
      return;
    }
    if (tickers.includes(ticker)) {
      setInputError("Already added");
      return;
    }
    if (tickers.length >= MAX_TICKERS) {
      setInputError(`Maximum ${MAX_TICKERS} tickers`);
      return;
    }
    setTickers((prev) => [...prev, ticker]);
    setInput("");
    setInputError("");
  }, [tickers, setTickers]);

  const removeTicker = useCallback((t) => {
    setTickers((prev) => prev.filter((x) => x !== t));
  }, [setTickers]);

  const handleKeyDown = (e) => {
    if (["Enter", ",", " "].includes(e.key)) {
      e.preventDefault();
      addTicker(input);
    }
    if (e.key === "Backspace" && !input && tickers.length > 0) {
      setTickers((prev) => prev.slice(0, -1));
    }
  };

  const riskLabel =
    riskTolerance < 0.33 ? "Conservative" : riskTolerance < 0.67 ? "Balanced" : "Aggressive";

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-neutral-50">Configure Portfolio</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Add 2–10 stock tickers to analyze</p>
      </div>

      {/* Ticker input area */}
      <div>
        <label className="label mb-2 block">Stocks</label>
        <div
          className="min-h-[52px] bg-surface border border-surface-border rounded-lg px-3 py-2 flex flex-wrap gap-2 cursor-text focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-colors"
          onClick={() => inputRef.current?.focus()}
        >
          {tickers.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 bg-accent-dim border border-accent/30 text-accent-light text-xs font-mono font-medium px-2.5 py-1 rounded-md"
            >
              {t}
              <button
                onClick={(e) => { e.stopPropagation(); removeTicker(t); }}
                className="text-accent/60 hover:text-accent-light transition-colors"
              >
                ×
              </button>
            </span>
          ))}
          {tickers.length < MAX_TICKERS && (
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value.toUpperCase()); setInputError(""); }}
              onKeyDown={handleKeyDown}
              onBlur={() => input && addTicker(input)}
              placeholder={tickers.length === 0 ? "Type a ticker and press Enter…" : ""}
              className="bg-transparent border-none outline-none text-sm text-neutral-50 placeholder-neutral-600 font-mono min-w-[140px] flex-1"
            />
          )}
        </div>
        {inputError && <p className="text-xs text-red-400 mt-1">{inputError}</p>}

        {/* Popular chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {POPULAR.filter((t) => !tickers.includes(t)).slice(0, 6).map((t) => (
            <button
              key={t}
              onClick={() => addTicker(t)}
              disabled={tickers.length >= MAX_TICKERS}
              className="text-xs font-mono text-neutral-500 hover:text-neutral-300 hover:bg-surface-hover border border-surface-border px-2 py-0.5 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +{t}
            </button>
          ))}
        </div>
      </div>

      {/* Risk tolerance */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="label">Risk Tolerance</label>
          <span className="text-xs font-medium text-accent-light">{riskLabel}</span>
        </div>
        <input
          type="range" min="0" max="1" step="0.01"
          value={riskTolerance}
          onChange={(e) => setRiskTolerance(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-surface-border rounded-full appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
          <span>Min risk</span>
          <span>Max return</span>
        </div>
      </div>

      {/* Backend toggle */}
      <div>
        <label className="label mb-3 block">Quantum Backend</label>
        <div className="flex gap-3">
          <button
            onClick={() => setUseSimulator(true)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
              useSimulator
                ? "bg-accent-dim border-accent/40 text-accent-light"
                : "bg-surface border-surface-border text-neutral-500 hover:border-neutral-600"
            }`}
          >
            AerSimulator
          </button>
          <button
            onClick={() => setUseSimulator(false)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
              !useSimulator
                ? "bg-accent-dim border-accent/40 text-accent-light"
                : "bg-surface border-surface-border text-neutral-500 hover:border-neutral-600"
            }`}
          >
            IBM Hardware
          </button>
        </div>
        {!useSimulator && (
          <p className="text-[11px] text-amber-400/70 mt-2">
            Real hardware requires an IBM Quantum API key and ≤5 stocks
          </p>
        )}
      </div>

      {/* IBM API key */}
      {!useSimulator && (
        <div className="animate-fade-in">
          <label className="label mb-2 block">IBM Quantum API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your IBM Quantum API key…"
            className="input-field font-mono"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={loading || tickers.length < 2}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Optimizing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Optimize Portfolio
          </>
        )}
      </button>
    </div>
  );
}
