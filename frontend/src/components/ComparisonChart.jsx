import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-neutral-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(4)}
        </p>
      ))}
    </div>
  );
};

export default function ComparisonChart({ metrics }) {
  if (!metrics) return null;
  const { qaoa, classical } = metrics;

  const data = [
    {
      metric: "Exp. Return",
      QAOA: parseFloat((qaoa.expected_return * 100).toFixed(3)),
      Classical: parseFloat((classical.expected_return * 100).toFixed(3)),
    },
    {
      metric: "Volatility",
      QAOA: parseFloat((qaoa.volatility * 100).toFixed(3)),
      Classical: parseFloat((classical.volatility * 100).toFixed(3)),
    },
    {
      metric: "Sharpe Ratio",
      QAOA: parseFloat(qaoa.sharpe_ratio.toFixed(4)),
      Classical: parseFloat(classical.sharpe_ratio.toFixed(4)),
    },
  ];

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">QAOA vs Classical Markowitz</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barGap={4} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
          <XAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(v) => <span style={{ color: "#94a3b8" }}>{v}</span>}
          />
          <Bar dataKey="QAOA" fill="#818cf8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Classical" fill="#34d399" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
