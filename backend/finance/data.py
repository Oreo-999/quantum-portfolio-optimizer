"""
Stock data fetcher: pulls 2 years of adjusted close prices via yfinance.
Downloads each ticker individually to avoid yfinance MultiIndex column issues
across different versions.
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
    daily_returns: pd.DataFrame    # raw daily returns


def _extract_close(raw: pd.DataFrame, ticker: str) -> pd.Series:
    """
    Robustly extract the Close price series from a yfinance download result.
    Handles flat columns, MultiIndex columns, and auto_adjust variants.
    """
    if raw.empty:
        return pd.Series(dtype=float, name=ticker)

    cols = raw.columns

    # MultiIndex: (field, ticker) — common for multi-ticker downloads
    if isinstance(cols, pd.MultiIndex):
        if ("Close", ticker) in cols:
            return raw[("Close", ticker)].rename(ticker)
        if ("Adj Close", ticker) in cols:
            return raw[("Adj Close", ticker)].rename(ticker)
        # Try first available close-like column
        for field in ["Close", "Adj Close"]:
            matches = [(f, t) for (f, t) in cols if f == field]
            if matches:
                return raw[matches[0]].rename(ticker)
        return pd.Series(dtype=float, name=ticker)

    # Flat columns (single ticker download)
    for col in ["Close", "Adj Close"]:
        if col in cols:
            return raw[col].rename(ticker)

    return pd.Series(dtype=float, name=ticker)


def fetch_stock_data(tickers: List[str]) -> StockData:
    end = datetime.today()
    start = end - timedelta(days=2 * 365)
    start_str = start.strftime("%Y-%m-%d")
    end_str = end.strftime("%Y-%m-%d")

    close_series = {}
    failed = []

    for ticker in tickers:
        try:
            raw = yf.download(
                ticker,
                start=start_str,
                end=end_str,
                auto_adjust=True,
                progress=False,
                actions=False,
            )
            series = _extract_close(raw, ticker)
            if series.empty or series.dropna().empty:
                failed.append(ticker)
            else:
                close_series[ticker] = series
        except Exception:
            failed.append(ticker)

    if failed:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid or unavailable tickers: {', '.join(failed)}",
        )

    if not close_series:
        raise HTTPException(status_code=422, detail="No price data returned. Check tickers.")

    # Combine into a single DataFrame aligned on dates
    close = pd.DataFrame(close_series)[tickers]
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
    end = datetime.today()
    start = end - timedelta(days=10)
    start_str = start.strftime("%Y-%m-%d")
    end_str = end.strftime("%Y-%m-%d")

    valid = []
    invalid = []

    for ticker in tickers:
        try:
            raw = yf.download(
                ticker,
                start=start_str,
                end=end_str,
                auto_adjust=True,
                progress=False,
                actions=False,
            )
            series = _extract_close(raw, ticker).dropna()
            if len(series) >= 2:
                valid.append(ticker)
            else:
                invalid.append(ticker)
        except Exception:
            invalid.append(ticker)

    return {"valid": valid, "invalid": invalid}
