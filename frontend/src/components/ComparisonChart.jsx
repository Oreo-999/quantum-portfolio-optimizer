import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-subtle mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-primary">{p.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ComparisonChart({ metrics }) {
  if (!metrics) return null;
  const { qaoa, classical } = metrics;

  const data = [
    {
      name: "Return",
      QAOA: parseFloat((qaoa.expected_return * 100).toFixed(3)),
      Classical: parseFloat((classical.expected_return * 100).toFixed(3)),
    },
    {
      name: "Volatility",
      QAOA: parseFloat((qaoa.volatility * 100).toFixed(3)),
      Classical: parseFloat((classical.volatility * 100).toFixed(3)),
    },
    {
      name: "Sharpe",
      QAOA: parseFloat(qaoa.sharpe_ratio.toFixed(3)),
      Classical: parseFloat(classical.sharpe_ratio.toFixed(3)),
    },
  ];

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-primary mb-4">QAOA vs Classical</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={3} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="2 2" stroke="#1e1e1e" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b6b6b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#6b6b6b" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            formatter={(v) => <span style={{ color: "#6b6b6b" }}>{v}</span>}
          />
          <Bar dataKey="QAOA" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Classical" fill="#3a3a3a" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
