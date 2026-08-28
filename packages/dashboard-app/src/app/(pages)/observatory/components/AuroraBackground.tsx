'use client';

import React from 'react';

const NEBULAS = [
  // Azul eléctrico — arriba izquierda, ancla visual
  { w: '80%', h: '70%', top: '-20%',  left: '-10%',   color: 'rgba(30,100,255,0.14)',  anim: 'aurora-drift-1 28s ease-in-out infinite' },
  // Cian brillante — centro-derecha
  { w: '60%', h: '55%', top: '10%',   right: '-15%',  color: 'rgba(0,180,255,0.11)',   anim: 'aurora-drift-2 22s ease-in-out infinite reverse' },
  // Azul profundo — abajo izquierda
  { w: '55%', h: '60%', bottom: '-18%', left: '5%',   color: 'rgba(10,60,200,0.10)',   anim: 'aurora-drift-3 34s ease-in-out infinite' },
  // Azul marino — abajo derecha, capa base
  { w: '50%', h: '50%', bottom: '-10%', right: '-5%', color: 'rgba(0,120,220,0.09)',   anim: 'aurora-drift-4 26s ease-in-out infinite reverse' },
  // Cian tenue — centro, brillo ambiental
  { w: '40%', h: '35%', top: '30%',   left: '30%',    color: 'rgba(0,160,240,0.07)',   anim: 'aurora-drift-1 40s ease-in-out infinite reverse' },
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
          background: `radial-gradient(ellipse, ${n.color} 0%, transparent 68%)`,
          animation: n.anim,
          transform: 'translateZ(0)',
          willChange: 'transform',
          filter: 'blur(2px)',
        }} />
      ))}
    </div>
  );
});

export default AuroraBackground;
