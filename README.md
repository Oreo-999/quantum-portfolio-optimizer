# Quantum Portfolio Optimizer

A full-stack application that uses the **Quantum Approximate Optimization Algorithm (QAOA)** to optimize stock portfolio allocation — compared side-by-side with classical Markowitz mean-variance optimization. Real IBM Quantum hardware is used for portfolios of 5 or fewer stocks; AerSimulator handles larger portfolios automatically.

---

## Features

- **QAOA optimization** via Qiskit on real IBM Quantum hardware or local AerSimulator
- **Classical Markowitz** mean-variance optimization using scipy for direct comparison
- **Smart backend selection** — automatically routes to AerSimulator for 6–10 stocks, gracefully falls back if IBM connection fails
- **Live S&P 500 benchmark** pulled via yfinance over the same 2-year window
- **Rich visualizations** — dual allocation pie charts, metrics cards, correlation heatmap, QAOA vs classical bar chart, projected performance line chart, and raw measurement counts
- **Polished dark UI** built with React 18, Tailwind CSS, and Recharts

---

## Screenshots

> Add screenshots here after first run

---

## Architecture

```
Portfolio-Optimizer/
├── backend/
│   ├── main.py                  # FastAPI app — routes & pipeline orchestration
│   ├── config.py                # IBM key setup & backend selector
│   ├── requirements.txt
│   ├── algorithms/
│   │   ├── qaoa.py              # QUBO formulation → QAOA circuit → Sampler primitive
│   │   └── classical.py        # Markowitz optimization via scipy SLSQP
│   ├── finance/
│   │   ├── data.py              # yfinance 2-year data pull, returns, covariance matrix
│   │   └── metrics.py          # Sharpe ratio, volatility, SPY benchmark
│   └── models/
│       ├── request_models.py   # Pydantic request models
│       └── response_models.py  # Pydantic response models
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        ├── api/client.js        # Axios instance & API functions
        ├── hooks/usePortfolio.js
        └── components/
            ├── TickerInput.jsx
            ├── PortfolioResults.jsx
            ├── AllocationChart.jsx
            ├── MetricsPanel.jsx
            ├── CorrelationHeatmap.jsx
            ├── ComparisonChart.jsx
            ├── BenchmarkChart.jsx
            ├── BackendBadge.jsx
            └── LoadingState.jsx
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) [IBM Quantum account](https://quantum.ibm.com/) for real hardware

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev                     # Starts at http://localhost:3000
```

---

## Usage

1. Add **2–10 stock tickers** (type and press Enter, or click the suggestion chips)
2. Set **risk tolerance** from 0 (minimize risk) to 1 (maximize return)
3. Choose **AerSimulator** (instant, no account needed) or **IBM Quantum Hardware**
4. If using IBM hardware, paste your [IBM Quantum API key](https://quantum.ibm.com/)
5. Click **Optimize Portfolio** and wait for results

---

## Quantum Backend Selection

| Condition | Backend Used |
|---|---|
| Simulator toggle ON | AerSimulator (always) |
| Simulator toggle OFF + ≤5 stocks + valid IBM key | Real IBM Quantum hardware |
| Simulator toggle OFF + ≥6 stocks | AerSimulator (auto, flagged in UI) |
| IBM connection or job failure | AerSimulator (graceful fallback, reason shown) |

The active backend and any fallback reason are always displayed in the result UI via a colored badge.

---

## How It Works

### QUBO Formulation

Each stock is a binary decision variable $x_i \in \{0, 1\}$. The objective minimizes:

$$\min_{x} \sum_{i,j} \sigma_{ij} x_i x_j - \lambda \sum_i \mu_i x_i$$

where $\sigma_{ij}$ is the covariance between stocks $i$ and $j$, $\mu_i$ is the annualized expected return of stock $i$, and $\lambda$ is the risk tolerance parameter.

### QAOA

- **Layers:** p = 2
- **Shots:** 1024
- **Optimizer:** COBYLA (classical outer loop)
- **Primitive:** `SamplerV2` for IBM hardware, `StatevectorSampler` for AerSimulator
- The circuit is transpiled and optimized for the target backend before execution

### Classical Comparison

Markowitz mean-variance optimization using `scipy.optimize.minimize` with SLSQP, long-only constraint (weights ≥ 0), and sum-to-1 constraint. Multi-start to avoid local minima.

---

## API Reference

### `POST /optimize`

**Request body:**

```json
{
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  "risk_tolerance": 0.5,
  "ibm_api_key": "your-key-here",
  "use_simulator_fallback": true
}
```

**Response:**

```json
{
  "qaoa_allocation": { "AAPL": 50.0, "MSFT": 50.0, "GOOGL": 0.0 },
  "classical_allocation": { "AAPL": 32.1, "MSFT": 41.3, "GOOGL": 26.6 },
  "metrics": {
    "qaoa": { "expected_return": 0.18, "volatility": 0.21, "sharpe_ratio": 0.62 },
    "classical": { "expected_return": 0.19, "volatility": 0.19, "sharpe_ratio": 0.74 }
  },
  "benchmark": { "ticker": "SPY", "expected_return": 0.12, "volatility": 0.16, "sharpe_ratio": 0.44 },
  "correlation_matrix": [[1.0, 0.7, 0.6], [0.7, 1.0, 0.8], [0.6, 0.8, 1.0]],
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  "backend_used": "AerSimulator",
  "used_simulator_fallback": true,
  "fallback_reason": "Simulator selected by user",
  "raw_counts": { "101": 312, "110": 287, "011": 201 }
}
```

### `GET /validate-tickers?tickers=AAPL&tickers=MSFT`

Returns `{ "valid": ["AAPL", "MSFT"], "invalid": [] }`

### `GET /health`

Returns `{ "status": "ok", "service": "Quantum Portfolio Optimizer" }`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Quantum runtime | Qiskit 1.1, qiskit-ibm-runtime, qiskit-aer, qiskit-optimization |
| Financial data | yfinance, pandas, numpy |
| Classical optimization | scipy |
| Backend API | FastAPI, Uvicorn, Pydantic v2 |
| Frontend framework | React 18, Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| HTTP client | Axios |

---

## Constraints

- Maximum **10 stocks**, minimum **2 stocks**
- Historical data window: **2 years**
- Risk-free rate for Sharpe ratio: **5%**
- IBM free tier only — no paid quantum services required

---

## Disclaimer

This application is for **educational and research purposes only**. It is not financial advice. Quantum optimization results are probabilistic and may not reflect real-world portfolio performance.
