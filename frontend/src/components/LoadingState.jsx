import React from "react";

export default function LoadingState({ stage, useSimulator }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border border-border" />
        <div className="absolute inset-0 rounded-full border border-transparent border-t-white/60 animate-spin" />
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-sm text-secondary">{stage || "Initializing…"}</p>
        {!useSimulator && (
          <p className="text-xs text-subtle">IBM Quantum queue times may vary</p>
        )}
      </div>
    </div>
  );
}
