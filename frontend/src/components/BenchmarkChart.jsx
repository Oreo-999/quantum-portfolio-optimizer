import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-subtle mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-primary">
            {p.value >= 0 ? "+" : ""}{p.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
};

export default function BenchmarkChart({ backtest }) {
  if (!backtest?.length) return null;

  // Thin out to ~60 points for readability
  const step = Math.max(1, Math.floor(backtest.length / 60));
  const data = backtest.filter((_, i) => i % step === 0 || i === backtest.length - 1);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-primary">Historical Backtest vs S&P 500</h3>
        <span className="text-[10px] text-muted border border-border rounded px-2 py-0.5">
          2-year · actual returns
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e1e1e" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b6b6b" }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(data.length / 5)}
            tickFormatter={(v) => v.slice(0, 7)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b6b6b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v}%`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#2a2a2a" strokeDasharray="3 3" />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(v) => <span style={{ color: "#6b6b6b" }}>{v}</span>}
          />
          <Line type="monotone" dataKey="qaoa" name="QAOA" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="classical" name="Classical" stroke="#737373" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="spy" name="S&P 500" stroke="#374151" strokeWidth={1.5} dot={false} strokeDasharray="4 2" activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted mt-2">
        Static weights applied to historical daily returns. In-sample simulation — not a forward-looking prediction.
      </p>
    </div>
  );
}
