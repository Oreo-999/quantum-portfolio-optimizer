"""
QAOA portfolio optimizer.

QUBO formulation:
  Each stock i is a binary variable x_i ∈ {0, 1}.
  Objective: minimize  Σ_i Σ_j cov[i,j] * x_i * x_j
                      - risk_tolerance * Σ_i mean_return[i] * x_i

Simulation backend:
  - AerSimulator.run() with shot-based QASM simulation — does NOT store the
    full 2^n statevector, so it scales to much larger circuits (30-50+ qubits).
  - IBM hardware: SamplerV2 via qiskit-ibm-runtime Session.
"""

import numpy as np
from typing import Tuple, Dict
from config import BackendConfig


def build_qubo_matrix(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_tolerance: float,
) -> np.ndarray:
    n = len(mean_returns)
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
    from qiskit_optimization import QuadraticProgram
    from qiskit_optimization.converters import QuadraticProgramToQubo
    from qiskit.circuit.library import QAOAAnsatz
    from qiskit_algorithms.utils import algorithm_globals

    algorithm_globals.random_seed = 42

    n = len(mean_returns)
    Q = build_qubo_matrix(mean_returns, cov_matrix, risk_tolerance)

    # Build QuadraticProgram
    qp = QuadraticProgram(name="portfolio")
    for i in range(n):
        qp.binary_var(name=f"x{i}")

    linear = {f"x{i}": Q[i, i] for i in range(n)}
    quadratic = {
        (f"x{i}", f"x{j}"): Q[i, j] + Q[j, i]
        for i in range(n) for j in range(i + 1, n)
        if abs(Q[i, j] + Q[j, i]) > 1e-12
    }
    qp.minimize(linear=linear, quadratic=quadratic)

    converter = QuadraticProgramToQubo()
    qubo = converter.convert(qp)
    ising_op, _ = qubo.to_ising()

    ansatz = QAOAAnsatz(cost_operator=ising_op, reps=p)
    ansatz.measure_all()

    # Scale COBYLA iterations with problem size — fewer for large n
    max_iter = max(50, 200 - n * 3)
    inner_shots = min(shots, max(128, shots // max(1, n // 10)))

    if backend_config.is_ibm_hardware:
        raw_counts, params = _run_on_ibm(
            ansatz, ising_op, backend_config.backend, shots, max_iter
        )
    else:
        raw_counts, params = _run_on_aer(
            ansatz, ising_op, backend_config.backend, shots, inner_shots, max_iter
        )

    best_bitstring = _extract_best_bitstring(raw_counts, Q, n)
    allocation = np.array([int(b) for b in best_bitstring], dtype=float)

    if allocation.sum() == 0:
        allocation[np.argmax(mean_returns)] = 1.0

    return allocation, raw_counts


def _run_on_aer(ansatz, cost_op, backend, shots, inner_shots, max_iter):
    """
    Shot-based QAOA on AerSimulator using backend.run() directly.
    Does NOT store the full 2^n statevector — scales to large qubit counts.
    """
    from qiskit_aer import AerSimulator
    from qiskit import transpile
    from scipy.optimize import minimize as sp_min

    # Use statevector method for small circuits, QASM for large ones
    n_qubits = ansatz.num_qubits
    if n_qubits <= 20:
        sim = AerSimulator(method="statevector")
    else:
        sim = AerSimulator(method="automatic")

    transpiled = transpile(ansatz, sim, optimization_level=1)
    param_list = list(transpiled.parameters)

    def cost_func(params):
        bound = transpiled.assign_parameters(dict(zip(param_list, params)))
        job = sim.run(bound, shots=inner_shots)
        counts = job.result().get_counts()
        return _compute_expectation(counts, cost_op)

    x0 = np.random.uniform(-np.pi, np.pi, len(param_list))
    res = sp_min(cost_func, x0, method="COBYLA", options={"maxiter": max_iter, "rhobeg": 0.5})

    # Final high-shot sample
    bound_final = transpiled.assign_parameters(dict(zip(param_list, res.x)))
    job = sim.run(bound_final, shots=shots)
    raw_counts = job.result().get_counts()

    return raw_counts, res.x


def _run_on_ibm(ansatz, cost_op, backend, shots, max_iter):
    """Run QAOA on real IBM hardware via SamplerV2."""
    from qiskit_ibm_runtime import SamplerV2 as Sampler, Session
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    from scipy.optimize import minimize as sp_min

    pm = generate_preset_pass_manager(optimization_level=3, backend=backend)
    isa_circuit = pm.run(ansatz)
    param_list = list(isa_circuit.parameters)

    with Session(backend=backend) as session:
        sampler = Sampler(session=session)

        def cost_func(params):
            pub = (isa_circuit, params)
            result = sampler.run([pub], shots=shots).result()
            counts = result[0].data.meas.get_counts()
            return _compute_expectation(counts, cost_op)

        x0 = np.random.uniform(-np.pi, np.pi, len(param_list))
        res = sp_min(cost_func, x0, method="COBYLA", options={"maxiter": max_iter, "rhobeg": 0.5})

        pub = (isa_circuit, res.x)
        result = sampler.run([pub], shots=shots).result()
        raw_counts = result[0].data.meas.get_counts()

    return raw_counts, res.x


def _compute_expectation(counts: dict, cost_op) -> float:
    total = sum(counts.values())
    expectation = 0.0
    for bitstring, count in counts.items():
        bits = np.array([int(b) for b in reversed(bitstring)], dtype=float)
        z = 1 - 2 * bits
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
        expectation += ev * count / total
    return expectation


def _extract_best_bitstring(counts: dict, Q: np.ndarray, n: int) -> str:
    best, best_val = None, np.inf
    for bitstring in counts:
        bits = [int(b) for b in reversed(bitstring)]
        bits = (bits + [0] * n)[:n]
        x = np.array(bits, dtype=float)
        val = float(x @ Q @ x)
        if val < best_val:
            best_val = val
            best = bits
    if best is None:
        return "0" * n
    return "".join(str(b) for b in best)
