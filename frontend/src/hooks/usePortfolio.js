/**
 * usePortfolio — central state manager for the portfolio optimizer.
 *
 * Manages all form state (tickers, risk tolerance, API key, backend choice)
 * and async state (loading, results, error). Exposes handleSubmit and resetResults
 * as the only actions the UI needs to call.
 *
 * The loading stage loop cycles through descriptive status messages while
 * the optimization runs (which can take 5–90 seconds). Each message corresponds
 * to a real pipeline step happening on the backend.
 */

import { useState, useCallback } from "react";
import { optimizePortfolio } from "../api/client";

// Messages shown in sequence while waiting for the backend to respond.
// These correspond to the actual pipeline steps in main.py's /optimize endpoint.
const STAGES = [
  "Fetching historical stock data…",        // Step 1: yfinance download
  "Running classical Markowitz optimization…", // Step 2: scipy SLSQP
  "Formulating QUBO matrix…",                // Step 3: quadratic program setup
  "Running QAOA on quantum backend…",        // Step 4: variational optimization loop
  "Computing portfolio metrics…",            // Step 5: Sharpe, return, volatility
  "Finalizing results…",                     // Steps 6-8: backtest, frontier, response
];

export function usePortfolio() {
  // --- Form state ---
  const [tickers, setTickers] = useState([]);          // Selected stock symbols
  const [riskTolerance, setRiskTolerance] = useState(0.5); // λ ∈ [0,1]
  const [apiKey, setApiKey] = useState("");            // IBM Quantum API key (optional)
  const [useSimulator, setUseSimulator] = useState(true); // true = AerSimulator

  // --- Async state ---
  const [results, setResults] = useState(null);        // PortfolioResponse from backend
  const [loading, setLoading] = useState(false);       // true while API call is in flight
  const [loadingStage, setLoadingStage] = useState(""); // Current status message for LoadingState
  const [error, setError] = useState(null);            // Error message string or null

  /**
   * Cycle through STAGES messages every 4 seconds while loading.
   * Stops at the last message so it doesn't loop back to "Fetching data…"
   * when the quantum step is still running.
   *
   * Returns the interval ID so the caller can clearInterval on completion.
   */
  const startStageLoop = useCallback(() => {
    let idx = 0;
    setLoadingStage(STAGES[0]);
    const id = setInterval(() => {
      idx = Math.min(idx + 1, STAGES.length - 1); // clamp to last stage, don't loop
      setLoadingStage(STAGES[idx]);
      if (idx === STAGES.length - 1) clearInterval(id); // auto-stop at final message
    }, 4000); // advance every 4 seconds
    return id;
  }, []);

  /**
   * Submit the optimization request to the backend.
   *
   * Flow:
   *   1. Validate: require at least 2 tickers
   *   2. Start loading state + stage loop
   *   3. POST to /optimize with all form state
   *   4. On success: store results → triggers PortfolioResults render
   *   5. On failure: store error message → shown inline in TickerInput
   *   6. Always: clear loading state and stage loop
   */
  const handleSubmit = useCallback(async () => {
    if (tickers.length < 2) {
      setError("Please add at least 2 stock tickers.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const stageId = startStageLoop();

    try {
      const data = await optimizePortfolio({
        tickers,
        risk_tolerance: riskTolerance,
        ibm_api_key: apiKey,
        use_simulator_fallback: useSimulator,
      });
      setResults(data);
    } catch (err) {
      // err.message was normalized by the Axios interceptor in client.js
      setError(err.message);
    } finally {
      clearInterval(stageId); // always clear the stage loop timer
      setLoading(false);
      setLoadingStage("");
    }
  }, [tickers, riskTolerance, apiKey, useSimulator, startStageLoop]);

  /**
   * Clear results and errors to return to the empty state.
   * Called by the "New analysis" button in PortfolioResults.
   */
  const resetResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    // Form state (passed down to TickerInput)
    tickers,
    setTickers,
    riskTolerance,
    setRiskTolerance,
    apiKey,
    setApiKey,
    useSimulator,
    setUseSimulator,
    // Async state (drives the conditional rendering in App.jsx)
    results,
    loading,
    loadingStage,
    error,
    // Actions
    handleSubmit,
    resetResults,
  };
}
