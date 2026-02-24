import React from "react";
import { usePortfolio } from "./hooks/usePortfolio";
import TickerInput from "./components/TickerInput";
import PortfolioResults from "./components/PortfolioResults";
import LoadingState from "./components/LoadingState";

export default function App() {
  const {
    tickers, setTickers,
    riskTolerance, setRiskTolerance,
    apiKey, setApiKey,
    useSimulator, setUseSimulator,
    results, loading, loadingStage, error,
    handleSubmit, resetResults,
  } = usePortfolio();

  return (
    <div className="min-h-screen bg-bg text-primary">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-bg/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <span className="text-sm font-medium tracking-tight">Quantum Portfolio Optimizer</span>
          <div className="flex items-center gap-5">
            <span className="hidden sm:block text-xs text-muted">QAOA · Markowitz · IBM Quantum</span>
            <a href="https://qiskit.org" target="_blank" rel="noopener noreferrer"
               className="text-[11px] text-muted hover:text-secondary transition-colors">
              Qiskit
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero — only shown before results */}
        {!results && !loading && (
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Portfolio optimization,<br />
              <span className="text-subtle font-normal">powered by quantum computing.</span>
            </h1>
            <p className="mt-3 text-sm text-subtle max-w-lg leading-relaxed">
              Uses QAOA on real IBM Quantum hardware or simulator to find optimal stock allocations,
              then benchmarks against classical Markowitz mean-variance optimization.
            </p>
          </div>
        )}

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          {/* Left — always sticky */}
          <div className="lg:sticky lg:top-18 space-y-3">
            <TickerInput
              tickers={tickers} setTickers={setTickers}
              riskTolerance={riskTolerance} setRiskTolerance={setRiskTolerance}
              apiKey={apiKey} setApiKey={setApiKey}
              useSimulator={useSimulator} setUseSimulator={setUseSimulator}
              onSubmit={handleSubmit} loading={loading} error={error}
            />

            {/* Info — only before results */}
            {!results && !loading && (
              <div className="space-y-1">
                {[
                  ["Real hardware", "IBM Quantum free tier for 2–5 stocks"],
                  ["Auto fallback", "6–10 stocks switch to AerSimulator"],
                  ["Dual output", "QAOA vs Markowitz with S&P 500 benchmark"],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-3 px-4 py-3 rounded-lg border border-border">
                    <div>
                      <p className="text-xs font-medium text-secondary">{title}</p>
                      <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            {loading && (
              <div className="card">
                <LoadingState stage={loadingStage} useSimulator={useSimulator} />
              </div>
            )}

            {!loading && !results && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                  </svg>
                </div>
                <p className="text-sm text-subtle">Configure your portfolio on the left</p>
                <p className="text-xs text-muted mt-1">Results will appear here</p>
              </div>
            )}

            {!loading && results && (
              <PortfolioResults results={results} onReset={resetResults} />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-16 py-5">
        <div className="max-w-5xl mx-auto px-6 flex justify-between items-center">
          <p className="text-[11px] text-muted">Quantum Portfolio Optimizer · Educational use only</p>
          <p className="text-[11px] text-muted">Qiskit · FastAPI · React</p>
        </div>
      </footer>
    </div>
  );
}
