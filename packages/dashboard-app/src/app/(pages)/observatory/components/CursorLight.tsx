'use client';

import type { CursorState } from '../hooks/useCursor';

interface Props {
  cursor: CursorState;
}

export default function CursorLight({ cursor }: Props) {
  const baseIntensity = 0.15;
  const speedBoost = Math.min(cursor.speed * 0.003, 0.1);
  const intensity = baseIntensity + speedBoost;
  const size = 450;

  return (
    <>
      {/* Main spotlight */}
      <div
        style={{
          position: 'fixed',
          left: cursor.x - size / 2,
          top: cursor.y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle, 
            color-mix(in srgb, var(--primary) ${intensity * 100}%, transparent) 0%, 
            color-mix(in srgb, var(--primary) ${intensity * 30}%, transparent) 30%, 
            transparent 60%)`,
          pointerEvents: 'none',
          zIndex: 1,
          willChange: 'left, top',
          mixBlendMode: 'screen',
        }}
      />
      {/* Inner bright core */}
      <div
        style={{
          position: 'fixed',
          left: cursor.x - 80,
          top: cursor.y - 80,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `radial-gradient(circle, 
            color-mix(in srgb, var(--text) ${intensity * 50}%, transparent) 0%, 
            transparent 50%)`,
          pointerEvents: 'none',
          zIndex: 1,
          willChange: 'left, top',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
