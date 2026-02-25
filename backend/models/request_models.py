from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional

MAX_TICKERS = 50


class PortfolioRequest(BaseModel):
    tickers: List[str] = Field(..., description=f"List of stock tickers (2–{MAX_TICKERS})")
    risk_tolerance: float = Field(..., ge=0.0, le=1.0, description="Risk tolerance from 0 (conservative) to 1 (aggressive)")
    ibm_api_key: str = Field(default="", description="IBM Quantum API key (optional if using simulator)")
    use_simulator_fallback: bool = Field(default=False, description="If True, skip IBM hardware and use AerSimulator directly")
    min_stocks: Optional[int] = Field(default=None, ge=1, description="Minimum number of stocks QAOA must select")
    max_stocks: Optional[int] = Field(default=None, ge=1, description="Maximum number of stocks QAOA may select")

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, v: List[str]) -> List[str]:
        cleaned = list(dict.fromkeys(t.strip().upper() for t in v if t.strip()))
        if len(cleaned) < 2:
            raise ValueError("At least 2 valid tickers are required")
        if len(cleaned) > MAX_TICKERS:
            raise ValueError(f"Maximum of {MAX_TICKERS} tickers allowed")
        return cleaned

    @model_validator(mode="after")
    def check_stock_bounds(self) -> "PortfolioRequest":
        lo, hi = self.min_stocks, self.max_stocks
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min_stocks must be ≤ max_stocks")
        return self
