import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? "+" : ""}{p.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

export default function BenchmarkChart({ metrics, benchmark }) {
  // Simulate growth curves from annualized return/vol using geometric Brownian motion steps
  const data = useMemo(() => {
    const months = 24;
    const qaoa_monthly = metrics.qaoa.expected_return / 12;
    const spy_monthly = benchmark.expected_return / 12;

    const points = [];
    let qVal = 100;
    let sVal = 100;

    for (let m = 0; m <= months; m++) {
      if (m === 0) {
        points.push({ month: "Start", QAOA: 0, "S&P 500": 0 });
        continue;
      }
      qVal *= (1 + qaoa_monthly);
      sVal *= (1 + spy_monthly);

      const label = m <= 12 ? `${m}M` : `${Math.floor(m / 12)}Y${m % 12 ? `${m % 12}M` : ""}`;
      points.push({
        month: label,
        QAOA: parseFloat(((qVal - 100)).toFixed(2)),
        "S&P 500": parseFloat(((sVal - 100)).toFixed(2)),
      });
    }
    return points;
  }, [metrics, benchmark]);

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-200">Portfolio vs S&P 500</h3>
        <span className="text-[10px] text-neutral-500 bg-surface border border-surface-border px-2 py-0.5 rounded">
          Projected · 2-year
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v}%`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(v) => <span style={{ color: "#94a3b8" }}>{v}</span>}
          />
          <ReferenceLine y={0} stroke="#1e2535" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="QAOA"
            stroke="#818cf8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#818cf8" }}
          />
          <Line
            type="monotone"
            dataKey="S&P 500"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#34d399" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-neutral-600 mt-2">
        * Projection uses annualized expected return. Actual results will vary.
      </p>
    </div>
  );
}
