import { AnnotationExplorer } from "./AnnotationExplorer";
import { Locked } from "./parts";
import { PanelTitle } from "./PanelTitle";
import { Reveal } from "../Reveal";
import type { ViewReport } from "@/lib/gate";

const path = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
};

export function CrawledPages({ report }: { report: ViewReport }) {
  const v = report.visibility;
  const shots = report.screenshots.map((s, i) => ({
    ...s,
    i,
    issues: report.findings.filter((f) => f.annotation?.screenshotIndex === i),
  }));

  return (
    <div className="space-y-12">
      {v && (
        <section>
          <PanelTitle title={`Crawled pages (${v.pages.length})`} sub={`Pages we fetched on ${v.origin.replace(/^https?:\/\//, "")} to check indexing, metadata, speed and AI access.`} />
          <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-5 py-3 font-semibold">Page</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Indexable</th>
                  <th className="px-3 py-3 font-semibold text-right">Words</th>
                  <th className="px-3 py-3 font-semibold text-right">Load</th>
                  <th className="px-5 py-3 font-semibold text-right">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {v.pages.map((p) => (
                  <tr key={p.url} className="transition-colors hover:bg-surface/70">
                    <td className="px-5 py-3.5 max-w-[22rem]">
                      <p className="truncate font-medium text-accent">{path(p.url)}</p>
                      <p className="truncate text-muted">{p.title || <span className="text-critical">No title</span>}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${p.status === 200 ? "bg-good/10 text-good" : "bg-critical/10 text-critical"}`}>{p.status || "Failed"}</span>
                    </td>
                    <td className="px-3 py-3.5">{p.indexable ? <span className="text-good">Yes</span> : <span className="font-semibold text-critical">No</span>}</td>
                    <td className={`px-3 py-3.5 text-right tabular-nums ${p.words < 250 ? "text-high font-semibold" : ""}`}>{p.words.toLocaleString()}</td>
                    <td className={`px-3 py-3.5 text-right tabular-nums ${p.loadMs > 2500 ? "text-critical font-semibold" : ""}`}>{(p.loadMs / 1000).toFixed(1)}s</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${p.issues.length ? "bg-critical text-white" : "bg-good/10 text-good"}`}>{p.issues.length}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <PanelTitle title={`Captured screens (${shots.length})`} sub="Every screen we analyzed for UX and UI, with how many findings were pinned on it." />
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {shots.map((s, k) => (
            <Reveal key={s.i} delay={k * 50} className="lift overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-surface">
                {s.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.src} alt={s.label} className="h-full w-full object-cover object-top" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-subtle">Included in Pro</div>
                )}
                {s.issues.length > 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-critical px-2 py-0.5 text-xs font-bold text-white shadow">{s.issues.length}</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium leading-snug line-clamp-2">{s.label}</p>
                <p className="mt-0.5 text-xs text-subtle">{s.width < 600 ? "Mobile" : "Desktop"} · {s.width}×{s.height}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section>
        <PanelTitle title="Visual annotations" sub="Every captured screen with its findings pinned in place. Hover or tap a comment to locate it." />
        <div className="mt-5">
          <AnnotationExplorer screenshots={report.screenshots} findings={report.findings} />
          {report.locked && report.lockedCounts && report.lockedCounts.screenshots > 0 && (
            <div className="mt-4"><Locked text={`${report.lockedCounts.screenshots} more annotated screens are included in Pro.`} /></div>
          )}
        </div>
      </section>
    </div>
  );
}
