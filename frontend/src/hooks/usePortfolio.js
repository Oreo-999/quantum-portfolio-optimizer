import { useState, useCallback } from "react";
import { optimizePortfolio } from "../api/client";

const STAGES = [
  "Fetching historical stock data…",
  "Running classical Markowitz optimization…",
  "Formulating QUBO matrix…",
  "Running QAOA on quantum backend…",
  "Computing portfolio metrics…",
  "Finalizing results…",
];

export function usePortfolio() {
  const [tickers, setTickers] = useState([]);
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [apiKey, setApiKey] = useState("");
  const [useSimulator, setUseSimulator] = useState(true);

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState(null);

  // Cycle through loading stage messages while waiting
  const startStageLoop = useCallback(() => {
    let idx = 0;
    setLoadingStage(STAGES[0]);
    const id = setInterval(() => {
      idx = Math.min(idx + 1, STAGES.length - 1);
      setLoadingStage(STAGES[idx]);
      if (idx === STAGES.length - 1) clearInterval(id);
    }, 4000);
    return id;
  }, []);

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
      setError(err.message);
    } finally {
      clearInterval(stageId);
      setLoading(false);
      setLoadingStage("");
    }
  }, [tickers, riskTolerance, apiKey, useSimulator, startStageLoop]);

  const resetResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    // Form state
    tickers,
    setTickers,
    riskTolerance,
    setRiskTolerance,
    apiKey,
    setApiKey,
    useSimulator,
    setUseSimulator,
    // Async state
    results,
    loading,
    loadingStage,
    error,
    // Actions
    handleSubmit,
    resetResults,
  };
}
