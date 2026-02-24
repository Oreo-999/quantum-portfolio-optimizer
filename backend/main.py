"""
Quantum Portfolio Optimizer — FastAPI entry point.

Endpoints:
  POST /optimize          — full pipeline
  GET  /health            — API liveness
  GET  /validate-tickers  — check if tickers are valid
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from models.request_models import PortfolioRequest
from models.response_models import PortfolioResponse, Metrics, SolutionMetrics, Benchmark
from config import get_backend
from finance.data import fetch_stock_data, validate_tickers as _validate_tickers
from finance.metrics import compute_portfolio_metrics, compute_spy_benchmark
from algorithms.classical import run_classical_optimization
from algorithms.qaoa import run_qaoa

app = FastAPI(
    title="Quantum Portfolio Optimizer",
    description="QAOA-powered portfolio optimization with IBM Quantum + classical Markowitz comparison",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Quantum Portfolio Optimizer"}


@app.get("/validate-tickers")
def validate_tickers_endpoint(tickers: List[str] = Query(...)):
    return _validate_tickers(tickers)


@app.post("/optimize", response_model=PortfolioResponse)
def optimize(req: PortfolioRequest):
    tickers = req.tickers
    n = len(tickers)

    # 1. Fetch stock data for all tickers
    try:
        stock_data = fetch_stock_data(tickers)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock data: {exc}")

    # 2. Classical Markowitz on all tickers
    try:
        classical_weights = run_classical_optimization(
            stock_data.mean_returns,
            stock_data.cov_matrix,
            req.risk_tolerance,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Classical optimization failed: {exc}")

    # 3. Determine quantum backend
    backend_config = get_backend(
        ibm_api_key=req.ibm_api_key,
        stock_count=n,
        use_simulator_fallback=req.use_simulator_fallback,
    )

    # 4. Run QAOA on all tickers
    try:
        qaoa_binary, raw_counts = run_qaoa(
            stock_data.mean_returns,
            stock_data.cov_matrix,
            req.risk_tolerance,
            backend_config,
            p=2,
            shots=1024,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"QAOA optimization failed: {exc}")

    # Convert binary vector to equal-weight allocation among selected stocks
    selected = qaoa_binary.astype(bool)
    qaoa_weights = np.zeros(n)
    if selected.any():
        qaoa_weights[selected] = 1.0 / selected.sum()
    else:
        qaoa_weights = np.ones(n) / n

    # 5. Compute metrics
    qaoa_metrics = compute_portfolio_metrics(qaoa_weights, stock_data.mean_returns, stock_data.cov_matrix)
    classical_metrics = compute_portfolio_metrics(classical_weights, stock_data.mean_returns, stock_data.cov_matrix)

    # 6. S&P 500 benchmark
    try:
        spy_metrics = compute_spy_benchmark()
    except Exception:
        spy_metrics = {"ticker": "SPY", "expected_return": 0.10, "volatility": 0.17, "sharpe_ratio": 0.29}

    def weights_to_pct(weights: np.ndarray) -> dict:
        return {ticker: round(float(w) * 100, 2) for ticker, w in zip(tickers, weights)}

    return PortfolioResponse(
        qaoa_allocation=weights_to_pct(qaoa_weights),
        classical_allocation=weights_to_pct(classical_weights),
        metrics=Metrics(
            qaoa=SolutionMetrics(**qaoa_metrics),
            classical=SolutionMetrics(**classical_metrics),
        ),
        benchmark=Benchmark(**spy_metrics),
        correlation_matrix=stock_data.correlation_matrix.tolist(),
        tickers=tickers,
        backend_used=backend_config.backend_name,
        used_simulator_fallback=backend_config.used_simulator_fallback,
        fallback_reason=backend_config.fallback_reason,
        raw_counts={k: int(v) for k, v in raw_counts.items()},
    )
