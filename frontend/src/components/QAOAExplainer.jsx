import React, { useState } from "react";

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/2 transition-colors"
      >
        <span className="text-sm font-medium text-primary">{title}</span>
        <svg
          className={`w-4 h-4 text-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function Math({ children }) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3 my-3 font-mono text-sm text-secondary leading-relaxed overflow-x-auto">
      {children}
    </div>
  );
}

function Code({ children }) {
  return (
    <code className="font-mono text-xs bg-surface border border-border rounded px-1.5 py-0.5 text-secondary">
      {children}
    </code>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4 mt-5 first:mt-4">
      <div className="shrink-0 w-6 h-6 rounded-full border border-blue-border bg-blue-dim flex items-center justify-center text-[11px] font-medium text-qaoa mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-sm font-medium text-primary mb-1">{title}</p>
        <div className="text-sm text-secondary leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span className="inline-block text-[10px] font-medium font-mono border border-border text-subtle rounded px-1.5 py-0.5 mx-0.5">
      {children}
    </span>
  );
}

export default function QAOAExplainer() {
  return (
    <div className="max-w-3xl mx-auto space-y-3 animate-fade-in">

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          How QAOA Works
        </h1>
        <p className="mt-2 text-sm text-subtle leading-relaxed max-w-xl">
          A deep dive into the Quantum Approximate Optimization Algorithm —
          from portfolio math to quantum circuits to measurement.
        </p>
      </div>

      {/* 1 */}
      <Section title="1 — The Portfolio Problem" defaultOpen>
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            Portfolio optimization asks: given <em>N</em> stocks, how should we allocate our capital to maximize return while minimizing risk?
          </p>
          <p>
            Classical Markowitz theory solves this with <strong className="text-primary">continuous weights</strong> — each stock gets some fraction of the portfolio. This is a convex quadratic program that scipy can solve exactly.
          </p>
          <p>
            QAOA instead treats this as a <strong className="text-primary">combinatorial selection problem</strong>: which subset of stocks should we include? Each stock is either in (1) or out (0). This is a fundamentally harder problem — with <em>N</em> stocks there are 2ᴺ possible subsets — but it maps naturally onto qubits.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="text-[11px] text-subtle mb-1 uppercase tracking-wider">Classical</p>
              <p className="text-xs text-secondary">Continuous weights wᵢ ∈ [0,1], Σwᵢ = 1</p>
              <p className="text-xs text-secondary mt-1">Convex QP, polynomial time, exact</p>
            </div>
            <div className="bg-blue-dim border border-blue-border rounded-lg p-3">
              <p className="text-[11px] text-qaoa mb-1 uppercase tracking-wider">QAOA</p>
              <p className="text-xs text-secondary">Binary variables xᵢ ∈ {"{0,1}"}</p>
              <p className="text-xs text-secondary mt-1">Combinatorial, 2ᴺ search space, NP-hard</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 2 */}
      <Section title="2 — QUBO: Encoding the Objective">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            We encode the portfolio problem as a <strong className="text-primary">QUBO</strong> (Quadratic Unconstrained Binary Optimization). The objective to minimize is:
          </p>
          <Math>
            {`minimize:  Σᵢ Σⱼ σᵢⱼ · xᵢ · xⱼ  −  λ · Σᵢ μᵢ · xᵢ

where:
  xᵢ       ∈ {0, 1}     — include stock i?
  σᵢⱼ      — covariance between stocks i and j
  μᵢ       — annualized expected return of stock i
  λ        — risk tolerance (0 = min risk, 1 = max return)`}
          </Math>
          <p>
            The first term penalizes correlated, high-variance portfolios. The second term rewards high expected return, scaled by λ. The diagonal terms <Code>σᵢᵢ</Code> are each stock's own variance.
          </p>
          <p>
            This can be written compactly as <strong className="text-primary">x<sup>T</sup>Qx</strong> where Q is an N×N matrix — the QUBO matrix. Finding the binary vector x that minimizes this is exactly our optimization problem.
          </p>
          <p className="text-xs text-muted border-l border-border pl-3">
            In code: <Code>build_qubo_matrix()</Code> in <Code>algorithms/qaoa.py</Code> constructs Q by normalizing σ and μ to prevent numerical instability.
          </p>
        </div>
      </Section>

      {/* 3 */}
      <Section title="3 — Mapping to Qubits: The Ising Hamiltonian">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            Quantum computers don't speak QUBO — they speak <strong className="text-primary">Hamiltonians</strong>. We convert by mapping binary variables to quantum spins:
          </p>
          <Math>
            {`xᵢ  →  (1 − Zᵢ) / 2

where Zᵢ is the Pauli-Z operator on qubit i.

Eigenvalues: |0⟩  →  Zᵢ = +1  →  xᵢ = 0  (stock excluded)
             |1⟩  →  Zᵢ = −1  →  xᵢ = 1  (stock included)`}
          </Math>
          <p>
            Substituting into the QUBO gives the <strong className="text-primary">Ising cost Hamiltonian</strong>:
          </p>
          <Math>
            {`H_C = Σᵢ hᵢ Zᵢ  +  Σᵢ﹤ⱼ Jᵢⱼ ZᵢZⱼ

hᵢ   — linear terms (from diagonal Q entries)
Jᵢⱼ  — coupling terms (from off-diagonal Q entries, i.e., covariance)`}
          </Math>
          <p>
            The <strong className="text-primary">ground state</strong> (lowest energy eigenstate) of H_C encodes the optimal portfolio. QAOA prepares a quantum state that has high overlap with this ground state.
          </p>
          <p className="text-xs text-muted border-l border-border pl-3">
            <Code>qiskit-optimization</Code> handles this conversion automatically via <Code>QuadraticProgramToQubo</Code> and <Code>.to_ising()</Code>.
          </p>
        </div>
      </Section>

      {/* 4 */}
      <Section title="4 — The QAOA Circuit: p Layers of Cost + Mixer">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            QAOA prepares a parameterized quantum state |ψ(γ,β)⟩ using alternating layers of two operations:
          </p>

          <Step n="1" title="Initialize: uniform superposition">
            <p>Apply a Hadamard gate H to every qubit, creating an equal superposition of all 2ᴺ possible portfolios simultaneously:</p>
            <Math>{`|ψ₀⟩  =  H⊗ᴺ |0⟩  =  (1/√2ᴺ) Σₓ |x⟩`}</Math>
          </Step>

          <Step n="2" title="Cost layer U(H_C, γ)">
            <p>Apply the cost Hamiltonian for angle γ. This phase-encodes the objective — good portfolios accumulate phase, bad ones don't:</p>
            <Math>{`U(H_C, γ)  =  e^{−iγH_C}  =  Π_{(i,j)} e^{−iγJᵢⱼ ZᵢZⱼ} · Π_i e^{−iγhᵢZᵢ}`}</Math>
            <p>Implemented with <strong className="text-primary">ZZ-rotation gates</strong> (for coupling terms) and <strong className="text-primary">Rz gates</strong> (for linear terms).</p>
          </Step>

          <Step n="3" title="Mixer layer U(H_B, β)">
            <p>Apply the mixing Hamiltonian H_B = Σᵢ Xᵢ for angle β. This applies X-rotations to each qubit, allowing <strong className="text-primary">quantum tunneling</strong> between different portfolio selections:</p>
            <Math>{`U(H_B, β)  =  e^{−iβH_B}  =  Π_i e^{−iβXᵢ}  =  Π_i Rx(2β)`}</Math>
          </Step>

          <Step n="4" title="Repeat p times">
            <p>Steps 2–3 are applied <strong className="text-primary">p = 2 times</strong> in this implementation, with independent parameters (γ₁, β₁, γ₂, β₂). More layers → better approximation, deeper circuit.</p>
            <Math>{`|ψ(γ,β)⟩  =  U(H_B,βₚ) U(H_C,γₚ) ··· U(H_B,β₁) U(H_C,γ₁) |ψ₀⟩`}</Math>
          </Step>

          {/* Circuit diagram */}
          <div className="bg-surface border border-border rounded-lg p-4 mt-3 overflow-x-auto">
            <pre className="font-mono text-[11px] text-secondary leading-relaxed">{`
q₀: ─H──ZZ─Rz──Rx──ZZ─Rz──Rx──M─
         │           │
q₁: ─H──ZZ─Rz──Rx──ZZ─Rz──Rx──M─
         │           │
q₂: ─H──ZZ─Rz──Rx──ZZ─Rz──Rx──M─
         │           │
q₃: ─H──ZZ─Rz──Rx──ZZ─Rz──Rx──M─
              γ₁  β₁     γ₂  β₂
         └──── layer 1 ────┘└── layer 2 ──┘`}</pre>
          </div>

          <p className="text-xs text-muted">
            The circuit has <strong>2p = 4 parameters</strong> for p=2. Circuit depth scales as O(p·N²) due to the all-to-all ZZ couplings from the covariance matrix.
          </p>
        </div>
      </Section>

      {/* 5 */}
      <Section title="5 — Variational Optimization: COBYLA Drives the Quantum Loop">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            QAOA is a <strong className="text-primary">variational algorithm</strong>. The quantum circuit is parameterized; a classical optimizer finds the best parameters by minimizing the expected cost:
          </p>
          <Math>
            {`objective:  minimize  ⟨ψ(γ,β)| H_C |ψ(γ,β)⟩

This is estimated by sampling the circuit repeatedly (shots) and
computing the empirical average of the Hamiltonian on each bitstring.`}
          </Math>

          {/* Loop diagram */}
          <div className="bg-surface border border-border rounded-lg p-4 my-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <div className="text-center space-y-1">
                <div className="border border-border rounded px-2 py-1.5 text-secondary">COBYLA</div>
                <div className="text-muted">classical optimizer</div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 px-3">
                <div className="flex items-center gap-2 w-full">
                  <div className="flex-1 h-px bg-border-soft" />
                  <span className="text-muted text-[10px]">params γ,β →</span>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <span className="text-muted text-[10px]">← ⟨H_C⟩ cost</span>
                  <div className="flex-1 h-px bg-border-soft" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <div className="border border-blue-border bg-blue-dim rounded px-2 py-1.5 text-qaoa">Circuit + Sampler</div>
                <div className="text-muted">quantum computer</div>
              </div>
            </div>
          </div>

          <p>
            <strong className="text-primary">COBYLA</strong> (Constrained Optimization BY Linear Approximation) is chosen because it is <em>derivative-free</em> — ideal for quantum circuits where gradients are expensive to compute. It only needs function evaluations, not gradients.
          </p>
          <p>
            Each iteration: COBYLA proposes new (γ,β) → the circuit runs for <Code>inner_shots</Code> → measurement counts estimate ⟨H_C⟩ → COBYLA updates. The convergence chart shows this cost decreasing iteration by iteration.
          </p>
          <p className="text-xs text-muted border-l border-border pl-3">
            After convergence, a final <Code>1024-shot</Code> sample is taken with the optimal parameters. Each shot collapses the superposition to a single bitstring — one candidate portfolio.
          </p>
        </div>
      </Section>

      {/* 6 */}
      <Section title="6 — Measurement: Reading Out the Portfolio">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            Measuring the final state collapses it to a classical bitstring. With 1024 shots, we get a <strong className="text-primary">probability distribution over portfolios</strong>:
          </p>
          <Math>
            {`Example (4 stocks — AAPL, MSFT, NVDA, GOOGL):

Bitstring  |  Count  |  Portfolio
─────────────────────────────────────────────────
  1010     |   412   |  AAPL + NVDA selected
  1110     |   287   |  AAPL + MSFT + NVDA
  0110     |   143   |  MSFT + NVDA
  1011     |    98   |  AAPL + NVDA + GOOGL
  ...      |   ...   |  ...`}
          </Math>
          <p>
            We don't just take the most frequent bitstring — we evaluate all observed bitstrings against the QUBO objective and pick the one with the <strong className="text-primary">lowest objective value</strong>. This is more robust than majority vote.
          </p>
          <p>
            The selected stocks are assigned <strong className="text-primary">equal weight</strong> in the final portfolio. The measurement counts are shown in the "Measurement Counts" panel below the results.
          </p>
        </div>
      </Section>

      {/* 7 */}
      <Section title="7 — Why Quantum? The Computational Advantage">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            QAOA provides two mechanisms that classical algorithms lack:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-primary mb-2">Quantum Superposition</p>
              <p className="text-xs text-secondary leading-relaxed">
                The initial Hadamard layer places the circuit in a superposition of all 2ᴺ portfolios simultaneously. The cost layer applies phase to all of them in a single circuit execution — a form of quantum parallelism.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-primary mb-2">Quantum Tunneling</p>
              <p className="text-xs text-secondary leading-relaxed">
                The mixer layer enables tunneling through energy barriers in the optimization landscape. Classical local search gets stuck in local minima; quantum tunneling can escape them, potentially finding better solutions.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4 mt-2">
            <p className="text-xs font-medium text-primary mb-2">Computational complexity</p>
            <div className="space-y-1.5 text-xs text-secondary">
              <div className="flex justify-between">
                <span>Brute-force enumeration</span>
                <Tag>O(2ᴺ)</Tag>
              </div>
              <div className="flex justify-between">
                <span>Classical heuristics (SA, GA)</span>
                <Tag>O(poly(N)) approx</Tag>
              </div>
              <div className="flex justify-between">
                <span>QAOA (p layers)</span>
                <Tag>O(p · N² · shots)</Tag>
              </div>
            </div>
          </div>

          <p>
            For N=50 stocks, brute-force requires evaluating ~10¹⁵ portfolios. QAOA explores this space via quantum interference — amplifying high-quality solutions and suppressing poor ones — in polynomial circuit operations.
          </p>
          <p className="text-xs text-muted border-l border-border pl-3">
            <strong className="text-secondary">Honest caveat:</strong> QAOA's practical quantum advantage over classical heuristics is still an active research question. Current hardware (NISQ era) has noise that limits circuit depth. This implementation is most useful as a demonstration and starting point — real advantage is expected with fault-tolerant quantum computers.
          </p>
        </div>
      </Section>

      {/* 8 */}
      <Section title="8 — Implementation Details">
        <div className="pt-4 space-y-3 text-sm text-secondary leading-relaxed">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
            {[
              ["Framework", "Qiskit 1.1 + qiskit-optimization"],
              ["Circuit builder", "QAOAAnsatz"],
              ["QUBO converter", "QuadraticProgramToQubo"],
              ["Ising mapper", "qubo.to_ising()"],
              ["Simulator", "AerSimulator (QASM / statevector)"],
              ["IBM hardware", "SamplerV2 via qiskit-ibm-runtime"],
              ["Classical optimizer", "COBYLA (scipy)"],
              ["Layers (p)", "2"],
              ["Final shots", "1024"],
              ["Inner shots", "Adaptive (128–1024)"],
              ["Max COBYLA iterations", "Adaptive (50–200)"],
              ["Hardware qubit limit", "≤5 stocks"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border py-1.5">
                <span className="text-subtle">{k}</span>
                <span className="font-mono text-secondary text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Footer note */}
      <p className="text-[11px] text-muted text-center pt-2 pb-8">
        This implementation is for educational and research purposes. Not financial advice.
      </p>
    </div>
  );
}
