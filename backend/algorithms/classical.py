"""
Classical Markowitz mean-variance optimization using scipy.optimize.

Theory
------
Modern Portfolio Theory (Markowitz, 1952) seeks the allocation that maximizes
expected return for a given level of risk (or equivalently minimizes risk for
a given return). This is a convex quadratic program:

  minimize   w^T Σ w  -  λ * μ^T w
  subject to Σ_i w_i = 1
             w_i ≥ 0  (long-only)

where:
  w  = portfolio weight vector (continuous, sums to 1)
  Σ  = annualized covariance matrix
  μ  = annualized expected return vector
  λ  = risk_tolerance ∈ [0,1]  (0 = min risk, 1 = max return)

We solve this with scipy's SLSQP (Sequential Least Squares Programming), a
gradient-based constrained optimizer. Multiple starting points are tried to
avoid local minima — the best feasible solution is returned.

This provides the "classical benchmark" that the QAOA result is compared against.
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
    Solve the Markowitz mean-variance optimization problem.

    Args:
        mean_returns:    Annualized expected return per stock (shape: n,)
        cov_matrix:      Annualized covariance matrix (shape: n x n)
        risk_tolerance:  λ ∈ [0,1] — 0 = minimize risk, 1 = maximize return

    Returns:
        weights: Optimal weight vector (shape: n,), sums to 1, all ≥ 0
    """
    n = len(mean_returns)

    def objective(w: np.ndarray) -> float:
        """
        Scalar objective to minimize.
        Variance term: w^T Σ w (portfolio variance = risk²)
        Return term:  -λ * μ^T w (negative because we minimize, but want to maximize return)
        """
        port_return = np.dot(w, mean_returns)
        port_variance = w @ cov_matrix @ w
        return port_variance - risk_tolerance * port_return

    def objective_grad(w: np.ndarray) -> np.ndarray:
        """
        Analytical gradient of the objective — makes SLSQP converge faster
        and more accurately than finite-difference approximations.

        d/dw [w^T Σ w]  = 2 Σ w   (chain rule on quadratic form)
        d/dw [-λ μ^T w] = -λ μ
        """
        grad_var = 2 * cov_matrix @ w
        grad_ret = -risk_tolerance * mean_returns
        return grad_var + grad_ret

    # Constraints: weights must sum to exactly 1
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    # Bounds: each weight ∈ [0, 1] — long-only (no short selling)
    bounds = [(0.0, 1.0)] * n

    # --- Multi-start strategy to avoid local minima ---
    # SLSQP is a local optimizer, so different starting points can yield different solutions.
    # We try three diverse initializations and keep the best feasible result.
    best_result = None
    best_val = np.inf

    start_points = [
        np.ones(n) / n,                         # Equal-weight (1/N portfolio) — good neutral start
        np.eye(n)[np.argmax(mean_returns)],     # 100% in the highest-return stock — aggressive start
        np.random.dirichlet(np.ones(n)),         # Random Dirichlet — explores different region
    ]

    for x0 in start_points:
        res = minimize(
            objective,
            x0,
            jac=objective_grad,       # provide exact gradient for faster convergence
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"ftol": 1e-9, "maxiter": 1000},
        )
        # Only accept feasible solutions; keep the one with lowest objective value
        if res.success and res.fun < best_val:
            best_val = res.fun
            best_result = res

    # Fallback: if all starting points failed, return equal weights
    if best_result is None or not best_result.success:
        return np.ones(n) / n

    # Clip tiny negative weights (numerical noise from SLSQP) and renormalize
    weights = best_result.x
    weights = np.clip(weights, 0, 1)
    weights /= weights.sum()

    return weights
