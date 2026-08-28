'use client';

import React from 'react';

interface Nebula {
  w: string; h: string;
  top?: string; bottom?: string; left?: string; right?: string;
  color: string; anim: string; blur: number;
}

const NEBULAS: Nebula[] = [
  // Azul estelar principal — arriba centro, movimiento amplio
  { w: '75%', h: '75%', top: '-18%', left: '8%',    color: 'rgba(91,184,245,0.11)',  anim: 'aurora-drift-1 18s ease-in-out infinite',         blur: 50 },
  // Cian eléctrico — derecha, movimiento rápido
  { w: '58%', h: '58%', top: '15%',  right: '-10%', color: 'rgba(0,212,168,0.08)',   anim: 'aurora-drift-2 14s ease-in-out infinite',         blur: 54 },
  // Violeta nebulosa — abajo izquierda, lento y amplio
  { w: '56%', h: '56%', bottom: '-10%', left: '-8%',color: 'rgba(167,139,250,0.10)', anim: 'aurora-drift-3 22s ease-in-out infinite',         blur: 46 },
  // Rosa cósmico — abajo derecha, movimiento medio
  { w: '42%', h: '42%', bottom: '5%', right: '5%',  color: 'rgba(244,114,182,0.07)', anim: 'aurora-drift-4 16s ease-in-out infinite',         blur: 58 },
  // Azul profundo — centro, muy lento, capa base
  { w: '50%', h: '50%', top: '28%',  left: '25%',   color: 'rgba(59,130,246,0.07)',  anim: 'aurora-drift-1 32s ease-in-out infinite reverse', blur: 62 },
  // Cian secundario — arriba derecha, rápido
  { w: '35%', h: '35%', top: '-5%',  right: '15%',  color: 'rgba(34,211,238,0.06)',  anim: 'aurora-drift-2 12s ease-in-out infinite reverse', blur: 48 },
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
          top: n.top, left: n.left, right: n.right, bottom: n.bottom,
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
