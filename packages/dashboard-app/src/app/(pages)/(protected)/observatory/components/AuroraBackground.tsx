'use client';

import React from 'react';

const NEBULAS = [
  { w: '110%', h: '90%', top: '-30%',  left: '-20%',  color: 'rgba(30,100,255,0.07)',  anim: 'aurora-drift-1 32s ease-in-out infinite' },
  { w: '100%', h: '85%', bottom: '-30%', right: '-20%', color: 'rgba(0,180,255,0.05)', anim: 'aurora-drift-2 26s ease-in-out infinite reverse' },
  { w: '80%',  h: '70%', top: '20%',  left: '15%',    color: 'rgba(80,40,220,0.04)',   anim: 'aurora-drift-3 40s ease-in-out infinite' },
];

interface Props {
  position?: 'fixed' | 'absolute';
}

const AuroraBackground = React.memo(function AuroraBackground({ position = 'absolute' }: Props) {
  return (
    <div aria-hidden style={{ position, inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0, willChange: 'transform' }}>
      {NEBULAS.map((n, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: n.w, height: n.h,
          top:    (n as { top?: string }).top,
          left:   (n as { left?: string }).left,
          right:  (n as { right?: string }).right,
          bottom: (n as { bottom?: string }).bottom,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${n.color} 0%, transparent 65%)`,
          animation: n.anim,
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }} />
      ))}
    </div>
  );
});

export default AuroraBackground;
