"""
Classical Markowitz mean-variance optimization using scipy.optimize.
Minimizes: portfolio_risk - risk_tolerance * portfolio_return
Subject to: weights sum to 1, all weights >= 0 (long-only).
"""

import numpy as np
from scipy.optimize import minimize
from typing import List


def run_classical_optimization(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_tolerance: float,
) -> np.ndarray:
    """
    Returns optimal continuous weight vector (sums to 1).
    risk_tolerance: 0 = minimize risk only, 1 = maximize return only.
    """
    n = len(mean_returns)

    def objective(w: np.ndarray) -> float:
        port_return = np.dot(w, mean_returns)
        port_variance = w @ cov_matrix @ w
        # Minimize: variance - lambda * return
        return port_variance - risk_tolerance * port_return

    def objective_grad(w: np.ndarray) -> np.ndarray:
        grad_var = 2 * cov_matrix @ w
        grad_ret = -risk_tolerance * mean_returns
        return grad_var + grad_ret

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    bounds = [(0.0, 1.0)] * n

    # Try multiple starting points to avoid local minima
    best_result = None
    best_val = np.inf

    start_points = [
        np.ones(n) / n,                         # Equal weight
        np.eye(n)[np.argmax(mean_returns)],     # All-in best return
        np.random.dirichlet(np.ones(n)),         # Random
    ]

    for x0 in start_points:
        res = minimize(
            objective,
            x0,
            jac=objective_grad,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"ftol": 1e-9, "maxiter": 1000},
        )
        if res.success and res.fun < best_val:
            best_val = res.fun
            best_result = res

    if best_result is None or not best_result.success:
        # Fallback: equal weight
        return np.ones(n) / n

    weights = best_result.x
    weights = np.clip(weights, 0, 1)
    weights /= weights.sum()
    return weights
