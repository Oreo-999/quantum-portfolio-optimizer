import React, { useState } from "react";

export default function BackendBadge({ backend_used, used_simulator_fallback, fallback_reason }) {
  const [showTip, setShowTip] = useState(false);
  const isReal = !used_simulator_fallback;

  return (
    <div className="relative inline-flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border cursor-default
          ${isReal
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          }`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${isReal ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`}
        />
        <span>{backend_used}</span>
        {fallback_reason && (
          <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {showTip && fallback_reason && (
        <div className="absolute top-full left-0 mt-2 z-20 w-64 bg-surface-card border border-surface-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-neutral-400 leading-relaxed">{fallback_reason}</p>
        </div>
      )}
    </div>
  );
}
