"""
Backend selector: IBM real hardware vs AerSimulator.

Rules:
  - use_simulator_fallback=True  → always use AerSimulator
  - stock_count <= 5 and valid IBM key → attempt real IBM hardware
  - stock_count >= 6               → use AerSimulator regardless
  - IBM connection failure          → fall back to AerSimulator, set fallback flag
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class BackendConfig:
    backend: object          # AerSimulator or IBMBackend instance
    backend_name: str
    used_simulator_fallback: bool
    fallback_reason: Optional[str] = None
    is_ibm_hardware: bool = False


def get_backend(
    ibm_api_key: str,
    stock_count: int,
    use_simulator_fallback: bool,
) -> BackendConfig:
    """
    Determine and return the appropriate quantum backend.
    Always returns a valid BackendConfig — never raises.
    """
    from qiskit_aer import AerSimulator

    aer = AerSimulator()

    # Explicit simulator override
    if use_simulator_fallback:
        return BackendConfig(
            backend=aer,
            backend_name="AerSimulator",
            used_simulator_fallback=True,
            fallback_reason="Simulator selected by user",
            is_ibm_hardware=False,
        )

    # Too many qubits for free IBM hardware tier — auto-switch
    if stock_count > 5:
        return BackendConfig(
            backend=aer,
            backend_name="AerSimulator",
            used_simulator_fallback=True,
            fallback_reason=f"Portfolio has {stock_count} stocks (>5); automatically using AerSimulator",
            is_ibm_hardware=False,
        )

    # Attempt IBM real hardware
    if ibm_api_key and ibm_api_key.strip():
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService

            service = QiskitRuntimeService(
                channel="ibm_quantum",
                token=ibm_api_key.strip(),
            )
            # Pick the least-busy backend with enough qubits
            backend = service.least_busy(
                operational=True,
                simulator=False,
                min_num_qubits=stock_count * 2,  # QAOA needs headroom
            )
            return BackendConfig(
                backend=backend,
                backend_name=backend.name,
                used_simulator_fallback=False,
                is_ibm_hardware=True,
            )
        except Exception as exc:
            return BackendConfig(
                backend=aer,
                backend_name="AerSimulator",
                used_simulator_fallback=True,
                fallback_reason=f"IBM connection failed: {exc}",
                is_ibm_hardware=False,
            )

    # No API key provided — use simulator
    return BackendConfig(
        backend=aer,
        backend_name="AerSimulator",
        used_simulator_fallback=True,
        fallback_reason="No IBM API key provided",
        is_ibm_hardware=False,
    )
