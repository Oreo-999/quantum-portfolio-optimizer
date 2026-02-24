import React from "react";
import BackendBadge from "./BackendBadge";
import AllocationChart from "./AllocationChart";
import MetricsPanel from "./MetricsPanel";
import CorrelationHeatmap from "./CorrelationHeatmap";
import ComparisonChart from "./ComparisonChart";
import BenchmarkChart from "./BenchmarkChart";
import EfficientFrontier from "./EfficientFrontier";
import ConvergenceChart from "./ConvergenceChart";

export default function PortfolioResults({ results, onReset }) {
  const {
    qaoa_allocation, classical_allocation,
    metrics, benchmark, correlation_matrix, tickers,
    dropped_tickers,
    backend_used, used_simulator_fallback, fallback_reason,
    raw_counts, backtest, frontier, convergence,
  } = results;

  const totalShots = Object.values(raw_counts).reduce((a, b) => a + b, 0);
  const topStates = Object.entries(raw_counts).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-medium text-primary">Results</h2>
          <BackendBadge
            backend_used={backend_used}
            used_simulator_fallback={used_simulator_fallback}
            fallback_reason={fallback_reason}
          />
        </div>
        <button onClick={onReset} className="btn-ghost text-xs py-1.5 px-3 shrink-0">
          New analysis
        </button>
      </div>

      {/* Dropped tickers notice */}
      {dropped_tickers?.length > 0 && (
        <div className="bg-white/3 border border-border rounded-lg px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-subtle shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-subtle leading-relaxed">
            <span className="text-secondary font-medium">{dropped_tickers.join(", ")}</span>
            {" "}removed — insufficient historical data (&lt;30 trading days). Analysis ran on the remaining {tickers.length} stocks.
          </p>
        </div>
      )}

      {/* Allocation */}
      <AllocationChart
        qaoa_allocation={qaoa_allocation}
        classical_allocation={classical_allocation}
      />

      {/* Metrics + Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricsPanel metrics={metrics} benchmark={benchmark} />
        <CorrelationHeatmap correlation_matrix={correlation_matrix} tickers={tickers} />
      </div>

      {/* QAOA vs Classical bar */}
      <ComparisonChart metrics={metrics} />

      {/* Efficient Frontier */}
      <EfficientFrontier frontier={frontier} metrics={metrics} />

      {/* Real backtest */}
      <BenchmarkChart backtest={backtest} />

      {/* QAOA convergence */}
      <ConvergenceChart convergence={convergence} />

      {/* Raw measurement counts */}
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
                <div className="flex-1 bg-border rounded-full overflow-hidden" style={{ height: "1px" }}>
                  <div className="h-full bg-blue rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-mono text-secondary w-24 text-right">
                  {count.toLocaleString()} · {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
        {Object.keys(raw_counts).length > 5 && (
          <p className="text-[10px] text-muted mt-3">
            Showing top 5 of {Object.keys(raw_counts).length} measured states
          </p>
        )}
      </div>
    </div>
  );
}
