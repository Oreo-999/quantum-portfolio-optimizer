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
    metrics, benchmark, correlation_matrix, tickers,
    backend_used, used_simulator_fallback, fallback_reason,
    raw_counts,
  } = results;

  const totalCounts = Object.values(raw_counts).reduce((a, b) => a + b, 0);
  const topStates = Object.entries(raw_counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Result header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-neutral-100">Optimization Results</h2>
          <BackendBadge
            backend_used={backend_used}
            used_simulator_fallback={used_simulator_fallback}
            fallback_reason={fallback_reason}
          />
        </div>
        <button
          onClick={onReset}
          className="text-xs text-neutral-500 hover:text-neutral-300 border border-surface-border hover:border-neutral-600 px-3 py-1.5 rounded-lg transition-all"
        >
          New Analysis
        </button>
      </div>

      {/* Allocation charts */}
      <AllocationChart
        qaoa_allocation={qaoa_allocation}
        classical_allocation={classical_allocation}
      />

      {/* 2-col grid: metrics + heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-400">Performance Metrics</h3>
          <MetricsPanel metrics={metrics} benchmark={benchmark} />
        </div>
        <CorrelationHeatmap correlation_matrix={correlation_matrix} tickers={tickers} />
      </div>

      {/* Comparison bar chart */}
      <ComparisonChart metrics={metrics} />

      {/* Benchmark line chart */}
      <BenchmarkChart metrics={metrics} benchmark={benchmark} />

      {/* Raw counts */}
      <div className="card">
        <h3 className="text-sm font-semibold text-neutral-200 mb-3">
          QAOA Measurement Counts
          <span className="ml-2 text-xs text-neutral-500 font-normal">{totalCounts.toLocaleString()} shots</span>
        </h3>
        <div className="space-y-2">
          {topStates.map(([state, count]) => {
            const pct = (count / totalCounts) * 100;
            return (
              <div key={state} className="flex items-center gap-3">
                <span className="font-mono text-xs text-neutral-400 w-24 shrink-0">{state}</span>
                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-500 w-16 text-right">
                  {count.toLocaleString()} ({pct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
        {Object.keys(raw_counts).length > 5 && (
          <p className="text-[10px] text-neutral-600 mt-2">Showing top 5 of {Object.keys(raw_counts).length} states</p>
        )}
      </div>
    </div>
  );
}
