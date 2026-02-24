import React, { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot, Legend,
} from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-subtle mb-1">{d.label || d.type}</p>
      <div className="flex justify-between gap-4">
        <span className="text-subtle">Return</span>
        <span className="font-mono text-primary">{(d.expected_return * 100).toFixed(2)}%</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-subtle">Volatility</span>
        <span className="font-mono text-primary">{(d.volatility * 100).toFixed(2)}%</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-subtle">Sharpe</span>
        <span className="font-mono text-primary">{d.sharpe.toFixed(3)}</span>
      </div>
    </div>
  );
};

export default function EfficientFrontier({ frontier, metrics }) {
  if (!frontier?.length) return null;

  const random = useMemo(() =>
    frontier
      .filter((p) => p.type === "random")
      .map((p) => ({ x: p.volatility * 100, y: p.expected_return * 100, ...p })),
    [frontier]
  );

  const curve = useMemo(() =>
    frontier
      .filter((p) => p.type === "frontier")
      .sort((a, b) => a.volatility - b.volatility)
      .map((p) => ({ x: p.volatility * 100, y: p.expected_return * 100, ...p })),
    [frontier]
  );

  const qaoa = metrics?.qaoa
    ? { x: metrics.qaoa.volatility * 100, y: metrics.qaoa.expected_return * 100, label: "QAOA", sharpe: metrics.qaoa.sharpe_ratio }
    : null;
  const classical = metrics?.classical
    ? { x: metrics.classical.volatility * 100, y: metrics.classical.expected_return * 100, label: "Classical", sharpe: metrics.classical.sharpe_ratio }
    : null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-primary">Efficient Frontier</h3>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-border-soft inline-block" />
            Random portfolios
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-white/40 inline-block" />
            Efficient frontier
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e1e1e" />
          <XAxis
            type="number"
            dataKey="x"
            name="Volatility"
            tick={{ fontSize: 10, fill: "#6b6b6b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            label={{ value: "Volatility (%)", position: "insideBottom", offset: -4, fontSize: 10, fill: "#6b6b6b" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Return"
            tick={{ fontSize: 10, fill: "#6b6b6b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            label={{ value: "Return (%)", angle: -90, position: "insideLeft", offset: 8, fontSize: 10, fill: "#6b6b6b" }}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#2a2a2a" }} />

          {/* Random portfolio cloud */}
          <Scatter data={random} fill="#1e2a3a" opacity={0.7} shape="circle" />

          {/* Efficient frontier curve */}
          <Scatter data={curve} fill="#3b82f6" opacity={0.9} line={{ stroke: "#3b82f6", strokeWidth: 1.5 }} shape="circle" />

          {/* QAOA marker */}
          {qaoa && (
            <ReferenceDot
              x={qaoa.x} y={qaoa.y}
              r={6} fill="#60a5fa" stroke="#080808" strokeWidth={2}
              label={{ value: "QAOA", position: "top", fontSize: 10, fill: "#60a5fa" }}
            />
          )}

          {/* Classical marker */}
          {classical && (
            <ReferenceDot
              x={classical.x} y={classical.y}
              r={6} fill="#e5e5e5" stroke="#080808" strokeWidth={2}
              label={{ value: "Classical", position: "top", fontSize: 10, fill: "#a0a0a0" }}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted mt-1">
        {random.length} random portfolios · {curve.length} frontier points. Each dot is a different allocation. The curve traces the minimum-variance portfolio at each return level.
      </p>
    </div>
  );
}
