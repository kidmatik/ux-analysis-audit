export function PanelTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h2>
      {sub && <p className="mt-1.5 text-muted">{sub}</p>}
    </div>
  );
}
