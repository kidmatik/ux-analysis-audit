import { VISIBILITY_SUB_SCORES, type VisibilityReport } from "@/lib/visibility";

const toneFor = (n: number) => (n >= 80 ? "var(--color-good)" : n >= 60 ? "var(--color-high)" : "var(--color-critical)");

/** Half-circle gauge with a target marker, like an "AI Search health" meter. */
export function HealthGauge({ score, target = 80, size = 260 }: { score: number; target?: number; size?: number }) {
  const stroke = Math.round(size * 0.11);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const len = Math.PI * r;
  const pt = (p: number) => {
    const a = Math.PI * (1 - p / 100);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const t = pt(target);
  const arc = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size / 2 + stroke / 2 }}>
      <svg width={size} height={size / 2 + stroke / 2} viewBox={`0 0 ${size} ${size / 2 + stroke / 2}`} role="img" aria-label={`Score ${score} of 100, target ${target}`}>
        <path d={arc} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arc} fill="none" stroke="rgb(91 69 255 / 0.16)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(len * target) / 100} ${len}`} />
        <path
          d={arc}
          fill="none"
          stroke={toneFor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="ring-draw"
          style={{ ["--ring-c" as string]: String(len), strokeDasharray: `${(len * score) / 100} ${len}` }}
        />
        <circle cx={t.x} cy={t.y} r={stroke * 0.32} fill="white" stroke="var(--color-accent)" strokeWidth="3" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className={`font-extrabold tracking-tight tabular-nums ${size < 200 ? "text-3xl" : "text-5xl sm:text-6xl"}`}>{score}<span className={size < 200 ? "text-base text-subtle" : "text-2xl text-subtle"}>%</span></p>
      </div>
    </div>
  );
}

export function AiHealthCard({ v }: { v: VisibilityReport }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold">AI & search health</h3>
        <p className="flex max-w-[11rem] items-start gap-2 text-sm text-muted">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-accent/30 ring-2 ring-accent" />Reach 80% for strong AI and search visibility
        </p>
      </div>
      <div className="mt-6"><HealthGauge score={v.score} size={240} /></div>
      <div className="mt-6 space-y-2.5">
        {VISIBILITY_SUB_SCORES.map((d, i) => {
          const s = v.subScores.find((x) => x.key === d.key)?.score ?? 0;
          return (
            <div key={d.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[11rem_1fr_2.5rem] items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted">{d.label}</span>
              <span className="text-right font-semibold tabular-nums sm:order-last">{s}</span>
              <div className="col-span-2 sm:col-span-1 h-2 rounded-full bg-surface-2">
                <div className="bar-grow h-2 rounded-full" style={{ width: `${s}%`, background: toneFor(s), ["--bar-delay" as string]: `${200 + i * 70}ms` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BotAccessCard({ v }: { v: VisibilityReport }) {
  const blocked = v.bots.filter((b) => !b.allowed).length;
  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold">AI and search crawler access</h3>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${blocked ? "bg-critical/10 text-critical" : "bg-good/10 text-good"}`}>
          {blocked ? `${blocked} blocked` : "All allowed"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">From your robots.txt{v.files.robotsTxt ? "" : " (not found, so everything is allowed)"}.</p>
      <ul className="mt-6 space-y-3">
        {v.bots.map((b, i) => (
          <li key={b.name} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.allowed ? "bg-good" : "bg-critical"}`} />
                <span className="font-medium">{b.engine}</span>
                <span className="truncate text-xs text-subtle">{b.name}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                <div className={`bar-grow h-2 rounded-full ${b.allowed ? "bg-good" : "bg-critical"}`} style={{ width: b.allowed ? "100%" : "12%", ["--bar-delay" as string]: `${200 + i * 70}ms` }} />
              </div>
            </div>
            <span className={`w-20 text-right text-sm font-semibold ${b.allowed ? "text-good" : "text-critical"}`}>{b.allowed ? "Allowed" : "Blocked"}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
        {([["robots.txt", v.files.robotsTxt], ["sitemap.xml", v.files.sitemap], ["llms.txt", v.files.llmsTxt]] as const).map(([n, ok]) => (
          <div key={n} className={`rounded-xl border px-2 py-2.5 ${ok ? "border-good/30 bg-good/5" : "border-line bg-surface"}`}>
            <p className="font-semibold">{n}</p>
            <p className={ok ? "text-good" : "text-subtle"}>{ok ? "Found" : "Missing"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
