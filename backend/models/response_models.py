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


class PortfolioResponse(BaseModel):
    qaoa_allocation: Dict[str, float]          # ticker -> percentage (0-100)
    classical_allocation: Dict[str, float]     # ticker -> percentage (0-100)
    metrics: Metrics
    benchmark: Benchmark
    correlation_matrix: List[List[float]]
    tickers: List[str]
    dropped_tickers: List[str]
    backend_used: str
    used_simulator_fallback: bool
    fallback_reason: Optional[str] = None
    raw_counts: Dict[str, int]
