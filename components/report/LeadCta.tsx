"use client";
import { useState } from "react";
import { btn, inputCls } from "../ui";

export function LeadCta({ kind, label, href, auditId, variant }: { kind: "human_audit" | "strategy_call"; label: string; href?: string; auditId?: string; variant: "accent" | "secondary" | "cta" | "light" }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={`${btn(variant)} py-3 text-base`}>{label}</a>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, message, kind, auditId }) });
    if (res.ok) setSent(true);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${btn(variant)} py-3 text-base`}>{label}</button>
      {open && (
        <div className="fade-up fixed inset-0 z-50 flex items-center justify-center bg-fg/50 backdrop-blur-sm p-4 text-fg" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <>
                <h3 className="text-2xl font-bold tracking-tight">Request received</h3>
                <p className="mt-2 text-sm text-muted">We will reply within one business day to schedule next steps.</p>
                <button onClick={() => setOpen(false)} className={`${btn("secondary")} mt-6`}>Close</button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h3 className="text-2xl font-bold tracking-tight">{label}</h3>
                <p className="mt-2 text-sm text-muted">
                  {kind === "human_audit"
                    ? "A senior product strategist reviews your product end to end and delivers a board-ready report."
                    : "A 30-minute session to walk through this report and agree the first three changes."}
                </p>
                <input required type="email" placeholder="Work email" className={`${inputCls} mt-5`} value={email} onChange={(e) => setEmail(e.target.value)} />
                <textarea rows={3} placeholder="Anything we should know (optional)" className={`${inputCls} mt-3`} value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="mt-5 flex gap-2">
                  <button type="submit" className={btn("accent")}>Send request</button>
                  <button type="button" onClick={() => setOpen(false)} className={btn("ghost")}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
