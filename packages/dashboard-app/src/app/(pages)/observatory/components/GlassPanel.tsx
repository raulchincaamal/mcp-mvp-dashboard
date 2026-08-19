'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import type { CursorState } from '../hooks/useCursor';

interface Props {
  children: ReactNode;
  cursor: CursorState;
  depth?: number;
  className?: string;
  style?: React.CSSProperties;
  glowOnHover?: boolean;
}

export default function GlassPanel({
  children,
  cursor,
  depth = 0.5,
  className = '',
  style = {},
  glowOnHover = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);
  const [distance, setDistance] = useState(1000);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.hypot(cursor.x - centerX, cursor.y - centerY);
    setDistance(dist);
    setIsNear(dist < 350);
  }, [cursor.x, cursor.y]);

  useEffect(() => {
    if (!ref.current) return;
    const parallaxX = cursor.normalizedX * 15 * depth;
    const parallaxY = cursor.normalizedY * 10 * depth;
    
    let magnetX = 0;
    let magnetY = 0;
    if (isNear && distance > 0) {
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const pull = Math.max(0, (350 - distance) / 350) * 6;
      magnetX = (cursor.x - centerX) / distance * pull;
      magnetY = (cursor.y - centerY) / distance * pull;
    }

    gsap.to(ref.current, {
      x: parallaxX + magnetX,
      y: parallaxY + magnetY,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, [cursor.normalizedX, cursor.normalizedY, depth, isNear, distance, cursor.x, cursor.y]);

  const glowIntensity = glowOnHover && isNear ? Math.max(0, (350 - distance) / 350) * 0.4 : 0;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        background: 'var(--surface)',
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        border: `1px solid var(--border-color)`,
        borderRadius: 'var(--radius)',
        boxShadow: glowIntensity > 0
          ? `var(--shadow), 0 0 ${12 + glowIntensity * 20}px rgba(73, 164, 216, ${glowIntensity * 0.15})`
          : 'var(--shadow)',
        transition: 'box-shadow 0.4s ease, border-color 0.3s ease',
        borderColor: glowIntensity > 0.2 ? 'var(--primary)' : undefined,
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
