import React from "react";
import BackendBadge from "./BackendBadge";
import AllocationChart from "./AllocationChart";
import MetricsPanel from "./MetricsPanel";
import CorrelationHeatmap from "./CorrelationHeatmap";
import ComparisonChart from "./ComparisonChart";
import BenchmarkChart from "./BenchmarkChart";

export default function PortfolioResults({ results, onReset }) {
  const {
    qaoa_allocation, classical_allocation,
    metrics, benchmark, correlation_matrix, tickers, qaoa_tickers,
    backend_used, used_simulator_fallback, fallback_reason,
    raw_counts,
  } = results;

  const totalShots = Object.values(raw_counts).reduce((a, b) => a + b, 0);
  const topStates = Object.entries(raw_counts).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-medium text-primary">Results</h2>
          <BackendBadge backend_used={backend_used} used_simulator_fallback={used_simulator_fallback} fallback_reason={fallback_reason} />
          {qaoa_tickers && qaoa_tickers.length < tickers.length && (
            <span className="text-[11px] text-subtle border border-border rounded-full px-2.5 py-0.5">
              QAOA subset: {qaoa_tickers.join(", ")}
            </span>
          )}
        </div>
        <button onClick={onReset} className="btn-ghost text-xs py-1.5 px-3 shrink-0">New analysis</button>
      </div>

      <AllocationChart qaoa_allocation={qaoa_allocation} classical_allocation={classical_allocation} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricsPanel metrics={metrics} benchmark={benchmark} />
        <CorrelationHeatmap correlation_matrix={correlation_matrix} tickers={tickers} />
      </div>

      <ComparisonChart metrics={metrics} />
      <BenchmarkChart metrics={metrics} benchmark={benchmark} />

      {/* Raw counts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-primary">Measurement Counts</h3>
          <span className="text-[11px] text-subtle">{totalShots.toLocaleString()} shots</span>
        </div>
        <div className="space-y-2">
          {topStates.map(([state, count]) => {
            const pct = (count / totalShots) * 100;
            return (
              <div key={state} className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-subtle w-20 shrink-0">{state}</span>
                <div className="flex-1 h-px bg-border relative">
                  <div className="absolute inset-y-0 left-0 bg-blue rounded-full" style={{ width: `${pct}%`, height: "1px" }} />
                </div>
                <span className="text-[11px] font-mono text-secondary w-20 text-right">
                  {count.toLocaleString()} · {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
        {Object.keys(raw_counts).length > 5 && (
          <p className="text-[10px] text-muted mt-3">Showing top 5 of {Object.keys(raw_counts).length} states</p>
        )}
      </div>
    </div>
  );
}
