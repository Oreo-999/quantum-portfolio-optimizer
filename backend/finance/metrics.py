"""
Portfolio metrics: expected return, volatility, Sharpe ratio, backtesting.
"""

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import List

RISK_FREE_RATE = 0.05


def compute_portfolio_metrics(
    weights: np.ndarray,
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
) -> dict:
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


def _fetch_spy_daily(start: datetime, end: datetime) -> pd.Series:
    """Fetch SPY daily returns for a date range. Returns empty Series on failure."""
    try:
        raw = yf.download(
            "SPY",
            start=start.strftime("%Y-%m-%d"),
            end=(end + timedelta(days=5)).strftime("%Y-%m-%d"),
            auto_adjust=True,
            progress=False,
        )
        if raw.empty:
            return pd.Series(dtype=float)
        close = raw["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        return close.pct_change().dropna()
    except Exception:
        return pd.Series(dtype=float)


def compute_spy_benchmark() -> dict:
    end = datetime.today()
    start = end - timedelta(days=2 * 365)
    spy_daily = _fetch_spy_daily(start, end)

    if spy_daily.empty or len(spy_daily) < 30:
        return {
            "ticker": "SPY",
            "expected_return": 0.10,
            "volatility": 0.17,
            "sharpe_ratio": round((0.10 - RISK_FREE_RATE) / 0.17, 6),
        }

    trading_days = 252
    ann_return = float(spy_daily.mean() * trading_days)
    ann_vol = float(spy_daily.std() * np.sqrt(trading_days))
    sharpe = (ann_return - RISK_FREE_RATE) / ann_vol if ann_vol > 1e-9 else 0.0

    return {
        "ticker": "SPY",
        "expected_return": round(ann_return, 6),
        "volatility": round(ann_vol, 6),
        "sharpe_ratio": round(sharpe, 6),
    }


def compute_backtest(
    qaoa_weights: np.ndarray,
    classical_weights: np.ndarray,
    daily_returns: pd.DataFrame,
) -> List[dict]:
    """
    Apply static weights to the 2-year historical daily returns and compute
    cumulative portfolio returns vs SPY. Returns ~100 evenly-spaced data points.
    """
    qaoa_w = np.array(qaoa_weights, dtype=float)
    classical_w = np.array(classical_weights, dtype=float)

    if qaoa_w.sum() > 0:
        qaoa_w /= qaoa_w.sum()
    if classical_w.sum() > 0:
        classical_w /= classical_w.sum()

    # Daily portfolio returns
    qaoa_daily = daily_returns.values @ qaoa_w
    classical_daily = daily_returns.values @ classical_w

    # Cumulative returns
    qaoa_cum = (np.cumprod(1 + qaoa_daily) - 1) * 100
    classical_cum = (np.cumprod(1 + classical_daily) - 1) * 100

    dates = daily_returns.index

    # Fetch SPY for the same date range
    spy_daily = _fetch_spy_daily(dates[0].to_pydatetime(), dates[-1].to_pydatetime())
    if not spy_daily.empty:
        spy_daily = spy_daily.reindex(dates, method="ffill").fillna(0)
        spy_cum = (np.cumprod(1 + spy_daily.values) - 1) * 100
    else:
        spy_cum = np.zeros(len(dates))

    # Sample ~100 evenly-spaced points
    step = max(1, len(dates) // 100)
    result = []
    for i in range(0, len(dates), step):
        result.append({
            "date": dates[i].strftime("%Y-%m-%d"),
            "qaoa": round(float(qaoa_cum[i]), 2),
            "classical": round(float(classical_cum[i]), 2),
            "spy": round(float(spy_cum[i]), 2),
        })

    return result
