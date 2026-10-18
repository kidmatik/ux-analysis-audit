"use client";
import { useState } from "react";
import { AnnotatedShot } from "../AnnotatedShot";
import type { Finding, Report } from "@/lib/report";

export function AnnotationExplorer({ screenshots, findings }: { screenshots: Report["screenshots"]; findings: Finding[] }) {
  const withNotes = screenshots
    .map((s, i) => ({ s, i, items: findings.filter((f) => f.annotation?.screenshotIndex === i) }))
    .filter((x) => x.s.src);
  const [shot, setShot] = useState(withNotes.find((x) => x.items.length)?.i ?? withNotes[0]?.i ?? 0);
  const [active, setActive] = useState<string | null>(null);
  const current = withNotes.find((x) => x.i === shot) ?? withNotes[0];
  if (!current) return null;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {withNotes.map(({ s, i, items }) => (
          <button
            key={i}
            onClick={() => { setShot(i); setActive(null); }}
            className={`shrink-0 rounded-full border px-4 py-2 text-left text-sm font-medium transition-all ${i === shot ? "border-accent bg-accent text-white" : "border-line-strong bg-white text-muted hover:border-accent/50 hover:text-fg"}`}
          >
            {s.label}
            <span className="ml-2 opacity-70">{items.length}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <AnnotatedShot
          src={current.s.src}
          width={current.s.width}
          height={current.s.height}
          alt={current.s.label}
          markers={current.items.map((f) => ({ box: f.annotation!, label: f.id.replace(/^F/, ""), active: active ? active === f.id : true }))}
        />
        <div className="rounded-2xl border border-line bg-white divide-y divide-line shadow-sm lg:max-h-[640px] lg:overflow-y-auto">
          {current.items.length === 0 && <p className="p-5 text-sm text-muted">No findings pinned to this screen.</p>}
          {current.items.map((f) => (
            <button
              key={f.id}
              onMouseEnter={() => setActive(f.id)}
              onFocus={() => setActive(f.id)}
              onMouseLeave={() => setActive(null)}
              onClick={() => document.getElementById(`finding-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`block w-full text-left p-4 transition-colors hover:bg-surface ${active === f.id ? "bg-accent/5" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[11px] font-bold text-white">{f.id.replace(/^F/, "")}</span>
                <span className="text-[15px] font-semibold leading-snug">{f.title}</span>
              </div>
              {f.annotationNote && <p className="mt-1 pl-7 text-sm text-muted">{f.annotationNote}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
