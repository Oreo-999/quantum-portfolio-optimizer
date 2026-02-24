import React from "react";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function corrToColor(value) {
  // -1 → blue, 0 → gray, +1 → red
  const v = Math.max(-1, Math.min(1, value));
  if (v >= 0) {
    const t = v;
    const r = Math.round(lerp(71, 239, t));
    const g = Math.round(lerp(85, 68, t));
    const b = Math.round(lerp(105, 68, t));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -v;
    const r = Math.round(lerp(71, 56, t));
    const g = Math.round(lerp(85, 130, t));
    const b = Math.round(lerp(105, 240, t));
    return `rgb(${r},${g},${b})`;
  }
}

export default function CorrelationHeatmap({ correlation_matrix, tickers }) {
  if (!correlation_matrix || !tickers) return null;
  const n = tickers.length;

  const cellSize = Math.min(56, Math.floor(380 / (n + 1)));
  const fontSize = cellSize < 40 ? 9 : 11;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Correlation Heatmap</h3>
      <div className="overflow-x-auto">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `${cellSize}px repeat(${n}, ${cellSize}px)`,
            width: "fit-content",
          }}
        >
          {/* Empty top-left corner */}
          <div className="flex items-center justify-center" style={{ height: cellSize }} />

          {/* Column headers */}
          {tickers.map((t) => (
            <div
              key={`ch-${t}`}
              className="flex items-center justify-center font-mono text-neutral-400 font-medium"
              style={{ height: cellSize, fontSize }}
            >
              {t}
            </div>
          ))}

          {/* Rows */}
          {tickers.map((rowTicker, i) => (
            <React.Fragment key={`row-${i}`}>
              {/* Row header */}
              <div
                className="flex items-center justify-end pr-2 font-mono text-neutral-400 font-medium"
                style={{ height: cellSize, fontSize }}
              >
                {rowTicker}
              </div>

              {/* Cells */}
              {correlation_matrix[i].map((val, j) => (
                <div
                  key={`cell-${i}-${j}`}
                  className="flex items-center justify-center rounded-sm relative group"
                  style={{
                    height: cellSize,
                    backgroundColor: corrToColor(val),
                    opacity: 0.85,
                  }}
                >
                  <span className="text-white font-mono font-medium" style={{ fontSize: Math.max(8, fontSize - 1) }}>
                    {val.toFixed(2)}
                  </span>
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 bg-surface-card border border-surface-border rounded px-2 py-1 text-xs text-neutral-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                    {tickers[i]} × {tickers[j]}: {val.toFixed(4)}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4">
        <span className="text-[10px] text-neutral-500">−1</span>
        <div
          className="flex-1 h-1.5 rounded-full"
          style={{
            background: "linear-gradient(to right, rgb(56,130,240), rgb(71,85,105), rgb(239,68,68))",
          }}
        />
        <span className="text-[10px] text-neutral-500">+1</span>
      </div>
    </div>
  );
}
