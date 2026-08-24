'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';

export default function BarbaWrapper({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    // Page transition: fade out → update → fade in
    const tl = gsap.timeline();
    tl.to(el, {
      opacity: 0,
      y: -20,
      duration: 0.25,
      ease: 'power2.in',
    }).set(el, { y: 20 }).to(el, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: 'power3.out',
    });

    return () => { tl.kill(); };
  }, [pathname]);

  return (
    <div
      ref={containerRef}
      data-barba="container"
      style={{ minHeight: '100vh', opacity: 1 }}
    >
      {children}
    </div>
  );
}
