'use client';

import React from 'react';

const NEBULAS = [
  // Azul estelar principal — arriba centro
  { w: '70%', h: '70%', top: '-15%', left: '10%',   color: 'rgba(91,184,245,0.09)',  anim: 'aurora-drift-1 22s ease-in-out infinite',          blur: 52 },
  // Cian eléctrico — derecha media
  { w: '55%', h: '55%', top: '18%',  right: '-8%',  color: 'rgba(34,211,238,0.07)',  anim: 'aurora-drift-2 26s ease-in-out infinite',          blur: 56 },
  // Violeta nebulosa — abajo izquierda
  { w: '52%', h: '52%', bottom: '-8%', left: '-6%', color: 'rgba(167,139,250,0.08)', anim: 'aurora-drift-3 30s ease-in-out infinite',          blur: 48 },
  // Rosa cósmico — abajo derecha, muy sutil
  { w: '38%', h: '38%', bottom: '8%', right: '8%',  color: 'rgba(244,114,182,0.05)', anim: 'aurora-drift-1 36s ease-in-out infinite reverse',  blur: 60 },
  // Azul profundo — centro, capa base
  { w: '45%', h: '45%', top: '30%',  left: '28%',   color: 'rgba(59,130,246,0.05)',  anim: 'aurora-drift-2 40s ease-in-out infinite reverse',  blur: 64 },
];

const PARTICLES = [
  { left:'7%',  top:'80%', size:2.5, color:'rgba(91,184,245,0.75)',  dur:'9s',  delay:'0s',   dx:'20px' },
  { left:'28%', top:'86%', size:3.5, color:'rgba(34,211,238,0.60)',  dur:'11s', delay:'3.0s', dx:'14px' },
  { left:'52%', top:'84%', size:2.5, color:'rgba(167,139,250,0.65)', dur:'10s', delay:'2.2s', dx:'18px' },
  { left:'73%', top:'79%', size:2,   color:'rgba(91,184,245,0.55)',  dur:'13s', delay:'1.0s', dx:'22px' },
  { left:'91%', top:'82%', size:2,   color:'rgba(34,211,238,0.60)',  dur:'12s', delay:'1.8s', dx:'10px' },
  { left:'47%', top:'89%', size:3,   color:'rgba(167,139,250,0.55)', dur:'10s', delay:'5.5s', dx:'16px' },
  { left:'15%', top:'75%', size:2,   color:'rgba(244,114,182,0.45)', dur:'14s', delay:'4.0s', dx:'12px' },
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
          top: n.top, left: (n as Record<string,string>).left, right: (n as Record<string,string>).right, bottom: (n as Record<string,string>).bottom,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${n.color} 0%, transparent 70%)`,
          animation: n.anim,
          transform: 'translateZ(0)',
          willChange: 'transform',
        }} />
      ))}
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: p.left, top: p.top,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          animation: `pp-float ${p.dur} ease-in infinite`,
          animationDelay: p.delay,
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
          ['--dx' as string]: p.dx,
        }} />
      ))}
    </div>
  );
});

export default AuroraBackground;
