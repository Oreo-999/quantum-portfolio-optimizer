import React from "react";
import { usePortfolio } from "./hooks/usePortfolio";
import TickerInput from "./components/TickerInput";
import PortfolioResults from "./components/PortfolioResults";
import LoadingState from "./components/LoadingState";

function AtomIcon() {
  return (
    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0" />
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeLinecap="round" />
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeLinecap="round" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeLinecap="round" transform="rotate(120 12 12)" />
    </svg>
  );
}

export default function App() {
  const portfolio = usePortfolio();
  const {
    tickers, setTickers,
    riskTolerance, setRiskTolerance,
    apiKey, setApiKey,
    useSimulator, setUseSimulator,
    results, loading, loadingStage, error,
    handleSubmit, resetResults,
  } = portfolio;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-surface-border bg-surface-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AtomIcon />
            <span className="text-sm font-semibold text-neutral-100 tracking-tight">
              Quantum Portfolio Optimizer
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              QAOA · Markowitz
            </span>
            <a
              href="https://qiskit.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              Qiskit
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        {!results && !loading && (
          <div className="mb-10 animate-fade-in">
            <h1 className="text-3xl font-bold text-neutral-50 tracking-tight">
              Optimize with{" "}
              <span className="text-accent">quantum computing</span>
            </h1>
            <p className="mt-2 text-neutral-500 max-w-xl text-sm leading-relaxed">
              Uses the Quantum Approximate Optimization Algorithm (QAOA) on real IBM Quantum hardware
              or simulator to find optimal stock allocations — compared against classical Markowitz theory.
            </p>
          </div>
        )}

        {/* Content layout */}
        <div className={`${results ? "grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 items-start" : "grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start"}`}>
          {/* Left panel — always visible */}
          <div className="lg:sticky lg:top-20">
            <TickerInput
              tickers={tickers}
              setTickers={setTickers}
              riskTolerance={riskTolerance}
              setRiskTolerance={setRiskTolerance}
              apiKey={apiKey}
              setApiKey={setApiKey}
              useSimulator={useSimulator}
              setUseSimulator={setUseSimulator}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
            />

            {/* Info cards */}
            {!results && !loading && (
              <div className="mt-4 space-y-2">
                <InfoCard
                  icon="⚡"
                  title="Real Quantum Hardware"
                  desc="≤5 stocks run on IBM Quantum free-tier hardware"
                />
                <InfoCard
                  icon="🔁"
                  title="Auto Fallback"
                  desc="6–10 stocks automatically use AerSimulator"
                />
                <InfoCard
                  icon="📊"
                  title="Dual Comparison"
                  desc="QAOA vs Markowitz with S&P 500 benchmark"
                />
              </div>
            )}
          </div>

          {/* Right panel */}
          <div>
            {loading && (
              <div className="card animate-fade-in">
                <LoadingState stage={loadingStage} useSimulator={useSimulator} />
              </div>
            )}

            {!loading && !results && (
              <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-accent-dim border border-accent/20 flex items-center justify-center mb-4">
                  <AtomIcon />
                </div>
                <p className="text-sm font-medium text-neutral-400">Configure your portfolio on the left</p>
                <p className="text-xs text-neutral-600 mt-1">Results will appear here after optimization</p>
              </div>
            )}

            {!loading && results && (
              <PortfolioResults results={results} onReset={resetResults} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border mt-20 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-neutral-600">
            Quantum Portfolio Optimizer · Educational use only
          </p>
          <p className="text-xs text-neutral-700">
            Not financial advice · Powered by Qiskit + FastAPI
          </p>
        </div>
      </footer>
    </div>
  );
}

function InfoCard({ icon, title, desc }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-4 py-3 flex items-start gap-3">
      <span className="text-base mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-medium text-neutral-300">{title}</p>
        <p className="text-xs text-neutral-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
