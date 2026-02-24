"""
Stock data fetcher using yfinance >= 1.0.

Data pipeline
-------------
1. Download 2 years of daily OHLCV data from Yahoo Finance via yfinance
2. Extract the "Close" (adjusted close) prices
3. Forward-fill short gaps (≤5 days) — handles trading halts, data quirks, holidays
4. Drop individual tickers with fewer than MIN_DAYS trading days rather than
   failing the entire request (graceful handling of new IPOs like RIVN, HOOD)
5. Compute daily returns, annualized mean returns, covariance, and correlation matrices

yfinance 1.x note
-----------------
Since yfinance 1.0, both single-ticker and multi-ticker downloads return a
MultiIndex DataFrame with columns structured as (Price, Ticker). We access
prices via raw["Close"] which gives a DataFrame with one column per ticker.
For a single ticker, this returns a Series — we convert it to a 1-column DataFrame.
"""

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Tuple
from dataclasses import dataclass, field
from fastapi import HTTPException

# Minimum number of trading days required for a ticker to be included.
# Tickers with fewer days are dropped rather than causing the request to fail.
MIN_DAYS = 30


@dataclass
class StockData:
    """Container for all financial data needed by the optimization algorithms."""
    tickers: List[str]           # Tickers that survived the data quality filter
    mean_returns: np.ndarray     # Annualized expected return per ticker (shape: n,)
    cov_matrix: np.ndarray       # Annualized covariance matrix (shape: n x n)
    correlation_matrix: np.ndarray  # Pearson correlation matrix (shape: n x n) — for the heatmap
    daily_returns: pd.DataFrame  # Daily % returns DataFrame — used for backtesting
    dropped_tickers: List[str] = field(default_factory=list)  # Tickers removed due to insufficient data


def fetch_stock_data(tickers: List[str]) -> StockData:
    """
    Download and process 2 years of historical data for the given tickers.

    The 2-year window is chosen to give:
      - Enough data for stable covariance estimates (≈500 trading days)
      - Recent enough to reflect current market dynamics

    Args:
        tickers: List of uppercase ticker symbols (e.g. ["AAPL", "MSFT"])

    Returns:
        StockData with processed returns and matrices

    Raises:
        HTTPException 422: If no price data is returned, or if tickers are invalid,
                           or if too few tickers survive the data quality filter.
    """
    end = datetime.today()
    start = end - timedelta(days=2 * 365)  # 2-year lookback window

    # Download all tickers in a single batch request (faster than individual calls)
    raw = yf.download(
        tickers,
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        auto_adjust=True,   # adjusts for splits and dividends automatically
        progress=False,     # suppress the tqdm progress bar in server logs
    )

    if raw.empty:
        raise HTTPException(status_code=422, detail="No price data returned. Check tickers.")

    # yfinance 1.x always returns MultiIndex columns: (Price, Ticker)
    # raw["Close"] extracts just the closing prices → DataFrame(index=date, columns=tickers)
    close = raw["Close"]

    # Single-ticker edge case: yfinance returns a Series instead of DataFrame
    if isinstance(close, pd.Series):
        close = close.to_frame(name=tickers[0])

    # Identify any tickers that yfinance couldn't find at all (invalid symbols)
    available = [t for t in tickers if t in close.columns]
    truly_missing = [t for t in tickers if t not in close.columns]
    if truly_missing:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid or unavailable tickers: {', '.join(truly_missing)}",
        )

    # Preserve the user's original ticker ordering
    close = close[available]

    # --- Gap handling ---
    # Forward-fill up to 5 consecutive NaN days.
    # This handles: trading halts, exchange holidays, occasional data feed gaps.
    # Limit of 5 prevents filling weeks-long data outages (which indicate real problems).
    close = close.ffill(limit=5)

    # --- Per-ticker data sufficiency check ---
    # Count non-NaN rows per ticker. Tickers with too few data points (e.g. recent IPOs)
    # are dropped individually rather than failing the whole request.
    counts = close.notna().sum()
    dropped = counts[counts < MIN_DAYS].index.tolist()
    valid_tickers = [t for t in available if t not in dropped]

    # Need at least 2 stocks to form a portfolio
    if len(valid_tickers) < 2:
        dropped_str = ", ".join(dropped)
        raise HTTPException(
            status_code=422,
            detail=(
                f"Too few tickers with sufficient history. "
                f"Tickers removed due to insufficient data (<{MIN_DAYS} days): {dropped_str}. "
                f"Try replacing them with more established stocks."
            ),
        )

    close = close[valid_tickers]

    # Drop date rows where ALL valid tickers are missing (e.g. market holidays)
    close = close.dropna(how="all")

    # Fill any remaining gaps then drop rows still missing any value.
    # After the per-ticker filter, remaining NaNs are isolated and safe to fill.
    close = close.ffill().dropna()

    # Final sanity check: ensure there are enough overlapping trading days
    if len(close) < MIN_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"Only {len(close)} overlapping trading days found across selected tickers. Add more established stocks.",
        )

    # --- Return computation ---
    # pct_change() computes (price_t - price_{t-1}) / price_{t-1} — the daily return
    daily_returns = close.pct_change().dropna()

    # Annualize: multiply daily mean by 252 trading days/year
    # For covariance: variance scales with time, so multiply daily cov by 252
    trading_days = 252
    mean_returns = daily_returns.mean().values * trading_days
    cov_matrix = daily_returns.cov().values * trading_days

    # Pearson correlation is already scale-invariant (no annualization needed)
    correlation_matrix = daily_returns.corr().values

    return StockData(
        tickers=valid_tickers,
        mean_returns=mean_returns,
        cov_matrix=cov_matrix,
        correlation_matrix=correlation_matrix,
        daily_returns=daily_returns,
        dropped_tickers=dropped,
    )


def validate_tickers(tickers: List[str]) -> dict:
    """
    Quick check whether tickers are recognized by Yahoo Finance.

    Downloads only the last 10 days (minimal data) to keep this endpoint fast.
    A ticker is considered valid if yfinance returns at least 2 rows of data for it.

    Used by the frontend to show inline validation before the user submits.

    Args:
        tickers: List of ticker symbols to check

    Returns:
        {"valid": [...], "invalid": [...]}
    """
    end = datetime.today()
    start = end - timedelta(days=10)  # short window — just enough to confirm existence

    raw = yf.download(
        tickers,
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        return {"valid": [], "invalid": tickers}

    close = raw["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(name=tickers[0])

    # A ticker is valid if it appears in the returned columns and has at least 2 data points
    valid = [t for t in tickers if t in close.columns and close[t].dropna().shape[0] >= 2]
    invalid = [t for t in tickers if t not in valid]

    return {"valid": valid, "invalid": invalid}
