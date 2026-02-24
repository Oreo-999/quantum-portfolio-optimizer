"""
Stock data fetcher using yfinance >= 1.0.

Handles tickers with limited history (new IPOs, recent listings) by:
  1. Forward-filling short gaps (halts, holidays, data quirks)
  2. Dropping individual tickers with fewer than MIN_DAYS of data
     rather than failing the entire request
  3. Proceeding with the valid subset and reporting dropped tickers
"""

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Tuple
from dataclasses import dataclass, field
from fastapi import HTTPException

MIN_DAYS = 30  # minimum trading days required per ticker


@dataclass
class StockData:
    tickers: List[str]
    mean_returns: np.ndarray
    cov_matrix: np.ndarray
    correlation_matrix: np.ndarray
    daily_returns: pd.DataFrame
    dropped_tickers: List[str] = field(default_factory=list)


def fetch_stock_data(tickers: List[str]) -> StockData:
    end = datetime.today()
    start = end - timedelta(days=2 * 365)

    raw = yf.download(
        tickers,
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        raise HTTPException(status_code=422, detail="No price data returned. Check tickers.")

    # yfinance 1.x always returns MultiIndex (Price, Ticker)
    close = raw["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(name=tickers[0])

    # Reorder to requested order, ignoring any that yfinance didn't return at all
    available = [t for t in tickers if t in close.columns]
    truly_missing = [t for t in tickers if t not in close.columns]
    if truly_missing:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid or unavailable tickers: {', '.join(truly_missing)}",
        )

    close = close[available]

    # Forward-fill small gaps (up to 5 days) — handles halts, data quirks, holidays
    close = close.ffill(limit=5)

    # Drop individual tickers that still have fewer than MIN_DAYS of data
    counts = close.notna().sum()
    dropped = counts[counts < MIN_DAYS].index.tolist()
    valid_tickers = [t for t in available if t not in dropped]

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

    # Now drop rows where ALL remaining tickers are NaN (completely empty dates)
    close = close.dropna(how="all")

    # Forward-fill any remaining gaps, then drop rows still missing any value
    close = close.ffill().dropna()

    if len(close) < MIN_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"Only {len(close)} overlapping trading days found across selected tickers. Add more established stocks.",
        )

    daily_returns = close.pct_change().dropna()

    trading_days = 252
    mean_returns = daily_returns.mean().values * trading_days
    cov_matrix = daily_returns.cov().values * trading_days
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
    end = datetime.today()
    start = end - timedelta(days=10)

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

    valid = [t for t in tickers if t in close.columns and close[t].dropna().shape[0] >= 2]
    invalid = [t for t in tickers if t not in valid]
    return {"valid": valid, "invalid": invalid}
