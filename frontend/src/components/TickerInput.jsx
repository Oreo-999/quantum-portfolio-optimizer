import React, { useState, useRef, useCallback } from "react";

const MAX_TICKERS = 50;
const QAOA_MAX = 10;

const SUGGESTIONS = [
  "AAPL","MSFT","GOOGL","AMZN","NVDA","META","TSLA","BRK-B","V","JPM",
  "JNJ","UNH","XOM","LLY","AVGO","MA","HD","CVX","MRK","ABBV",
  "PEP","KO","COST","BAC","NFLX","WMT","DIS","CSCO","ORCL","CRM",
  "AMD","INTC","QCOM","TXN","IBM","NOW","ADBE","PYPL","SQ","SHOP",
  "UBER","LYFT","SNAP","SPOT","COIN","RBLX","HOOD","PLTR","SOFI","RIVN",
];

export default function TickerInput({
  tickers, setTickers,
  riskTolerance, setRiskTolerance,
  apiKey, setApiKey,
  useSimulator, setUseSimulator,
  onSubmit, loading, error,
}) {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef(null);

  const addTicker = useCallback((raw) => {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) { setInputError("Invalid ticker format"); return; }
    if (tickers.includes(ticker)) { setInputError(`${ticker} already added`); return; }
    if (tickers.length >= MAX_TICKERS) { setInputError(`Max ${MAX_TICKERS} tickers`); return; }
    setTickers((p) => [...p, ticker]);
    setInput("");
    setInputError("");
  }, [tickers, setTickers]);

  const removeTicker = useCallback((t) => setTickers((p) => p.filter((x) => x !== t)), [setTickers]);

  const handleKeyDown = (e) => {
    if (["Enter", ",", " "].includes(e.key)) { e.preventDefault(); addTicker(input); }
    if (e.key === "Backspace" && !input && tickers.length > 0) setTickers((p) => p.slice(0, -1));
  };

  const riskLabel = riskTolerance < 0.33 ? "Conservative" : riskTolerance < 0.67 ? "Balanced" : "Aggressive";
  const available = SUGGESTIONS.filter((t) => !tickers.includes(t));
  const shown = showAll ? available : available.slice(0, 10);

  return (
    <div className="card space-y-5">
      {/* Tickers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">Tickers</label>
          <span className="text-[11px] text-muted">{tickers.length} / {MAX_TICKERS}</span>
        </div>

        <div
          onClick={() => inputRef.current?.focus()}
          className="min-h-[48px] max-h-40 overflow-y-auto bg-surface border border-border rounded-lg px-3 py-2
                     flex flex-wrap gap-1.5 cursor-text focus-within:border-blue-border transition-colors"
        >
          {tickers.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 bg-white/5 border border-white/10
                                     text-primary text-xs font-mono px-2 py-0.5 rounded-md shrink-0">
              {t}
              <button
                onClick={(e) => { e.stopPropagation(); removeTicker(t); }}
                className="text-subtle hover:text-primary transition-colors"
              >×</button>
            </span>
          ))}
          {tickers.length < MAX_TICKERS && (
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value.toUpperCase()); setInputError(""); }}
              onKeyDown={handleKeyDown}
              onBlur={() => input && addTicker(input)}
              placeholder={tickers.length === 0 ? "Type any ticker and press Enter…" : ""}
              className="bg-transparent border-none outline-none text-sm text-primary placeholder-muted font-mono min-w-[160px] flex-1"
            />
          )}
        </div>

        {inputError && <p className="text-xs text-negative mt-1">{inputError}</p>}

        {tickers.length > QAOA_MAX && (
          <p className="text-[11px] text-subtle mt-1.5">
            QAOA runs on top {QAOA_MAX} stocks · Classical Markowitz uses all {tickers.length}
          </p>
        )}

        {/* Suggestions */}
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {shown.map((t) => (
              <button
                key={t}
                onClick={() => addTicker(t)}
                disabled={tickers.length >= MAX_TICKERS}
                className="text-[11px] font-mono text-subtle hover:text-secondary border border-border
                           hover:border-border-soft px-1.5 py-0.5 rounded transition-all
                           disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {t}
              </button>
            ))}
          </div>
          {available.length > 10 && (
            <button
              onClick={() => setShowAll((p) => !p)}
              className="text-[11px] text-muted hover:text-subtle mt-1.5 transition-colors"
            >
              {showAll ? "Show less" : `+${available.length - 10} more suggestions`}
            </button>
          )}
        </div>
      </div>

      {/* Risk tolerance */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="label">Risk Tolerance</label>
          <span className="text-xs text-secondary">{riskLabel} · {riskTolerance.toFixed(2)}</span>
        </div>
        <input
          type="range" min="0" max="1" step="0.01"
          value={riskTolerance}
          onChange={(e) => setRiskTolerance(parseFloat(e.target.value))}
          className="w-full h-px bg-border rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white"
        />
        <div className="flex justify-between text-[10px] text-muted mt-1.5">
          <span>Min risk</span><span>Max return</span>
        </div>
      </div>

      {/* Backend */}
      <div>
        <label className="label mb-2 block">Backend</label>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          <button onClick={() => setUseSimulator(true)} className={`seg-btn ${useSimulator ? "seg-btn-active" : "seg-btn-inactive"}`}>
            Simulator
          </button>
          <button onClick={() => setUseSimulator(false)} className={`seg-btn ${!useSimulator ? "seg-btn-active" : "seg-btn-inactive"}`}>
            IBM Hardware
          </button>
        </div>
        {!useSimulator && (
          <p className="text-[11px] text-subtle mt-1.5">Requires API key · QAOA subset capped at 5 for hardware</p>
        )}
      </div>

      {/* IBM key */}
      {!useSimulator && (
        <div className="animate-fade-in">
          <label className="label mb-2 block">IBM Quantum API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key"
            className="input-field font-mono text-xs"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-negative/5 border border-negative/20 rounded-lg px-3.5 py-3">
          <p className="text-sm text-negative/90 leading-relaxed">{error}</p>
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
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Optimizing
          </>
        ) : "Optimize Portfolio"}
      </button>
    </div>
  );
}
