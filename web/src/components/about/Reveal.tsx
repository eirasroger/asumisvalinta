"use client";

import { useEffect, useRef, useState } from "react";

/** Fades its content in when it scrolls into view; content already on screen, or seen without scripts, stays visible. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setHidden(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHidden(false);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} data-hidden={hidden || undefined} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
