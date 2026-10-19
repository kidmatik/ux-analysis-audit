"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type TabDef = { id: string; label: string; count?: number };

// Report tabs. Panels are rendered on the server and toggled here; the active tab lives in
// the URL hash so links like #issues or #finding-F3 open the right tab.
export function ReportTabs({ tabs, panels }: { tabs: TabDef[]; panels: Record<string, React.ReactNode> }) {
  const [active, setActive] = useState(tabs[0].id);
  const barRef = useRef<HTMLDivElement>(null);

  const fromHash = useCallback(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (!h) return;
    if (tabs.some((t) => t.id === h)) {
      setActive(h);
      return;
    }
    // Deep links into a finding or check open the Issues tab, then scroll to the target.
    if (h.startsWith("finding-") || h.startsWith("check-")) {
      setActive("issues");
      requestAnimationFrame(() => setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60));
    }
  }, [tabs]);

  useEffect(() => {
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [fromHash]);

  function select(id: string) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    const top = barRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 64) barRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onKey(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
    if (next < 0 || next >= tabs.length) return;
    e.preventDefault();
    select(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div>
      <div ref={barRef} className="sticky top-16 z-30 -mx-4 sm:mx-0 scroll-mt-16 bg-white/90 backdrop-blur px-4 sm:px-0 py-3 no-print">
        <div role="tablist" aria-label="Report sections" onKeyDown={onKey} className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-sm [scrollbar-width:none]">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => select(t.id)}
                className={`relative flex-1 min-w-max whitespace-nowrap rounded-xl px-4 sm:px-6 py-2.5 sm:py-3 text-[15px] transition-all duration-200 ${
                  on ? "bg-white font-semibold text-fg ring-2 ring-accent shadow-[0_4px_14px_rgb(240_74_15/0.18)]" : "text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className="tab-panel pt-6">
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
