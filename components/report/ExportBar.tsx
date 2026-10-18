"use client";
import { useState } from "react";
import { btn } from "../ui";

export function ExportBar({ auditId, shareToken, locked, canShare }: { auditId: string; shareToken?: string; locked: boolean; canShare: boolean }) {
  const [copied, setCopied] = useState(false);
  const q = shareToken ? `?t=${shareToken}` : "";

  async function share() {
    let url = shareToken ? window.location.href : "";
    if (!url) {
      const res = await fetch(`/api/audits/${auditId}/share`, { method: "POST" });
      url = (await res.json()).url;
    }
    await navigator.clipboard.writeText(url).catch(() => window.prompt("Copy this link", url));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const lockedHint = "Part of Pro";
  return (
    <div className="flex flex-wrap gap-2 no-print">
      {locked ? (
        <>
          <a href="/upgrade" className={btn("secondary")} title={lockedHint}>Download PDF <span className="text-[10px] uppercase tracking-wider text-accent">Pro</span></a>
          <a href="/upgrade" className={btn("secondary")} title={lockedHint}>Export to Notion <span className="text-[10px] uppercase tracking-wider text-accent">Pro</span></a>
        </>
      ) : (
        <>
          <a href={`/api/audits/${auditId}/pdf${q}`} className={btn("secondary")}>Download PDF</a>
          {!shareToken && <a href={`/api/audits/${auditId}/notion`} className={btn("secondary")} title="Markdown file that Notion imports directly">Export to Notion</a>}
        </>
      )}
      {canShare && (
        <button onClick={share} className={btn("secondary")}>{copied ? "Link copied" : "Share link"}</button>
      )}
    </div>
  );
}
