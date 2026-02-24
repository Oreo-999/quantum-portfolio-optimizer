import React from "react";

function MetricRow({ label, qaoa, classical, format, lowerIsBetter }) {
  const qBetter = lowerIsBetter ? qaoa <= classical : qaoa >= classical;
  const cBetter = lowerIsBetter ? classical <= qaoa : classical >= qaoa;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-3 border-b border-border last:border-0">
      <span className="text-sm text-secondary">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium ${qBetter ? "text-qaoa" : "text-primary"}`}>
          {format(qaoa)}
        </span>
      </div>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium ${cBetter ? "text-primary" : "text-subtle"}`}>
          {format(classical)}
        </span>
      </div>
    </div>
  );
}

export default function MetricsPanel({ metrics, benchmark }) {
  if (!metrics) return null;
  const { qaoa, classical } = metrics;
  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  const dec = (v) => v.toFixed(3);

  return (
    <div className="card space-y-0">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center pb-3 border-b border-border">
        <span className="label">Metric</span>
        <span className="text-[11px] font-medium text-qaoa">QAOA</span>
        <span className="text-[11px] font-medium text-secondary">Classical</span>
      </div>

      <MetricRow label="Expected Return" qaoa={qaoa.expected_return} classical={classical.expected_return} format={pct} />
      <MetricRow label="Volatility" qaoa={qaoa.volatility} classical={classical.volatility} format={pct} lowerIsBetter />
      <MetricRow label="Sharpe Ratio" qaoa={qaoa.sharpe_ratio} classical={classical.sharpe_ratio} format={dec} />

      {benchmark && (
        <div className="pt-4 mt-1">
          <p className="label mb-3">S&P 500 Benchmark</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Return", value: pct(benchmark.expected_return) },
              { label: "Volatility", value: pct(benchmark.volatility) },
              { label: "Sharpe", value: dec(benchmark.sharpe_ratio) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] text-subtle mb-1">{label}</p>
                <p className="text-sm font-mono font-medium text-secondary">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
