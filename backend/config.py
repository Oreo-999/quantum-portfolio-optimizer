"""
Quantum backend selector: IBM real hardware vs AerSimulator.

Decision logic
--------------
The backend choice depends on three factors:
  1. User preference (useSimulator toggle in the UI)
  2. Number of stocks in the portfolio
  3. Whether a valid IBM API key was provided

Routing rules (evaluated in order):
  1. use_simulator_fallback=True  → always AerSimulator (user chose simulator)
  2. stock_count > 5              → always AerSimulator
     Reason: IBM free tier hardware typically has 5–7 qubits.
     QAOA with p=2 layers needs roughly 2n qubits after transpilation.
     For n > 5, the circuit won't fit on free-tier hardware.
  3. ibm_api_key provided         → attempt IBM hardware connection
     - On success → return IBM backend (least-busy device with enough qubits)
     - On failure → fall back to AerSimulator with error reason shown in UI
  4. No API key                   → AerSimulator

BackendConfig
-------------
A simple dataclass that wraps the backend object and metadata.
The is_ibm_hardware flag controls which execution path is used in qaoa.py
(SamplerV2 + Session for IBM vs AerSimulator.run() for local).
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class BackendConfig:
    """Wraps the chosen quantum backend with metadata for the API response."""
    backend: object              # AerSimulator instance or IBM IBMBackend instance
    backend_name: str            # Human-readable name shown in the UI badge
    used_simulator_fallback: bool  # True if we ended up on AerSimulator for any reason
    fallback_reason: Optional[str] = None  # Explanation shown in the UI when falling back
    is_ibm_hardware: bool = False  # Determines execution path in run_qaoa()


def get_backend(
    ibm_api_key: str,
    stock_count: int,
    use_simulator_fallback: bool,
) -> BackendConfig:
    """
    Determine and return the appropriate quantum backend.

    This function is designed to never raise — it always returns a valid
    BackendConfig, falling back to AerSimulator if anything goes wrong.
    The UI shows the backend selection and any fallback reason via the badge.

    Args:
        ibm_api_key:            IBM Quantum API key (may be empty string)
        stock_count:            Number of stocks being optimized
        use_simulator_fallback: True if the user selected "Simulator" in the UI

    Returns:
        BackendConfig with the chosen backend and metadata
    """
    from qiskit_aer import AerSimulator

    # Initialize the local simulator — always available as a fallback
    aer = AerSimulator()

    # --- Rule 1: User explicitly chose simulator ---
    if use_simulator_fallback:
        return BackendConfig(
            backend=aer,
            backend_name="AerSimulator",
            used_simulator_fallback=True,
            fallback_reason="Simulator selected by user",
            is_ibm_hardware=False,
        )

    # --- Rule 2: Too many qubits for free IBM hardware ---
    # Free-tier IBM devices typically provide 5–7 qubits. QAOA circuits with
    # p=2 layers and n>5 stocks need more qubits than are available.
    if stock_count > 5:
        return BackendConfig(
            backend=aer,
            backend_name="AerSimulator",
            used_simulator_fallback=True,
            fallback_reason=f"Portfolio has {stock_count} stocks (>5); automatically using AerSimulator",
            is_ibm_hardware=False,
        )

    # --- Rule 3: Attempt real IBM Quantum hardware ---
    if ibm_api_key and ibm_api_key.strip():
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService

            # Authenticate with IBM Quantum Network
            service = QiskitRuntimeService(
                channel="ibm_quantum",
                token=ibm_api_key.strip(),
            )

            # Select the least-busy operational device with enough qubits.
            # We request 2x the stock count to account for QAOA's ancilla overhead
            # and the fact that transpilation adds swap gates that consume extra qubits.
            backend = service.least_busy(
                operational=True,
                simulator=False,
                min_num_qubits=stock_count * 2,
            )

            return BackendConfig(
                backend=backend,
                backend_name=backend.name,
                used_simulator_fallback=False,
                is_ibm_hardware=True,
            )

        except Exception as exc:
            # Connection failure, invalid key, no available devices, etc.
            # Never block the optimization — fall through to AerSimulator
            return BackendConfig(
                backend=aer,
                backend_name="AerSimulator",
                used_simulator_fallback=True,
                fallback_reason=f"IBM connection failed: {exc}",
                is_ibm_hardware=False,
            )

    # --- Rule 4: No API key provided ---
    return BackendConfig(
        backend=aer,
        backend_name="AerSimulator",
        used_simulator_fallback=True,
        fallback_reason="No IBM API key provided",
        is_ibm_hardware=False,
    )
