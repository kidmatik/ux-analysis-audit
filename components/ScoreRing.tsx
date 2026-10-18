export function scoreColor(score: number) {
  return score >= 80 ? "var(--color-good)" : score >= 60 ? "var(--color-high)" : "var(--color-critical)";
}

export function ScoreRing({ score, size = 168, stroke = 14, label = "Growth Readiness" }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="ring-draw"
          style={{ ["--ring-c" as string]: c }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tracking-tight leading-none" style={{ fontSize: size * 0.3 }}>{score}</span>
        <span className="mt-1 text-subtle" style={{ fontSize: Math.max(10, size * 0.07) }}>{label}</span>
      </div>
    </div>
  );
}
