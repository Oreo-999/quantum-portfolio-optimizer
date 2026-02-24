import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const QUANTUM_COLORS = ["#818cf8", "#a78bfa", "#c4b5fd", "#6366f1", "#7c3aed", "#4f46e5", "#38bdf8", "#818cf8", "#6d28d9", "#4338ca"];
const CLASSICAL_COLORS = ["#34d399", "#6ee7b7", "#10b981", "#059669", "#047857", "#065f46", "#4ade80", "#22c55e", "#16a34a", "#15803d"];

function pctToData(allocation) {
  return Object.entries(allocation)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-mono font-medium text-neutral-200">{name}</p>
      <p className="text-sm font-semibold text-neutral-50">{value}%</p>
    </div>
  );
};

function AllocationPie({ data, colors, label }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="label text-center mb-3">{label}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs font-mono text-neutral-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AllocationChart({ qaoa_allocation, classical_allocation }) {
  const qData = pctToData(qaoa_allocation);
  const cData = pctToData(classical_allocation);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Portfolio Allocation</h3>
      <div className="flex gap-6">
        <AllocationPie data={qData} colors={QUANTUM_COLORS} label="QAOA" />
        <div className="w-px bg-surface-border" />
        <AllocationPie data={cData} colors={CLASSICAL_COLORS} label="Classical" />
      </div>
    </div>
  );
}
