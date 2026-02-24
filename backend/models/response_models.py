from pydantic import BaseModel
from typing import Dict, List, Optional


class SolutionMetrics(BaseModel):
    expected_return: float
    volatility: float
    sharpe_ratio: float


class Metrics(BaseModel):
    qaoa: SolutionMetrics
    classical: SolutionMetrics


class Benchmark(BaseModel):
    ticker: str = "SPY"
    expected_return: float
    volatility: float
    sharpe_ratio: float


class BacktestPoint(BaseModel):
    date: str
    qaoa: float       # cumulative return %
    classical: float
    spy: float


class FrontierPoint(BaseModel):
    volatility: float
    expected_return: float
    sharpe: float
    type: str          # "random" | "frontier"


class PortfolioResponse(BaseModel):
    qaoa_allocation: Dict[str, float]
    classical_allocation: Dict[str, float]
    metrics: Metrics
    benchmark: Benchmark
    correlation_matrix: List[List[float]]
    tickers: List[str]
    dropped_tickers: List[str]
    backend_used: str
    used_simulator_fallback: bool
    fallback_reason: Optional[str] = None
    raw_counts: Dict[str, int]
    backtest: List[BacktestPoint]
    frontier: List[FrontierPoint]
    convergence: List[float]
