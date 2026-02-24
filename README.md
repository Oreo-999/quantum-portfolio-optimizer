# Quantum Portfolio Optimizer

A full-stack application that uses the **Quantum Approximate Optimization Algorithm (QAOA)** to solve portfolio selection as a combinatorial optimization problem. The quantum result is benchmarked side-by-side against classical Markowitz mean-variance optimization, with real historical backtesting, an efficient frontier plot, and QAOA convergence visualization.

Built with **Qiskit** (IBM Quantum / AerSimulator), **FastAPI**, and **React**.

---

## What It Does

You input a list of stock tickers and a risk tolerance. The app:

1. Downloads 2 years of historical price data from Yahoo Finance
2. Formulates the portfolio selection problem as a **QUBO** (Quadratic Unconstrained Binary Optimization)
3. Maps the QUBO to an **Ising Hamiltonian** and runs QAOA to find the optimal binary selection (which stocks to include)
4. Simultaneously runs **Markowitz mean-variance optimization** via scipy as a classical comparison
5. Backtests both allocations on real historical returns vs the S&P 500
6. Generates the **efficient frontier** to show where each solution sits in risk/return space

---

## Features

| Feature | Description |
|---|---|
| **QAOA optimization** | Qiskit QAOAAnsatz with p=2 layers, COBYLA variational optimizer, 1024 shots |
| **Classical Markowitz** | scipy SLSQP with multi-start initialization and analytical gradient |
| **Smart backend routing** | IBM hardware for ≤5 stocks, AerSimulator for larger portfolios, auto-fallback |
| **Historical backtest** | 2-year cumulative return chart vs S&P 500 (actual returns, not projected) |
| **Efficient frontier** | 300 random portfolios + 40 analytical frontier points, QAOA/Classical markers |
| **Convergence chart** | COBYLA cost function per iteration — see the quantum optimizer converge |
| **QAOA explainer** | In-depth "How it works" tab covering the full quantum pipeline |
| **Correlation heatmap** | Pearson correlation matrix across all selected stocks |
| **Measurement counts** | Raw quantum circuit output — the actual bitstring distribution |
| **Up to 50 tickers** | AerSimulator scales to large portfolios using shot-based simulation |

---

## Screenshots

> Add screenshots after running

---

## How It Works

### 1. Problem Formulation (QUBO)

Portfolio selection is naturally binary: for each stock $x_i \in \{0,1\}$, we either include it or we don't. This maps directly to a QUBO:

$$\min_{x \in \{0,1\}^n} \quad x^T Q x$$

where $Q$ encodes the tradeoff between **risk** (covariance) and **return**:

$$Q_{ij} = \frac{\sigma_{ij}}{\sigma_{\max}}, \quad Q_{ii} = \frac{\sigma_{ii}}{\sigma_{\max}} - \lambda \cdot \frac{\mu_i}{\mu_{\max}}$$

- $\sigma_{ij}$: covariance between stocks $i$ and $j$
- $\mu_i$: annualized expected return of stock $i$
- $\lambda$: risk tolerance parameter (0 = minimize risk, 1 = maximize return)

Both terms are normalized so $\lambda$ has consistent meaning across different stock universes.

### 2. Ising Hamiltonian Mapping

Quantum computers operate on qubits with $\{-1, +1\}$ eigenvalues (spin variables), not binary $\{0,1\}$ variables. The substitution $x_i = (1 - z_i)/2$ transforms the QUBO into an **Ising Hamiltonian**:

$$H = \sum_{i} h_i Z_i + \sum_{i < j} J_{ij} Z_i Z_j$$

This is a sum of Pauli-Z and ZZ operators, which Qiskit's `QuadraticProgramToQubo` + `to_ising()` handles automatically.

### 3. QAOA Circuit

QAOA approximates the ground state of $H$ using a parameterized quantum circuit with $p$ alternating layers:

$$|\psi(\gamma, \beta)\rangle = \prod_{l=1}^{p} U_M(\beta_l) \cdot U_C(\gamma_l) \cdot |+\rangle^n$$

- **Initial state** $|+\rangle^n$: uniform superposition over all $2^n$ bitstrings (all portfolios equally likely)
- **Cost unitary** $U_C(\gamma_l) = e^{-i\gamma_l H}$: rotates the state to prefer low-energy (good) portfolios
- **Mixer unitary** $U_M(\beta_l) = e^{-i\beta_l \sum_i X_i}$: applies transverse-field mixing to explore the solution space
- **Measurement**: sample the final state to get candidate portfolio bitstrings

This app uses $p = 2$ layers — a good quality/speed tradeoff for near-term hardware.

### 4. Classical Outer Loop (COBYLA)

The $2p$ angles $(\gamma_1, \beta_1, \ldots, \gamma_p, \beta_p)$ are optimized by a classical computer running **COBYLA** (Constrained Optimization By Linear Approximations):

```
Initialize γ, β randomly
Repeat until convergence:
  1. Run quantum circuit with current γ, β
  2. Measure: compute ⟨H⟩ = Σ P(bitstring) × E(bitstring)
  3. COBYLA updates γ, β to reduce ⟨H⟩
Final measurement: high-shot run at optimal angles
```

COBYLA is derivative-free — it doesn't require gradients, which is important because quantum measurements are inherently noisy.

### 5. Classical Comparison (Markowitz)

The classical optimizer solves the **continuous** relaxation of the same problem:

$$\min_{w} \quad w^T \Sigma w - \lambda \cdot \mu^T w \quad \text{s.t.} \quad \sum_i w_i = 1, \quad w_i \geq 0$$

This gives a fractional allocation (e.g. 32.1% AAPL) rather than binary. It's solved with scipy's SLSQP using analytical gradients and three starting points.

### 6. Backtesting

Both allocations are applied as **static buy-and-hold weights** to the same 2-year historical returns:

$$C(T) = \left(\prod_{t=1}^{T} (1 + w^T r_t) - 1\right) \times 100\%$$

This is an **in-sample** simulation — it measures how well each method would have fit the historical period, not forward-looking performance.

---

## Architecture

```
Portfolio-Optimizer/
├── backend/
│   ├── main.py                  # FastAPI app — 8-step optimization pipeline
│   ├── config.py                # Quantum backend selector (IBM vs AerSimulator)
│   ├── requirements.txt
│   ├── algorithms/
│   │   ├── qaoa.py              # QUBO → Ising → QAOAAnsatz → COBYLA loop
│   │   └── classical.py        # Markowitz via scipy SLSQP, multi-start
│   ├── finance/
│   │   ├── data.py              # yfinance data fetch, cleaning, returns computation
│   │   └── metrics.py          # Sharpe ratio, volatility, SPY benchmark, backtesting
│   └── models/
│       ├── request_models.py   # Pydantic request schema (tickers, risk_tolerance, etc.)
│       └── response_models.py  # Pydantic response schema (allocation, metrics, frontier, etc.)
└── frontend/
    ├── vite.config.js
    ├── tailwind.config.js       # Dark monochrome palette + custom component tokens
    └── src/
        ├── App.jsx              # Root layout, tab navigation (Optimizer / How it works)
        ├── index.css            # Component classes (.card, .btn-primary, .label, etc.)
        ├── api/
        │   └── client.js        # Axios instance + API functions
        ├── hooks/
        │   └── usePortfolio.js  # All form + async state, submit handler
        └── components/
            ├── TickerInput.jsx       # Ticker chips, risk slider, backend toggle, submit
            ├── PortfolioResults.jsx  # Orchestrates all result components
            ├── AllocationChart.jsx   # Dual donut charts (QAOA vs Classical)
            ├── MetricsPanel.jsx      # Return / volatility / Sharpe comparison table
            ├── CorrelationHeatmap.jsx # Pearson correlation heatmap
            ├── ComparisonChart.jsx   # Side-by-side bar chart of all metrics
            ├── BenchmarkChart.jsx    # 2-year cumulative returns vs S&P 500
            ├── EfficientFrontier.jsx # Scatter plot: random portfolios + frontier curve
            ├── ConvergenceChart.jsx  # COBYLA cost function per iteration
            ├── QAOAExplainer.jsx     # 8-section educational explainer
            ├── BackendBadge.jsx      # IBM / Simulator / Fallback badge
            └── LoadingState.jsx      # Animated loading with stage messages
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) [IBM Quantum account](https://quantum.ibm.com/) — free tier works

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`.
Interactive docs (Swagger UI) at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev                     # Starts at http://localhost:3000
```

---

## Usage

1. Add **2–50 stock tickers** — type and press Enter, or click suggestion chips
2. Set **risk tolerance** (0 = minimize volatility, 1 = maximize return)
3. Choose **AerSimulator** (instant, no account) or **IBM Quantum Hardware** (real device)
4. If using IBM hardware, paste your [IBM Quantum API key](https://quantum.ibm.com/)
5. Click **Optimize Portfolio** — results appear on the right with all charts

---

## Quantum Backend Selection

| Condition | Backend | Reason |
|---|---|---|
| Simulator toggle ON | AerSimulator | User chose simulator |
| > 5 stocks | AerSimulator | Free-tier IBM hardware has ≤ 5–7 qubits |
| ≤ 5 stocks + valid IBM key | IBM hardware | Least-busy device with enough qubits |
| IBM connection fails | AerSimulator | Graceful fallback, reason shown in UI |
| No IBM key | AerSimulator | No credentials provided |

The active backend and any fallback reason are displayed in the result header via a colored badge.

---

## API Reference

### `POST /optimize`

**Request:**
```json
{
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  "risk_tolerance": 0.5,
  "ibm_api_key": "",
  "use_simulator_fallback": true
}
```

**Response (abbreviated):**
```json
{
  "qaoa_allocation":     { "AAPL": 50.0, "MSFT": 50.0, "GOOGL": 0.0 },
  "classical_allocation":{ "AAPL": 32.1, "MSFT": 41.3, "GOOGL": 26.6 },
  "metrics": {
    "qaoa":      { "expected_return": 0.18, "volatility": 0.21, "sharpe_ratio": 0.62 },
    "classical": { "expected_return": 0.19, "volatility": 0.19, "sharpe_ratio": 0.74 }
  },
  "benchmark":   { "ticker": "SPY", "expected_return": 0.12, "volatility": 0.16, "sharpe_ratio": 0.44 },
  "backend_used": "AerSimulator",
  "used_simulator_fallback": true,
  "fallback_reason": "Simulator selected by user",
  "raw_counts":  { "101": 312, "110": 287, "011": 201 },
  "convergence": [-0.12, -0.15, -0.19, ...],
  "backtest":    [{ "date": "2023-01-03", "qaoa": 0.0, "classical": 0.0, "spy": 0.0 }, ...],
  "frontier":    [{ "volatility": 0.18, "expected_return": 0.14, "sharpe": 0.5, "type": "random" }, ...]
}
```

### `GET /validate-tickers?tickers=AAPL&tickers=MSFT`

Returns `{ "valid": ["AAPL", "MSFT"], "invalid": [] }`

### `GET /health`

Returns `{ "status": "ok", "service": "Quantum Portfolio Optimizer" }`

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Quantum circuit | Qiskit 1.1, QAOAAnsatz | QAOA circuit construction and execution |
| Quantum runtime | qiskit-ibm-runtime 0.23 | IBM hardware SamplerV2 + Session |
| Quantum simulation | qiskit-aer 0.14 | Local AerSimulator for large portfolios |
| QUBO formulation | qiskit-optimization 0.6 | QUBO → Ising Hamiltonian conversion |
| Classical optimizer | scipy SLSQP | Markowitz mean-variance optimization |
| Financial data | yfinance 1.x, pandas | Historical price data and returns |
| Backend API | FastAPI, Uvicorn, Pydantic v2 | REST API with automatic validation |
| Frontend | React 18, Vite | Component-based UI |
| Styling | Tailwind CSS | Dark monochrome design system |
| Charts | Recharts | All data visualizations |
| HTTP client | Axios | Frontend → backend communication |

---

## Constraints and Notes

- **Minimum 2, maximum 50 stocks** per optimization
- **2-year historical window** — shorter windows give unreliable covariance estimates
- **Risk-free rate: 5%** — used in Sharpe ratio calculation
- **QAOA gives binary output** — each stock is either included (equal weight) or excluded.
  The classical optimizer gives continuous fractional weights.
- **Backtesting is in-sample** — the same period used for optimization. Not a forward prediction.
- **IBM free tier** — no paid quantum services required. Free tier gives access to real hardware.

---

## Disclaimer

This application is for **educational and research purposes only**. It is not financial advice. Past performance does not predict future results. Quantum optimization results are probabilistic and subject to hardware noise.
