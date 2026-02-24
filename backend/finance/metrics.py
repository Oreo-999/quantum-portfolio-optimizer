"""
Portfolio metrics: expected return, volatility, Sharpe ratio.
SPY benchmark over the same 2-year window.
"""

import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from typing import List

RISK_FREE_RATE = 0.05


def compute_portfolio_metrics(
    weights: np.ndarray,
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
) -> dict:
    """Compute annualized return, volatility, and Sharpe ratio for a weight vector."""
    weights = np.array(weights, dtype=float)
    if weights.sum() > 0:
        weights = weights / weights.sum()

    expected_return = float(np.dot(weights, mean_returns))
    variance = float(weights @ cov_matrix @ weights)
    volatility = float(np.sqrt(variance))
    sharpe = (expected_return - RISK_FREE_RATE) / volatility if volatility > 1e-9 else 0.0

    return {
        "expected_return": round(expected_return, 6),
        "volatility": round(volatility, 6),
        "sharpe_ratio": round(sharpe, 6),
    }


def compute_spy_benchmark() -> dict:
    """Fetch SPY data for the past 2 years and compute its metrics."""
    end = datetime.today()
    start = end - timedelta(days=2 * 365)

    spy = yf.download(
        "SPY",
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        auto_adjust=True,
        progress=False,
    )

    if spy.empty or len(spy) < 30:
        # Return placeholder if SPY data unavailable
        return {
            "ticker": "SPY",
            "expected_return": 0.10,
            "volatility": 0.17,
            "sharpe_ratio": round((0.10 - RISK_FREE_RATE) / 0.17, 6),
        }

    daily = spy["Close"].pct_change().dropna()
    trading_days = 252
    ann_return = float(daily.mean() * trading_days)
    ann_vol = float(daily.std() * np.sqrt(trading_days))
    sharpe = (ann_return - RISK_FREE_RATE) / ann_vol if ann_vol > 1e-9 else 0.0

    return {
        "ticker": "SPY",
        "expected_return": round(ann_return, 6),
        "volatility": round(ann_vol, 6),
        "sharpe_ratio": round(sharpe, 6),
    }
