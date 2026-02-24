import React from "react";

function MetricCard({ label, qaoa, classical, format, isBetter }) {
  return (
    <div className="card-sm space-y-3">
      <p className="label">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-3 ${isBetter === "qaoa" ? "bg-quantum/10 border border-quantum/30" : "bg-surface border border-surface-border"}`}>
          <p className="text-[10px] text-neutral-500 mb-1 font-medium uppercase tracking-wider">QAOA</p>
          <p className={`text-lg font-semibold ${isBetter === "qaoa" ? "text-quantum" : "text-neutral-200"}`}>
            {format(qaoa)}
          </p>
          {isBetter === "qaoa" && (
            <span className="text-[9px] text-quantum/70 font-medium">Better</span>
          )}
        </div>
        <div className={`rounded-lg p-3 ${isBetter === "classical" ? "bg-classical/10 border border-classical/30" : "bg-surface border border-surface-border"}`}>
          <p className="text-[10px] text-neutral-500 mb-1 font-medium uppercase tracking-wider">Classical</p>
          <p className={`text-lg font-semibold ${isBetter === "classical" ? "text-classical" : "text-neutral-200"}`}>
            {format(classical)}
          </p>
          {isBetter === "classical" && (
            <span className="text-[9px] text-classical/70 font-medium">Better</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MetricsPanel({ metrics, benchmark }) {
  if (!metrics) return null;
  const { qaoa, classical } = metrics;

  const betterSharpe = qaoa.sharpe_ratio >= classical.sharpe_ratio ? "qaoa" : "classical";
  const betterReturn = qaoa.expected_return >= classical.expected_return ? "qaoa" : "classical";
  const betterVol = qaoa.volatility <= classical.volatility ? "qaoa" : "classical";

  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  const dec = (v) => v.toFixed(3);

  return (
    <div className="space-y-3">
      <MetricCard
        label="Expected Annual Return"
        qaoa={qaoa.expected_return}
        classical={classical.expected_return}
        format={pct}
        isBetter={betterReturn}
      />
      <MetricCard
        label="Portfolio Volatility"
        qaoa={qaoa.volatility}
        classical={classical.volatility}
        format={pct}
        isBetter={betterVol}
      />
      <MetricCard
        label="Sharpe Ratio"
        qaoa={qaoa.sharpe_ratio}
        classical={classical.sharpe_ratio}
        format={dec}
        isBetter={betterSharpe}
      />

      {/* Benchmark row */}
      {benchmark && (
        <div className="card-sm">
          <p className="label mb-3">S&P 500 Benchmark (SPY)</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Return", value: pct(benchmark.expected_return) },
              { label: "Volatility", value: pct(benchmark.volatility) },
              { label: "Sharpe", value: dec(benchmark.sharpe_ratio) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface rounded-lg p-3 border border-surface-border">
                <p className="text-[10px] text-neutral-500 mb-1">{label}</p>
                <p className="text-sm font-medium text-neutral-300">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
