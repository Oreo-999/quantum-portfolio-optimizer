"""
Stock data fetcher using yfinance >= 1.0.
In v1.x both single and multi-ticker downloads always return a MultiIndex
DataFrame with (Price, Ticker) columns, so we just do raw["Close"].
"""

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import List
from dataclasses import dataclass
from fastapi import HTTPException


@dataclass
class StockData:
    tickers: List[str]
    mean_returns: np.ndarray
    cov_matrix: np.ndarray
    correlation_matrix: np.ndarray
    daily_returns: pd.DataFrame


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

    # If only one ticker, result is a Series — convert to DataFrame
    if isinstance(close, pd.Series):
        close = close.to_frame(name=tickers[0])

    # Validate all tickers are present
    missing = [t for t in tickers if t not in close.columns]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid or unavailable tickers: {', '.join(missing)}",
        )

    close = close[tickers].dropna()

    if len(close) < 30:
        raise HTTPException(
            status_code=422,
            detail="Insufficient historical data (need at least 30 trading days).",
        )

    daily_returns = close.pct_change().dropna()

    trading_days = 252
    mean_returns = daily_returns.mean().values * trading_days
    cov_matrix = daily_returns.cov().values * trading_days
    correlation_matrix = daily_returns.corr().values

    return StockData(
        tickers=tickers,
        mean_returns=mean_returns,
        cov_matrix=cov_matrix,
        correlation_matrix=correlation_matrix,
        daily_returns=daily_returns,
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
