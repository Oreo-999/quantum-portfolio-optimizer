from pydantic import BaseModel, Field, field_validator
from typing import List


class PortfolioRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=2, max_length=10, description="List of stock tickers (2-10)")
    risk_tolerance: float = Field(..., ge=0.0, le=1.0, description="Risk tolerance from 0 (conservative) to 1 (aggressive)")
    ibm_api_key: str = Field(default="", description="IBM Quantum API key (optional if using simulator)")
    use_simulator_fallback: bool = Field(default=False, description="If True, skip IBM hardware and use AerSimulator directly")

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, v: List[str]) -> List[str]:
        cleaned = [t.strip().upper() for t in v if t.strip()]
        if len(cleaned) < 2:
            raise ValueError("At least 2 valid tickers are required")
        if len(cleaned) > 10:
            raise ValueError("Maximum of 10 tickers allowed")
        return cleaned
