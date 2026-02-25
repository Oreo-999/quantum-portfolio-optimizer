"""
Quantum Portfolio Optimizer — FastAPI entry point.

This is the API layer that orchestrates the full optimization pipeline:

  POST /optimize  →  8-step pipeline:
    1. Fetch 2-year historical data from Yahoo Finance
    2. Run classical Markowitz mean-variance optimization
    3. Select quantum backend (IBM hardware or AerSimulator)
    4. Run QAOA to get binary portfolio selection + convergence history
    5. Compute annualized metrics (return, volatility, Sharpe) for both solutions
    6. Fetch S&P 500 benchmark metrics
    7. Compute historical backtest (cumulative returns over 2 years)
    8. Compute efficient frontier (random portfolios + analytical curve)

  GET /health            → liveness probe for the frontend
  GET /validate-tickers  → lightweight check before full optimization
"""

import sys
import os

# Ensure the backend directory is on the Python path so relative imports work
# when running with `uvicorn main:app` from any working directory
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from models.request_models import PortfolioRequest
from models.response_models import (
    PortfolioResponse, Metrics, SolutionMetrics, Benchmark,
    FrontierPoint,
)
from config import get_backend
from finance.data import fetch_stock_data, validate_tickers as _validate_tickers
from finance.metrics import compute_portfolio_metrics, compute_spy_benchmark, compute_backtest
from algorithms.classical import run_classical_optimization
from algorithms.qaoa import run_qaoa

# ---------------------------------------------------------------------------
# App initialization
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Quantum Portfolio Optimizer",
    description="QAOA-powered portfolio optimization with IBM Quantum + classical Markowitz comparison",
    version="1.0.0",
)

# Allow the React dev server (port 3000) to call this API.
# In production this would be locked down to the actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Efficient frontier computation (helper)
# ---------------------------------------------------------------------------

def _compute_efficient_frontier(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    n_random: int = 300,
    n_frontier: int = 40,
) -> List[FrontierPoint]:
    """
    Generate the efficient frontier for visualization.

    Two sets of points are produced:
      1. Random portfolios (type="random"):
         n_random portfolios with weights drawn from a Dirichlet distribution.
         These fill in the "attainable set" — the cloud of all possible portfolios.
         Dirichlet(α=1) gives a uniform distribution over the simplex (all weights ≥ 0, sum=1).

      2. Efficient frontier points (type="frontier"):
         n_frontier portfolios from solving Markowitz at evenly-spaced risk_tolerance levels
         from 0.0 (minimum variance) to 1.0 (maximum return).
         These trace the upper-left boundary — the curve of optimal portfolios.

    The scatter chart on the frontend shows these two layers plus markers for
    where the QAOA and Classical solutions actually land.

    Args:
        mean_returns:  Annualized expected returns (shape: n,)
        cov_matrix:    Annualized covariance matrix (shape: n x n)
        n_random:      Number of random portfolios to sample
        n_frontier:    Number of analytical frontier points to compute

    Returns:
        List of FrontierPoint objects with volatility, expected_return, sharpe, type
    """
    n = len(mean_returns)
    points: List[FrontierPoint] = []

    # --- Random portfolio cloud ---
    rng = np.random.default_rng(42)  # fixed seed for reproducible charts
    for _ in range(n_random):
        # Dirichlet sample: each draw is a valid weight vector (non-negative, sums to 1)
        w = rng.dirichlet(np.ones(n))
        ret = float(np.dot(w, mean_returns))
        vol = float(np.sqrt(w @ cov_matrix @ w))
        sharpe = round((ret - 0.05) / vol, 4) if vol > 1e-9 else 0.0
        points.append(FrontierPoint(
            volatility=round(vol, 6),
            expected_return=round(ret, 6),
            sharpe=sharpe,
            type="random",
        ))

    # --- Analytical efficient frontier curve ---
    # Sweep risk_tolerance from 0 (min risk = leftmost point) to 1 (max return = topmost point)
    # and solve Markowitz at each level. The resulting portfolios trace the frontier.
    for rt in np.linspace(0.0, 1.0, n_frontier):
        w = run_classical_optimization(mean_returns, cov_matrix, float(rt))
        ret = float(np.dot(w, mean_returns))
        vol = float(np.sqrt(w @ cov_matrix @ w))
        sharpe = round((ret - 0.05) / vol, 4) if vol > 1e-9 else 0.0
        points.append(FrontierPoint(
            volatility=round(vol, 6),
            expected_return=round(ret, 6),
            sharpe=sharpe,
            type="frontier",
        ))

    return points


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """Liveness check — the frontend polls this on load to verify the API is reachable."""
    return {"status": "ok", "service": "Quantum Portfolio Optimizer"}


@app.get("/validate-tickers")
def validate_tickers_endpoint(tickers: List[str] = Query(...)):
    """
    Quick validation endpoint — checks if tickers exist on Yahoo Finance.
    Called by the frontend after each ticker is added (debounced).
    Much faster than /optimize since it only downloads 10 days of data.
    """
    return _validate_tickers(tickers)


@app.post("/optimize", response_model=PortfolioResponse)
def optimize(req: PortfolioRequest):
    """
    Main optimization endpoint. Runs the full 8-step pipeline.

    Typical runtime:
      - AerSimulator, 5 stocks:   5–15 seconds
      - AerSimulator, 20 stocks:  30–90 seconds
      - IBM hardware, 3–5 stocks: 2–10 minutes (depends on queue)

    All steps have individual try/except blocks so a failure in one
    (e.g. SPY benchmark fetch failing) doesn't abort the whole response.
    """
    tickers = req.tickers

    # -----------------------------------------------------------------------
    # Step 1: Fetch historical stock data
    # -----------------------------------------------------------------------
    try:
        stock_data = fetch_stock_data(tickers)
    except HTTPException:
        raise  # pass through our own HTTP errors (ticker not found, etc.)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock data: {exc}")

    # Update tickers to the validated subset (some may have been dropped)
    tickers = stock_data.tickers
    n = len(tickers)

    # -----------------------------------------------------------------------
    # Step 2: Classical Markowitz optimization
    # -----------------------------------------------------------------------
    # Run this first so we have the classical result even if QAOA fails
    try:
        classical_weights = run_classical_optimization(
            stock_data.mean_returns,
            stock_data.cov_matrix,
            req.risk_tolerance,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Classical optimization failed: {exc}")

    # -----------------------------------------------------------------------
    # Step 3: Quantum backend selection
    # -----------------------------------------------------------------------
    # get_backend() never raises — always returns a valid config
    backend_config = get_backend(
        ibm_api_key=req.ibm_api_key,
        stock_count=n,
        use_simulator_fallback=req.use_simulator_fallback,
    )

    # -----------------------------------------------------------------------
    # Step 4: QAOA optimization
    # -----------------------------------------------------------------------
    # Returns a binary allocation vector (1=include stock), raw measurement
    # counts from the final circuit run, and the COBYLA convergence history.
    try:
        qaoa_binary, raw_counts, convergence = run_qaoa(
            stock_data.mean_returns,
            stock_data.cov_matrix,
            req.risk_tolerance,
            backend_config,
            p=2,        # 2 QAOA layers — good quality/speed tradeoff
            shots=1024, # measurements per circuit evaluation
            min_stocks=req.min_stocks,
            max_stocks=req.max_stocks,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"QAOA optimization failed: {exc}")

    # --- Hard cardinality enforcement ---
    # Even with a strong QUBO penalty and compliant-first extraction, QAOA at low
    # depth may still violate the bounds (e.g. no compliant bitstring was sampled).
    # This post-processing guarantees the constraint is met before weighting.
    if req.min_stocks is not None or req.max_stocks is not None:
        lo = req.min_stocks or 1
        hi = req.max_stocks or n
        k = int(qaoa_binary.sum())

        if k < lo:
            # Too few: add the highest-return unselected stocks until we hit min
            unselected = np.where(qaoa_binary == 0)[0]
            # Sort unselected by descending expected return
            to_add = unselected[np.argsort(stock_data.mean_returns[unselected])[::-1]]
            for idx in to_add:
                if int(qaoa_binary.sum()) >= lo:
                    break
                qaoa_binary[idx] = 1.0

        elif k > hi:
            # Too many: remove the lowest-return selected stocks until we hit max
            selected_idx = np.where(qaoa_binary == 1)[0]
            to_remove = selected_idx[np.argsort(stock_data.mean_returns[selected_idx])]
            for idx in to_remove:
                if int(qaoa_binary.sum()) <= hi:
                    break
                qaoa_binary[idx] = 0.0

    # --- Hybrid weighting: run Markowitz on the QAOA-selected subset ---
    # QAOA decides *which* stocks to hold; classical optimizer finds the best
    # *weights* among those stocks. This removes the crude equal-weight penalty
    # and reflects how quantum-classical hybrid algorithms are intended to work.
    selected = qaoa_binary.astype(bool)
    qaoa_weights = np.zeros(n)
    if selected.sum() >= 2:
        # Slice returns and covariance to the selected subset only
        idx = np.where(selected)[0]
        subset_weights = run_classical_optimization(
            stock_data.mean_returns[idx],
            stock_data.cov_matrix[np.ix_(idx, idx)],
            req.risk_tolerance,
        )
        qaoa_weights[idx] = subset_weights
    elif selected.sum() == 1:
        # Single stock selected — 100% allocation
        qaoa_weights[selected] = 1.0
    else:
        # QAOA selected nothing (can happen when cardinality penalty is strong);
        # fall back to equal weight so the response is still useful
        qaoa_weights = np.ones(n) / n

    # -----------------------------------------------------------------------
    # Step 5: Portfolio metrics for both solutions
    # -----------------------------------------------------------------------
    qaoa_metrics = compute_portfolio_metrics(qaoa_weights, stock_data.mean_returns, stock_data.cov_matrix)
    classical_metrics = compute_portfolio_metrics(classical_weights, stock_data.mean_returns, stock_data.cov_matrix)

    # -----------------------------------------------------------------------
    # Step 6: S&P 500 benchmark
    # -----------------------------------------------------------------------
    try:
        spy_metrics = compute_spy_benchmark()
    except Exception:
        # Network failure — use approximate long-run averages as fallback
        spy_metrics = {"ticker": "SPY", "expected_return": 0.10, "volatility": 0.17, "sharpe_ratio": 0.29}

    # -----------------------------------------------------------------------
    # Step 7: Historical backtest
    # -----------------------------------------------------------------------
    # Applies static weights to the 2-year daily returns to produce cumulative
    # return series for the performance chart
    try:
        backtest = compute_backtest(qaoa_weights, classical_weights, stock_data.daily_returns)
    except Exception:
        backtest = []  # chart just won't render if this fails

    # -----------------------------------------------------------------------
    # Step 8: Efficient frontier
    # -----------------------------------------------------------------------
    # Generates the scatter chart data: random portfolio cloud + frontier curve
    try:
        frontier = _compute_efficient_frontier(stock_data.mean_returns, stock_data.cov_matrix)
    except Exception:
        frontier = []

    # -----------------------------------------------------------------------
    # Build and return response
    # -----------------------------------------------------------------------

    def weights_to_pct(weights: np.ndarray) -> dict:
        """Convert weight vector to {ticker: percentage} dict for the UI."""
        return {t: round(float(w) * 100, 2) for t, w in zip(tickers, weights)}

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
        dropped_tickers=stock_data.dropped_tickers,
        backend_used=backend_config.backend_name,
        used_simulator_fallback=backend_config.used_simulator_fallback,
        fallback_reason=backend_config.fallback_reason,
        raw_counts={k: int(v) for k, v in raw_counts.items()},
        backtest=backtest,
        frontier=[fp.model_dump() for fp in frontier],
        convergence=[round(c, 6) for c in convergence],
    )
