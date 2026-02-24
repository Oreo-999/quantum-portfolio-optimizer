"""
QAOA portfolio optimizer.

QUBO formulation:
  Each stock i is a binary variable x_i ∈ {0, 1}.
  Objective: minimize  Σ_i Σ_j cov[i,j] * x_i * x_j
                      - risk_tolerance * Σ_i mean_return[i] * x_i

This is a QUBO problem. We use qiskit-optimization to encode it,
build a QAOAAnsatz, and run via the Sampler primitive.

For IBM hardware: uses qiskit-ibm-runtime SamplerV2.
For AerSimulator: uses StatevectorSampler from qiskit.primitives.
"""

import numpy as np
from typing import Tuple, Dict
from config import BackendConfig


def build_qubo_matrix(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_tolerance: float,
) -> np.ndarray:
    """
    Build QUBO matrix Q where the objective is x^T Q x.
    Diagonal: -risk_tolerance * mean_return[i] + cov[i,i]
    Off-diagonal: cov[i,j]  (symmetrized)
    """
    n = len(mean_returns)
    # Normalize to prevent numerical instability
    ret_scale = np.max(np.abs(mean_returns)) if np.max(np.abs(mean_returns)) > 0 else 1.0
    cov_scale = np.max(np.abs(cov_matrix)) if np.max(np.abs(cov_matrix)) > 0 else 1.0

    Q = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            Q[i, j] = cov_matrix[i, j] / cov_scale
        Q[i, i] -= risk_tolerance * mean_returns[i] / ret_scale

    return Q


def run_qaoa(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_tolerance: float,
    backend_config: BackendConfig,
    p: int = 2,
    shots: int = 1024,
) -> Tuple[np.ndarray, Dict[str, int]]:
    """
    Run QAOA and return:
      - binary allocation vector (1 = include stock, 0 = exclude)
      - raw measurement counts dict
    """
    from qiskit_optimization import QuadraticProgram
    from qiskit_optimization.converters import QuadraticProgramToQubo
    from qiskit.circuit.library import QAOAAnsatz
    from qiskit.quantum_info import SparsePauliOp
    from scipy.optimize import minimize as scipy_minimize

    n = len(mean_returns)
    Q = build_qubo_matrix(mean_returns, cov_matrix, risk_tolerance)

    # --- Build QuadraticProgram ---
    qp = QuadraticProgram(name="portfolio")
    for i in range(n):
        qp.binary_var(name=f"x{i}")

    linear = {f"x{i}": Q[i, i] for i in range(n)}
    quadratic = {}
    for i in range(n):
        for j in range(i + 1, n):
            if abs(Q[i, j] + Q[j, i]) > 1e-12:
                quadratic[(f"x{i}", f"x{j}")] = Q[i, j] + Q[j, i]

    qp.minimize(linear=linear, quadratic=quadratic)

    # Convert to QUBO / Ising
    converter = QuadraticProgramToQubo()
    qubo = converter.convert(qp)

    # Get Ising operator
    from qiskit_optimization.converters import QuadraticProgramToQubo
    from qiskit_algorithms.utils import algorithm_globals
    algorithm_globals.random_seed = 42

    ising_op, offset = qubo.to_ising()

    # --- Build QAOA circuit ---
    ansatz = QAOAAnsatz(cost_operator=ising_op, reps=p)
    ansatz.measure_all()

    num_params = ansatz.num_parameters

    # --- Choose sampler based on backend type ---
    if backend_config.is_ibm_hardware:
        raw_counts, optimal_params = _run_on_ibm(
            ansatz, ising_op, num_params, backend_config.backend, shots
        )
    else:
        raw_counts, optimal_params = _run_on_aer(
            ansatz, ising_op, num_params, backend_config.backend, shots
        )

    # --- Extract best bitstring ---
    best_bitstring = _extract_best_bitstring(raw_counts, Q, n)
    allocation = np.array([int(b) for b in best_bitstring], dtype=float)

    # Fallback: if all zeros (no stock selected), pick the one with best return
    if allocation.sum() == 0:
        allocation[np.argmax(mean_returns)] = 1.0

    return allocation, raw_counts


def _run_on_aer(ansatz, cost_op, num_params, backend, shots):
    """Run QAOA on AerSimulator using StatevectorSampler with COBYLA optimization."""
    from qiskit.primitives import StatevectorSampler
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

    pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
    isa_circuit = pm.run(ansatz)

    sampler = StatevectorSampler()

    def cost_func(params):
        pub = (isa_circuit, params)
        result = sampler.run([pub], shots=shots).result()
        counts = result[0].data.meas.get_counts()
        return _compute_expectation(counts, cost_op)

    x0 = np.random.uniform(-np.pi, np.pi, num_params)
    from scipy.optimize import minimize as sp_min
    res = sp_min(cost_func, x0, method="COBYLA", options={"maxiter": 200, "rhobeg": 0.5})

    # Final sample with optimal params
    pub = (isa_circuit, res.x)
    result = sampler.run([pub], shots=shots).result()
    raw_counts = result[0].data.meas.get_counts()

    return raw_counts, res.x


def _run_on_ibm(ansatz, cost_op, num_params, backend, shots):
    """Run QAOA on real IBM hardware via SamplerV2."""
    from qiskit_ibm_runtime import SamplerV2 as Sampler, Session
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

    pm = generate_preset_pass_manager(optimization_level=3, backend=backend)
    isa_circuit = pm.run(ansatz)

    with Session(backend=backend) as session:
        sampler = Sampler(session=session)

        def cost_func(params):
            pub = (isa_circuit, params)
            result = sampler.run([pub], shots=shots).result()
            counts = result[0].data.meas.get_counts()
            return _compute_expectation(counts, cost_op)

        x0 = np.random.uniform(-np.pi, np.pi, num_params)
        from scipy.optimize import minimize as sp_min
        res = sp_min(cost_func, x0, method="COBYLA", options={"maxiter": 100, "rhobeg": 0.5})

        # Final sample
        pub = (isa_circuit, res.x)
        result = sampler.run([pub], shots=shots).result()
        raw_counts = result[0].data.meas.get_counts()

    return raw_counts, res.x


def _compute_expectation(counts: dict, cost_op) -> float:
    """Estimate <cost_op> from measurement counts."""
    total_shots = sum(counts.values())
    expectation = 0.0

    for bitstring, count in counts.items():
        # bitstring is little-endian from Qiskit
        bits = np.array([int(b) for b in reversed(bitstring)], dtype=float)
        z = 1 - 2 * bits  # {0,1} -> {+1,-1}

        # Evaluate Pauli string expectation
        ev = 0.0
        for pauli_term, coeff in zip(cost_op.paulis, cost_op.coeffs):
            term_val = float(np.real(coeff))
            for idx, p in enumerate(reversed(str(pauli_term))):
                if p == "Z":
                    if idx < len(z):
                        term_val *= z[idx]
                    else:
                        term_val = 0.0
                        break
                elif p != "I":
                    term_val = 0.0
                    break
            ev += term_val

        expectation += ev * count / total_shots

    return expectation


def _extract_best_bitstring(counts: dict, Q: np.ndarray, n: int) -> str:
    """Find the bitstring with the lowest QUBO objective value."""
    best = None
    best_val = np.inf

    for bitstring, count in counts.items():
        # Qiskit bitstrings are reversed
        bits = [int(b) for b in reversed(bitstring)]
        if len(bits) < n:
            bits.extend([0] * (n - len(bits)))
        bits = bits[:n]
        x = np.array(bits, dtype=float)
        val = float(x @ Q @ x)
        if val < best_val:
            best_val = val
            best = bitstring

    if best is None:
        return "0" * n

    # Return in natural (non-reversed) order, length n
    bits = [int(b) for b in reversed(best)]
    bits = (bits + [0] * n)[:n]
    return "".join(str(b) for b in bits)
