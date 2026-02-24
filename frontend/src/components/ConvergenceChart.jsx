import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-subtle mb-1">Iteration {label}</p>
      <p className="font-mono text-primary">Cost: {payload[0].value.toFixed(5)}</p>
    </div>
  );
};

export default function ConvergenceChart({ convergence }) {
  if (!convergence?.length) return null;

  const data = useMemo(() => {
    // Thin to max 80 points for performance
    const step = Math.max(1, Math.floor(convergence.length / 80));
    return convergence
      .filter((_, i) => i % step === 0 || i === convergence.length - 1)
      .map((cost, i) => ({ i: i * step + 1, cost: parseFloat(cost.toFixed(6)) }));
  }, [convergence]);

  const minCost = Math.min(...data.map((d) => d.cost));
  const finalCost = data[data.length - 1]?.cost;
  const improvement = data[0]?.cost && finalCost
    ? (((data[0].cost - finalCost) / Math.abs(data[0].cost)) * 100).toFixed(1)
    : null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-primary">QAOA Optimization Convergence</h3>
          <p className="text-[11px] text-subtle mt-0.5">
            COBYLA cost function · {convergence.length} iterations
            {improvement && ` · ${improvement}% improvement`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted">Final cost</p>
          <p className="text-xs font-mono text-primary">{finalCost?.toFixed(5)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e1e1e" />
          <XAxis
            dataKey="i"
            tick={{ fontSize: 10, fill: "#6b6b6b" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Iteration", position: "insideBottom", offset: -4, fontSize: 10, fill: "#6b6b6b" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b6b6b" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={minCost}
            stroke="#1e2535"
            strokeDasharray="4 2"
            label={{ value: "min", position: "right", fontSize: 9, fill: "#6b6b6b" }}
          />
          <Line
            type="monotone"
            dataKey="cost"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#3b82f6" }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted mt-2">
        Each point is one evaluation of the quantum circuit. The optimizer adjusts the circuit's γ and β angles to minimize the expected value of the Ising Hamiltonian.
      </p>
    </div>
  );
}
