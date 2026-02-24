import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-subtle mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-primary">{p.value >= 0 ? "+" : ""}{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

export default function BenchmarkChart({ metrics, benchmark }) {
  const data = useMemo(() => {
    const months = 24;
    const qMonthly = metrics.qaoa.expected_return / 12;
    const sMonthly = benchmark.expected_return / 12;
    const pts = [{ m: "Start", QAOA: 0, "S&P 500": 0 }];
    let qv = 100, sv = 100;
    for (let m = 1; m <= months; m++) {
      qv *= (1 + qMonthly);
      sv *= (1 + sMonthly);
      const label = m <= 12 ? `${m}M` : m === 24 ? "2Y" : `${m}M`;
      pts.push({ m: label, QAOA: parseFloat((qv - 100).toFixed(1)), "S&P 500": parseFloat((sv - 100).toFixed(1)) });
    }
    return pts;
  }, [metrics, benchmark]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-primary">vs S&P 500</h3>
        <span className="text-[10px] text-muted border border-border rounded px-2 py-0.5">Projected · 24 months</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e1e1e" />
          <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#6b6b6b" }} axisLine={false} tickLine={false} interval={3} />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b6b6b" }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v}%`} width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#2a2a2a" strokeDasharray="3 3" />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            formatter={(v) => <span style={{ color: "#6b6b6b" }}>{v}</span>}
          />
          <Line type="monotone" dataKey="QAOA" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#3b82f6" }} />
          <Line type="monotone" dataKey="S&P 500" stroke="#3a3a3a" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#3a3a3a" }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted mt-2">Projection based on annualized expected return. Past performance does not guarantee future results.</p>
    </div>
  );
}
