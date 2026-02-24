"""
Stock data fetcher: pulls 2 years of adjusted close prices via yfinance,
computes daily returns, annualized mean returns, and covariance matrix.
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
    mean_returns: np.ndarray       # annualized, shape (n,)
    cov_matrix: np.ndarray         # annualized, shape (n, n)
    correlation_matrix: np.ndarray # shape (n, n)
    daily_returns: pd.DataFrame    # raw daily returns for charting


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

    # Handle single vs multi ticker column structure
    if len(tickers) == 1:
        close = raw[["Close"]].copy()
        close.columns = tickers
    else:
        close = raw["Close"].copy()

    # Drop tickers with no data and validate
    close.dropna(axis=1, how="all", inplace=True)
    missing = [t for t in tickers if t not in close.columns]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid or unavailable tickers: {', '.join(missing)}",
        )

    # Reorder to match requested order
    close = close[tickers]

    # Drop rows where any ticker has NaN (aligns data across tickers)
    close.dropna(inplace=True)

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
    """Quick validation: download 5 days of data and check which tickers returned prices."""
    end = datetime.today()
    start = end - timedelta(days=10)

    valid = []
    invalid = []

    for ticker in tickers:
        try:
            data = yf.download(
                ticker,
                start=start.strftime("%Y-%m-%d"),
                end=end.strftime("%Y-%m-%d"),
                auto_adjust=True,
                progress=False,
            )
            if data.empty or len(data) < 2:
                invalid.append(ticker)
            else:
                valid.append(ticker)
        except Exception:
            invalid.append(ticker)

    return {"valid": valid, "invalid": invalid}
