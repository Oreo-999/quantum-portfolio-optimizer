"""
QAOA portfolio optimizer with convergence tracking.

Overview
--------
The Quantum Approximate Optimization Algorithm (QAOA) treats portfolio selection
as a combinatorial optimization problem. Each stock is a binary variable:
  x_i = 1 → include in portfolio
  x_i = 0 → exclude

The goal is to find the bitstring x* that minimizes the QUBO objective:
  minimize  x^T Q x
where Q encodes both covariance risk (upper triangle) and expected return (diagonal).

Pipeline
--------
1. build_qubo_matrix()   — construct the Q matrix from financial data
2. run_qaoa()            — encode Q as an Ising Hamiltonian, build the QAOA circuit,
                           then use COBYLA to classically optimize the circuit angles (γ, β)
3. _run_on_aer()         — shot-based simulation using Qiskit Aer (scales to 50+ qubits)
4. _run_on_ibm()         — same loop but via IBM's SamplerV2 in a Runtime Session
5. _compute_expectation()— evaluate <H> from measurement counts (no full statevector needed)
6. _extract_best_bitstring() — pick the lowest-energy bitstring from the final distribution

Returns (allocation, raw_counts, convergence) where convergence is the list of
COBYLA cost-function values per iteration — used to draw the optimization curve.
"""

import numpy as np
from typing import Tuple, Dict, List
from config import BackendConfig


# ---------------------------------------------------------------------------
# QUBO construction
# ---------------------------------------------------------------------------

def build_qubo_matrix(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_tolerance: float,
    min_stocks: int = None,
    max_stocks: int = None,
) -> np.ndarray:
    """
    Build the QUBO matrix Q such that x^T Q x is the objective to minimize.

    The two competing terms:
      - Covariance (risk):  Q[i,j] = cov[i,j] / cov_scale  (we want this SMALL)
      - Return:             Q[i,i] -= λ * return[i] / ret_scale  (we want this LARGE)

    Both terms are normalized to [0,1] so the risk_tolerance λ ∈ [0,1] has
    intuitive meaning: 0 = pure risk minimization, 1 = pure return maximization.

    Cardinality constraint (optional):
      When min_stocks/max_stocks are set, a soft penalty is added:
        A · (Σxᵢ - K)²   where K = midpoint of [min_stocks, max_stocks]
      Expanded over binary variables (xᵢ² = xᵢ):
        = A · (1 - 2K) · Σxᵢ  +  2A · Σᵢ﹤ⱼ xᵢxⱼ  +  const
      In QUBO matrix form:
        Q[i,i] += A · (1 - 2K)   for all i      (diagonal)
        Q[i,j] += A               for all i ≠ j  (off-diagonal, symmetric)
      The penalty strength A is set to the scale of the financial objective so
      the cardinality signal is competitive but not overwhelming.

    Args:
        mean_returns:    Annualized expected return per stock (shape: n,)
        cov_matrix:      Annualized covariance matrix (shape: n x n)
        risk_tolerance:  λ ∈ [0,1] — blends risk vs return
        min_stocks:      Minimum number of stocks to select (optional)
        max_stocks:      Maximum number of stocks to select (optional)
    Returns:
        Q: (n x n) QUBO matrix
    """
    n = len(mean_returns)

    # Normalization constants prevent one term from dominating
    ret_scale = np.max(np.abs(mean_returns)) if np.max(np.abs(mean_returns)) > 0 else 1.0
    cov_scale = np.max(np.abs(cov_matrix)) if np.max(np.abs(cov_matrix)) > 0 else 1.0

    Q = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            # Off-diagonal: pairwise covariance (captures correlation risk)
            Q[i, j] = cov_matrix[i, j] / cov_scale
        # Diagonal: subtract the return contribution (negating = maximizing)
        Q[i, i] -= risk_tolerance * mean_returns[i] / ret_scale

    # --- Cardinality penalty: A · (Σxᵢ - K)² ---
    if min_stocks is not None or max_stocks is not None:
        lo = max(1, min_stocks if min_stocks is not None else 1)
        hi = min(n, max_stocks if max_stocks is not None else n)
        K = (lo + hi) / 2.0   # target midpoint of the allowed range

        # Penalty strength ≈ scale of the financial objective so neither dominates
        A = max(float(np.max(np.abs(Q))), 1e-6)

        for i in range(n):
            Q[i, i] += A * (1.0 - 2.0 * K)   # diagonal: encourages selecting ~K stocks
            for j in range(n):
                if i != j:
                    Q[i, j] += A               # off-diagonal: penalizes excess selections

    return Q


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_qaoa(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_tolerance: float,
    backend_config: BackendConfig,
    p: int = 2,
    shots: int = 1024,
    min_stocks: int = None,
    max_stocks: int = None,
) -> Tuple[np.ndarray, Dict[str, int], List[float]]:
    """
    Run the full QAOA optimization loop.

    QAOA structure:
      - p layers, each containing a "cost" unitary U_C(γ) and "mixer" unitary U_B(β)
      - U_C encodes the Ising Hamiltonian (derived from QUBO via qubo.to_ising())
      - U_B is a global X-rotation (standard transverse-field mixer)
      - 2p free parameters (γ₁…γ_p, β₁…β ̃p) are optimized by COBYLA

    The circuit is initialized in the uniform superposition |+⟩^n so all 2^n
    bitstrings are initially equally likely. After optimization the distribution
    concentrates around low-energy (good portfolio) states.

    Args:
        mean_returns:    Annualized expected returns (shape: n,)
        cov_matrix:      Annualized covariance matrix (shape: n x n)
        risk_tolerance:  λ ∈ [0,1]
        backend_config:  Wraps either AerSimulator or IBM hardware
        p:               Number of QAOA layers (circuit depth). Higher = better quality, slower.
        shots:           Number of measurements for the final circuit evaluation.

    Returns:
        allocation:   Binary array — 1 = include stock, 0 = exclude
        raw_counts:   Dict mapping measured bitstrings to their frequency counts
        convergence:  Cost value at every COBYLA iteration (for plotting)
    """
    from qiskit_optimization import QuadraticProgram
    from qiskit_optimization.converters import QuadraticProgramToQubo
    from qiskit.circuit.library import QAOAAnsatz
    from qiskit_algorithms.utils import algorithm_globals

    # Fix the RNG so results are reproducible across runs
    algorithm_globals.random_seed = 42

    n = len(mean_returns)

    # --- Step 1: Build QUBO matrix ---
    Q = build_qubo_matrix(mean_returns, cov_matrix, risk_tolerance, min_stocks, max_stocks)

    # --- Step 2: Encode the QUBO as a Qiskit QuadraticProgram ---
    # Each binary variable x_i represents "include stock i"
    qp = QuadraticProgram(name="portfolio")
    for i in range(n):
        qp.binary_var(name=f"x{i}")

    # Diagonal terms → linear coefficients in the objective
    linear = {f"x{i}": Q[i, i] for i in range(n)}

    # Upper-triangle terms → quadratic coefficients (Q is symmetric, so Q[i,j]+Q[j,i] = 2*Q[i,j])
    quadratic = {
        (f"x{i}", f"x{j}"): Q[i, j] + Q[j, i]
        for i in range(n) for j in range(i + 1, n)
        if abs(Q[i, j] + Q[j, i]) > 1e-12   # skip near-zero terms
    }
    qp.minimize(linear=linear, quadratic=quadratic)

    # --- Step 3: Convert QUBO → Ising Hamiltonian ---
    # QUBO variables x_i ∈ {0,1} are mapped to Pauli-Z eigenvalues z_i ∈ {-1,+1}
    # via x_i = (1 - z_i) / 2. This turns the QUBO into a sum of ZZ and Z Pauli terms.
    converter = QuadraticProgramToQubo()
    qubo = converter.convert(qp)
    ising_op, _ = qubo.to_ising()  # SparsePauliOp representing the cost Hamiltonian

    # --- Step 4: Build the QAOA circuit ansatz ---
    # QAOAAnsatz automatically constructs the cost + mixer unitaries for p layers
    ansatz = QAOAAnsatz(cost_operator=ising_op, reps=p)
    ansatz.measure_all()  # add measurement to all qubits

    # Adaptive iteration budget: fewer iterations for larger circuits (they're more expensive)
    max_iter = max(50, 200 - n * 3)

    # Use fewer shots per COBYLA evaluation to keep the optimization loop fast,
    # then do a final high-shot sample at the optimal parameters
    inner_shots = min(shots, max(128, shots // max(1, n // 10)))

    # --- Step 5: Run the variational optimization ---
    if backend_config.is_ibm_hardware:
        # Real quantum hardware: transpile to ISA and use SamplerV2 in a Runtime Session
        raw_counts, _, convergence = _run_on_ibm(
            ansatz, ising_op, backend_config.backend, shots, max_iter
        )
    else:
        # Local simulation: AerSimulator with shot-based QASM (scales to large n)
        raw_counts, _, convergence = _run_on_aer(
            ansatz, ising_op, backend_config.backend, shots, inner_shots, max_iter
        )

    # --- Step 6: Extract the best portfolio from the measurement distribution ---
    best_bitstring = _extract_best_bitstring(raw_counts, Q, n)
    allocation = np.array([int(b) for b in best_bitstring], dtype=float)

    # Safety fallback: if every stock was excluded, invest everything in the
    # highest-return stock (this can happen when QAOA gets stuck)
    if allocation.sum() == 0:
        allocation[np.argmax(mean_returns)] = 1.0

    return allocation, raw_counts, convergence


# ---------------------------------------------------------------------------
# Simulator backend (Qiskit Aer)
# ---------------------------------------------------------------------------

def _run_on_aer(ansatz, cost_op, backend, shots, inner_shots, max_iter):
    """
    Run the COBYLA optimization loop locally using AerSimulator.

    Each call to cost_func():
      1. Binds the current COBYLA parameters (γ, β angles) into the circuit
      2. Runs the circuit for `inner_shots` measurements
      3. Computes the expectation value <H> = Σ_bitstring P(bitstring) * E(bitstring)
      4. Records the cost for the convergence chart

    After COBYLA converges, runs one final high-shot sample at the optimal angles
    to get a statistically clean measurement distribution.
    """
    from qiskit_aer import AerSimulator
    from qiskit import transpile
    from scipy.optimize import minimize as sp_min

    n_qubits = ansatz.num_qubits

    # Use statevector simulation for small circuits (exact, fast for n≤20),
    # fall back to automatic method (QASM) for larger circuits
    sim = AerSimulator(method="statevector" if n_qubits <= 20 else "automatic")

    # Transpile once before the optimization loop (avoids per-iteration overhead)
    transpiled = transpile(ansatz, sim, optimization_level=1)
    param_list = list(transpiled.parameters)

    # Closure list: COBYLA appends to this at every function evaluation
    convergence: List[float] = []

    def cost_func(params):
        # Bind current γ/β values into the parameterized circuit
        bound = transpiled.assign_parameters(dict(zip(param_list, params)))
        job = sim.run(bound, shots=inner_shots)
        counts = job.result().get_counts()
        # Compute <H> as a weighted sum over measurement outcomes
        cost = _compute_expectation(counts, cost_op)
        convergence.append(float(cost))
        return cost

    # Random initialization: uniform in [-π, π] for all 2p parameters
    x0 = np.random.uniform(-np.pi, np.pi, len(param_list))

    # COBYLA: derivative-free optimizer, well-suited for noisy quantum cost functions
    # rhobeg = initial trust-region radius (step size)
    res = sp_min(cost_func, x0, method="COBYLA", options={"maxiter": max_iter, "rhobeg": 0.5})

    # Final evaluation at optimal parameters with full shot budget for clean statistics
    bound_final = transpiled.assign_parameters(dict(zip(param_list, res.x)))
    job = sim.run(bound_final, shots=shots)
    raw_counts = job.result().get_counts()

    return raw_counts, res.x, convergence


# ---------------------------------------------------------------------------
# IBM Quantum hardware backend
# ---------------------------------------------------------------------------

def _run_on_ibm(ansatz, cost_op, backend, shots, max_iter):
    """
    Run the COBYLA optimization loop on real IBM Quantum hardware.

    Uses Qiskit IBM Runtime's SamplerV2 primitive inside a Session.
    A Session keeps a dedicated connection to the hardware during the entire
    optimization loop, so there's no repeated queue wait between COBYLA steps.

    The circuit is first compiled with optimization_level=3 (full transpilation
    with routing and scheduling for the specific device topology).
    """
    from qiskit_ibm_runtime import SamplerV2 as Sampler, Session
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    from scipy.optimize import minimize as sp_min

    # Compile to ISA (Instruction Set Architecture) — device-native gate set + qubit mapping
    pm = generate_preset_pass_manager(optimization_level=3, backend=backend)
    isa_circuit = pm.run(ansatz)
    param_list = list(isa_circuit.parameters)

    convergence: List[float] = []

    with Session(backend=backend) as session:
        sampler = Sampler(session=session)

        def cost_func(params):
            # PUB = (circuit, parameter_values) — the IBM Runtime job format
            pub = (isa_circuit, params)
            result = sampler.run([pub], shots=shots).result()
            # Extract counts from the classical register "meas"
            counts = result[0].data.meas.get_counts()
            cost = _compute_expectation(counts, cost_op)
            convergence.append(float(cost))
            return cost

        x0 = np.random.uniform(-np.pi, np.pi, len(param_list))
        res = sp_min(cost_func, x0, method="COBYLA", options={"maxiter": max_iter, "rhobeg": 0.5})

        # Final sample at optimal parameters
        pub = (isa_circuit, res.x)
        result = sampler.run([pub], shots=shots).result()
        raw_counts = result[0].data.meas.get_counts()

    return raw_counts, res.x, convergence


# ---------------------------------------------------------------------------
# Expectation value computation
# ---------------------------------------------------------------------------

def _compute_expectation(counts: dict, cost_op) -> float:
    """
    Compute <H> = Σ_x P(x) * H(x) from measurement counts.

    Instead of building the full 2^n Hamiltonian matrix, we evaluate each
    measured bitstring directly against the Pauli terms:
      - Z term on qubit k: contributes z_k = (-1)^bit_k to the energy
      - I term on qubit k: contributes 1 (identity, no effect)
      - X or Y terms: ignored (the Ising Hamiltonian only has Z and ZZ terms)

    This is the shot-based estimator — cheaper than exact statevector but
    introduces statistical noise proportional to 1/√shots.

    Args:
        counts:    Dict {bitstring: count} from circuit measurement
        cost_op:   SparsePauliOp representing the Ising Hamiltonian
    Returns:
        Estimated expectation value <H>
    """
    total = sum(counts.values())
    expectation = 0.0

    for bitstring, count in counts.items():
        # Qiskit bit ordering: rightmost char = qubit 0, so reverse the string
        bits = np.array([int(b) for b in reversed(bitstring)], dtype=float)

        # Convert from {0,1} to {+1,-1} eigenvalues of the Z operator
        z = 1 - 2 * bits   # 0 → +1 (|0⟩ eigenstate), 1 → -1 (|1⟩ eigenstate)

        ev = 0.0  # energy of this bitstring
        for pauli_term, coeff in zip(cost_op.paulis, cost_op.coeffs):
            term_val = float(np.real(coeff))
            # Walk through each qubit in the Pauli string
            for idx, p in enumerate(reversed(str(pauli_term))):
                if p == "Z":
                    # ZZ...Z term: multiply by the z eigenvalue of this qubit
                    if idx < len(z):
                        term_val *= z[idx]
                    else:
                        term_val = 0.0
                        break
                elif p != "I":
                    # X or Y terms shouldn't appear in an Ising Hamiltonian;
                    # set to 0 if they do (guards against unexpected operators)
                    term_val = 0.0
                    break
            ev += term_val

        # Weight this bitstring's energy by its probability
        expectation += ev * count / total

    return expectation


# ---------------------------------------------------------------------------
# Best solution extraction
# ---------------------------------------------------------------------------

def _extract_best_bitstring(counts: dict, Q: np.ndarray, n: int) -> str:
    """
    From the final measurement distribution, pick the bitstring with the
    lowest QUBO objective value x^T Q x.

    We re-evaluate every observed bitstring classically rather than taking
    the most frequent one, because the highest-probability state isn't always
    the lowest-energy one (especially at low shot counts).

    Args:
        counts:  Measurement counts from the final circuit run
        Q:       QUBO matrix
        n:       Number of stocks (expected bitstring length)
    Returns:
        Best bitstring as a string of '0'/'1' characters (length n)
    """
    best, best_val = None, np.inf

    for bitstring in counts:
        # Parse and pad/truncate to exactly n bits
        bits = [int(b) for b in reversed(bitstring)]
        bits = (bits + [0] * n)[:n]
        x = np.array(bits, dtype=float)

        # Evaluate the QUBO objective for this allocation
        val = float(x @ Q @ x)

        if val < best_val:
            best_val = val
            best = bits

    # Fallback: all-zero if counts dict is somehow empty
    if best is None:
        return "0" * n

    return "".join(str(b) for b in best)
