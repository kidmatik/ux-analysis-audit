export function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 mb-1.5 text-xs font-bold uppercase tracking-wider text-subtle">{children}</p>;
}

export function Locked({ text }: { text: string }) {
  return (
    <a href="/upgrade" className="flex items-center gap-3 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-sm text-muted transition-colors hover:border-accent hover:bg-accent/10 no-print">
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="9" width="12" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 016 0V9" /></svg>
      <span>{text}</span>
      <span className="ml-auto shrink-0 font-semibold text-accent">Go Pro</span>
    </a>
  );
}
