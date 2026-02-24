import React, { useState } from "react";

export default function BackendBadge({ backend_used, used_simulator_fallback, fallback_reason }) {
  const [showTip, setShowTip] = useState(false);
  const isReal = !used_simulator_fallback;

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-default
          ${isReal
            ? "border-positive/20 text-positive/80 bg-positive/5"
            : "border-border text-subtle bg-surface"
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isReal ? "bg-positive" : "bg-subtle"}`} />
        {backend_used}
        {fallback_reason && (
          <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
        )}
      </div>

      {showTip && fallback_reason && (
        <div className="absolute top-full left-0 mt-1.5 z-20 w-56 bg-card border border-border rounded-lg p-3 shadow-2xl">
          <p className="text-[11px] text-secondary leading-relaxed">{fallback_reason}</p>
        </div>
      )}
    </div>
  );
}
