import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const QAOA_COLORS = ["#60a5fa", "#93c5fd", "#3b82f6", "#1d4ed8", "#2563eb", "#1e40af", "#dbeafe", "#bfdbfe"];
const CLASS_COLORS = ["#737373", "#a3a3a3", "#525252", "#404040", "#d4d4d4", "#e5e5e5", "#262626", "#171717"];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-mono font-medium text-primary">{payload[0].name}</p>
      <p className="text-secondary mt-0.5">{payload[0].value}%</p>
    </div>
  );
};

function Pie2({ data, colors, label }) {
  const noAlloc = data.every((d) => d.value === 0);

  return (
    <div className="flex-1 min-w-0">
      <p className="label text-center mb-2">{label}</p>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={noAlloc ? [{ name: "None", value: 1 }] : data}
            cx="50%" cy="50%"
            innerRadius={44} outerRadius={74}
            paddingAngle={noAlloc ? 0 : 3}
            dataKey="value"
            strokeWidth={0}
          >
            {(noAlloc ? [{ name: "None", value: 1 }] : data).map((_, i) => (
              <Cell key={i} fill={noAlloc ? "#1e1e1e" : colors[i % colors.length]} />
            ))}
          </Pie>
          {!noAlloc && <Tooltip content={<CustomTooltip />} />}
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-1 mt-1">
        {data.filter((d) => d.value > 0).map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: colors[i % colors.length] }} />
              <span className="font-mono text-secondary">{d.name}</span>
            </div>
            <span className="font-mono text-primary">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AllocationChart({ qaoa_allocation, classical_allocation }) {
  const toData = (alloc) =>
    Object.entries(alloc).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }));

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-primary mb-4">Allocation</h3>
      <div className="flex gap-8">
        <Pie2 data={toData(qaoa_allocation)} colors={QAOA_COLORS} label="QAOA" />
        <div className="w-px bg-border" />
        <Pie2 data={toData(classical_allocation)} colors={CLASS_COLORS} label="Classical" />
      </div>
    </div>
  );
}
