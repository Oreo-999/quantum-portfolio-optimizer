from pydantic import BaseModel, Field, field_validator
from typing import List


QAOA_MAX = 10   # max stocks sent to QAOA (qubit limit)
TOTAL_MAX = 50  # max total tickers per request


class PortfolioRequest(BaseModel):
    tickers: List[str] = Field(..., description=f"List of stock tickers (2–{TOTAL_MAX})")
    risk_tolerance: float = Field(..., ge=0.0, le=1.0, description="Risk tolerance from 0 (conservative) to 1 (aggressive)")
    ibm_api_key: str = Field(default="", description="IBM Quantum API key (optional if using simulator)")
    use_simulator_fallback: bool = Field(default=False, description="If True, skip IBM hardware and use AerSimulator directly")

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, v: List[str]) -> List[str]:
        cleaned = list(dict.fromkeys(t.strip().upper() for t in v if t.strip()))  # deduplicate, preserve order
        if len(cleaned) < 2:
            raise ValueError("At least 2 valid tickers are required")
        if len(cleaned) > TOTAL_MAX:
            raise ValueError(f"Maximum of {TOTAL_MAX} tickers allowed")
        return cleaned
