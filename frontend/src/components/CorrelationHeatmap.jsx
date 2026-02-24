import React from "react";

function corrToColor(value) {
  const v = Math.max(-1, Math.min(1, value));
  if (v >= 0) {
    const t = v;
    // 0 → #1e1e1e,  1 → #1d4ed8 (blue)
    const r = Math.round(30 + (29 - 30) * t);
    const g = Math.round(30 + (78 - 30) * t);
    const b = Math.round(30 + (216 - 30) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -v;
    // 0 → #1e1e1e,  -1 → #292524 (barely warm)
    const r = Math.round(30 + (60 - 30) * t);
    const g = Math.round(30 + (20 - 30) * t);
    const b = Math.round(30 + (20 - 30) * t);
    return `rgb(${r},${g},${b})`;
  }
}

export default function CorrelationHeatmap({ correlation_matrix, tickers }) {
  if (!correlation_matrix || !tickers) return null;
  const n = tickers.length;
  const cell = Math.min(54, Math.floor(340 / (n + 1)));
  const fs = cell < 40 ? 9 : 11;

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-primary mb-4">Correlation</h3>
      <div className="overflow-x-auto">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `${cell - 4}px repeat(${n}, ${cell}px)`, width: "fit-content" }}
        >
          <div style={{ height: cell }} />
          {tickers.map((t) => (
            <div key={t} className="flex items-center justify-center font-mono text-subtle" style={{ height: cell, fontSize: fs }}>
              {t}
            </div>
          ))}

          {tickers.map((rt, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center justify-end pr-2 font-mono text-subtle" style={{ height: cell, fontSize: fs }}>
                {rt}
              </div>
              {correlation_matrix[i].map((val, j) => (
                <div
                  key={j}
                  className="flex items-center justify-center rounded-sm relative group"
                  style={{ height: cell, backgroundColor: corrToColor(val) }}
                >
                  <span className="font-mono text-white/70" style={{ fontSize: Math.max(8, fs - 1) }}>
                    {val.toFixed(2)}
                  </span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 bg-card border border-border
                                  rounded px-2 py-1 text-[11px] text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100
                                  pointer-events-none transition-opacity shadow-xl">
                    {tickers[i]} / {tickers[j]}: {val.toFixed(4)}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-muted">−1</span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, #3b1e1e, #1e1e1e, #1d4ed8)" }} />
        <span className="text-[10px] text-muted">+1</span>
      </div>
    </div>
  );
}
