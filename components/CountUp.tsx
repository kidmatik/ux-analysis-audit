"use client";
import { useEffect, useRef, useState } from "react";

// Counts from 0 to `value` the first time the number scrolls into view.
export function CountUp({ value, decimals = 0, duration = 1400, prefix = "", suffix = "", className = "" }: { value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setN(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`} aria-label={`${prefix}${value.toFixed(decimals)}${suffix}`}>
      {prefix}{n.toFixed(decimals)}{suffix}
    </span>
  );
}
