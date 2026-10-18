import type { Box } from "@/lib/report";

type Marker = { box: Box; label: string; active?: boolean };

// Renders a screenshot with highlighted regions. In "focus" mode the image is cropped and
// zoomed around the first marker so the reader sees exactly where the issue is.
export function AnnotatedShot({
  src,
  width,
  height,
  markers,
  mode = "full",
  spotlight = false,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  markers: Marker[];
  mode?: "full" | "focus";
  spotlight?: boolean;
  alt: string;
}) {
  let crop = { x: 0, y: 0, w: 100, h: 100 };
  const focus = markers[0]?.box;
  if (mode === "focus" && focus) {
    const ratio = width / height;
    const target = 16 / 10;
    let w = Math.min(100, Math.max(focus.w * 1.9, 42));
    let h = Math.min(100, (w * ratio) / target);
    if (h < focus.h * 1.35) {
      h = Math.min(100, focus.h * 1.35);
      w = Math.min(100, Math.max(w, (h * target) / ratio));
    }
    const cx = focus.x + focus.w / 2;
    const cy = focus.y + focus.h / 2;
    crop = {
      w,
      h,
      x: Math.max(0, Math.min(100 - w, cx - w / 2)),
      y: Math.max(0, Math.min(100 - h, cy - h / 2)),
    };
  }
  const aspect = (crop.w * width) / (crop.h * height);
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm" style={{ aspectRatio: String(aspect) }}>
      <div
        className="absolute"
        style={{
          width: `${(100 / crop.w) * 100}%`,
          height: `${(100 / crop.h) * 100}%`,
          left: `${(-crop.x / crop.w) * 100}%`,
          top: `${(-crop.y / crop.h) * 100}%`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full" loading="lazy" />
        {markers.map((m, i) => (
          <div
            key={i}
            className={`absolute rounded-[4px] border-[2.5px] transition-all duration-300 ${m.active === false ? "border-critical/30 bg-transparent" : "border-critical bg-critical/10"}`}
            style={{
              left: `${m.box.x}%`,
              top: `${m.box.y}%`,
              width: `${m.box.w}%`,
              height: `${m.box.h}%`,
              boxShadow: spotlight && i === 0 ? "0 0 0 9999px rgb(14 19 37 / 0.28)" : undefined,
            }}
          >
            <span
              className={`marker-pop absolute ${m.box.x < 2 ? "left-1" : "-left-3"} ${m.box.y < 3 ? "top-1" : "-top-3"} flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white shadow ${m.active === false ? "bg-critical/50" : "bg-critical"}`}
            >
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
