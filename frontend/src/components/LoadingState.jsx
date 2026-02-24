import React from "react";

export default function LoadingState({ stage, useSimulator }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-8 animate-fade-in">
      {/* Quantum spinner */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-quantum animate-spin-slow" style={{ animationDirection: "reverse" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-accent opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      {/* Stage label */}
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-neutral-200">{stage || "Initializing…"}</p>
        {!useSimulator && (
          <p className="text-xs text-amber-400/80 max-w-xs">
            Running on IBM Quantum hardware — queue times may vary
          </p>
        )}
      </div>

      {/* Pulsing dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent"
            style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
