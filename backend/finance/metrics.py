"""
Portfolio metrics: expected return, volatility, Sharpe ratio, and historical backtesting.

Metrics computed
----------------
- Expected return:  annualized weighted-average return  (w^T μ)
- Volatility:       annualized portfolio standard deviation  (√(w^T Σ w))
- Sharpe ratio:     (expected_return - risk_free_rate) / volatility
  The Sharpe ratio measures return per unit of risk. Higher = better.
  We use 5% as the risk-free rate (approximate US Treasury yield).

Backtesting
-----------
compute_backtest() applies the static weights from QAOA and Classical to the
actual historical daily returns (in-sample). It produces cumulative return
series for each strategy and for SPY, which are displayed as the performance chart.

Important caveat: this is an IN-SAMPLE backtest — the optimization was done on
the same data period. It measures fit, not forward-looking predictive power.
"""

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import List

# Annual risk-free rate used in Sharpe ratio calculation.
# Approximates the US 3-month Treasury bill yield.
RISK_FREE_RATE = 0.05


def compute_portfolio_metrics(
    weights: np.ndarray,
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
) -> dict:
    """
    Compute annualized return, volatility, and Sharpe ratio for a portfolio.

    Args:
        weights:      Portfolio weight vector (will be renormalized if needed)
        mean_returns: Annualized expected return per stock (shape: n,)
        cov_matrix:   Annualized covariance matrix (shape: n x n)

    Returns:
        Dict with keys: expected_return, volatility, sharpe_ratio
    """
    weights = np.array(weights, dtype=float)

    # Renormalize so weights always sum to 1 (handles binary QAOA output)
    if weights.sum() > 0:
        weights = weights / weights.sum()

    # Portfolio expected return: E[R_p] = w^T μ  (linear combination of stock returns)
    expected_return = float(np.dot(weights, mean_returns))

    # Portfolio variance: σ²_p = w^T Σ w  (quadratic form capturing cross-correlations)
    variance = float(weights @ cov_matrix @ weights)
    volatility = float(np.sqrt(variance))  # standard deviation = annualized volatility

    # Sharpe ratio: excess return per unit of risk
    # Guard against division by zero (zero-variance degenerate portfolios)
    sharpe = (expected_return - RISK_FREE_RATE) / volatility if volatility > 1e-9 else 0.0

    return {
        "expected_return": round(expected_return, 6),
        "volatility": round(volatility, 6),
        "sharpe_ratio": round(sharpe, 6),
    }


def _fetch_spy_daily(start: datetime, end: datetime) -> pd.Series:
    """
    Fetch SPY (S&P 500 ETF) daily returns for a given date range.

    SPY is used as the market benchmark. Returns empty Series on any failure
    so callers can gracefully substitute zeros or a hardcoded fallback.

    Args:
        start: Start date of the range
        end:   End date of the range

    Returns:
        pd.Series of daily percentage returns, or empty Series on failure
    """
    try:
        raw = yf.download(
            "SPY",
            start=start.strftime("%Y-%m-%d"),
            # Fetch a few extra days to handle weekends and holidays at the boundary
            end=(end + timedelta(days=5)).strftime("%Y-%m-%d"),
            auto_adjust=True,
            progress=False,
        )
        if raw.empty:
            return pd.Series(dtype=float)

        close = raw["Close"]
        # Handle MultiIndex from yfinance 1.x — extract single column
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]

        return close.pct_change().dropna()

    except Exception:
        # Network failure, API rate limit, etc. — caller handles the empty case
        return pd.Series(dtype=float)


def compute_spy_benchmark() -> dict:
    """
    Compute annualized SPY metrics over the same 2-year window used for the portfolio.

    Falls back to hardcoded historical averages if the yfinance download fails
    (approximately: 10% annual return, 17% volatility).

    Returns:
        Dict with keys: ticker, expected_return, volatility, sharpe_ratio
    """
    end = datetime.today()
    start = end - timedelta(days=2 * 365)
    spy_daily = _fetch_spy_daily(start, end)

    # Use hardcoded fallback if we couldn't get enough real data
    if spy_daily.empty or len(spy_daily) < 30:
        return {
            "ticker": "SPY",
            "expected_return": 0.10,
            "volatility": 0.17,
            "sharpe_ratio": round((0.10 - RISK_FREE_RATE) / 0.17, 6),
        }

    trading_days = 252
    ann_return = float(spy_daily.mean() * trading_days)
    ann_vol = float(spy_daily.std() * np.sqrt(trading_days))  # √252 scaling for daily → annual vol
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
    Apply static portfolio weights to historical daily returns and compute
    cumulative performance vs SPY over the 2-year window.

    This is a "buy-and-hold" simulation: the weights are fixed at optimization
    time and never rebalanced. Each day's portfolio return is:
      R_p(t) = w^T r(t)
    Cumulative return at day T:
      C_p(T) = (∏_{t=1}^{T} (1 + R_p(t)) - 1) * 100

    Note: This is IN-SAMPLE — the same data used for optimization.
    It shows how well each method fits historical patterns, not future performance.

    Args:
        qaoa_weights:      Binary allocation from QAOA (renormalized to sum to 1)
        classical_weights: Continuous weights from Markowitz optimization
        daily_returns:     DataFrame of daily returns (index=date, columns=tickers)

    Returns:
        List of ~100 evenly-spaced data points, each a dict:
        {"date": "YYYY-MM-DD", "qaoa": float, "classical": float, "spy": float}
        Values are cumulative % returns (e.g. 15.3 = +15.3% from start).
    """
    qaoa_w = np.array(qaoa_weights, dtype=float)
    classical_w = np.array(classical_weights, dtype=float)

    # Normalize: QAOA returns binary {0,1} allocation, needs to sum to 1 for equal-weight
    if qaoa_w.sum() > 0:
        qaoa_w /= qaoa_w.sum()
    if classical_w.sum() > 0:
        classical_w /= classical_w.sum()

    # Compute daily portfolio returns as weighted sum of individual stock returns
    # Shape: daily_returns.values is (T x n), weights is (n,) → result is (T,)
    qaoa_daily = daily_returns.values @ qaoa_w
    classical_daily = daily_returns.values @ classical_w

    # Cumulative return: compound the daily returns multiplicatively
    # cumprod(1 + r_t) gives the growth factor; subtract 1 and multiply by 100 for percentage
    qaoa_cum = (np.cumprod(1 + qaoa_daily) - 1) * 100
    classical_cum = (np.cumprod(1 + classical_daily) - 1) * 100

    dates = daily_returns.index

    # Fetch SPY for the same exact date range as the portfolio data
    spy_daily = _fetch_spy_daily(dates[0].to_pydatetime(), dates[-1].to_pydatetime())
    if not spy_daily.empty:
        # Align SPY dates with portfolio dates (forward-fill any gaps from market close differences)
        spy_daily = spy_daily.reindex(dates, method="ffill").fillna(0)
        spy_cum = (np.cumprod(1 + spy_daily.values) - 1) * 100
    else:
        # If SPY data is unavailable, show flat line at 0%
        spy_cum = np.zeros(len(dates))

    # Downsample to ~100 points for readable chart rendering
    # (500 daily points would overload the chart tooltip and look noisy)
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
