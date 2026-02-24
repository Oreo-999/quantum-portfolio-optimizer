/**
 * API client — thin wrapper around Axios for all backend communication.
 *
 * All requests go to the FastAPI backend at localhost:8000.
 * The 5-minute timeout is intentional: IBM Quantum jobs can queue for several
 * minutes before executing on real hardware.
 *
 * Error handling: the response interceptor extracts the most useful error message
 * from FastAPI's error format (detail field) and re-throws as a plain Error
 * so callers just get err.message without needing to dig into response structure.
 */

import axios from "axios";

// Single Axios instance shared across all API functions.
// Centralizes base URL and default headers so they're never duplicated.
const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 300_000, // 5 minutes — IBM hardware queue can be slow
  headers: { "Content-Type": "application/json" },
});

// Response interceptor: normalize all errors to plain Error objects.
// FastAPI returns errors as { "detail": "..." }, so we unwrap that field.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.detail ||   // FastAPI HTTPException message
      err.response?.data?.message ||  // alternative message format
      err.message ||                  // network-level error (timeout, CORS, etc.)
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

/**
 * Run the full portfolio optimization pipeline.
 *
 * @param {Object} payload
 * @param {string[]} payload.tickers              - List of stock ticker symbols
 * @param {number}   payload.risk_tolerance       - λ ∈ [0,1] — 0=min risk, 1=max return
 * @param {string}   payload.ibm_api_key          - IBM Quantum API key (empty string for simulator)
 * @param {boolean}  payload.use_simulator_fallback - True = always use AerSimulator
 * @returns {Promise<Object>} Full PortfolioResponse (allocation, metrics, backtest, etc.)
 */
export async function optimizePortfolio(payload) {
  const { data } = await api.post("/optimize", payload);
  return data;
}

/**
 * Check if a list of tickers are recognized by Yahoo Finance.
 * Used for inline validation in the ticker input field.
 *
 * @param {string[]} tickers - Ticker symbols to validate
 * @returns {Promise<{valid: string[], invalid: string[]}>}
 */
export async function validateTickers(tickers) {
  // FastAPI's Query(...) reads repeated params: ?tickers=AAPL&tickers=MSFT
  const params = new URLSearchParams();
  tickers.forEach((t) => params.append("tickers", t));
  const { data } = await api.get(`/validate-tickers?${params.toString()}`);
  return data;
}

/**
 * Health check — verifies the backend is reachable before allowing submission.
 *
 * @returns {Promise<{status: string, service: string}>}
 */
export async function checkHealth() {
  const { data } = await api.get("/health");
  return data;
}
