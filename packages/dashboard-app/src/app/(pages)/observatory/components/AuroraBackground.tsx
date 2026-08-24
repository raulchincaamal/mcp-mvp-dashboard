'use client';

const NEBULAS = [
  { w: '65%', h: '65%', top: '-10%', left: '15%',  color: 'rgba(124,111,255,0.13)', anim: 'aurora-drift-1 20s ease-in-out infinite',         blur: 48 },
  { w: '55%', h: '55%', top: '20%',  right: '-5%', color: 'rgba(6,182,212,0.11)',   anim: 'aurora-drift-2 24s ease-in-out infinite',         blur: 52 },
  { w: '50%', h: '50%', bottom: '-5%', left: '-5%', color: 'rgba(52,211,153,0.09)', anim: 'aurora-drift-3 28s ease-in-out infinite',         blur: 44 },
  { w: '40%', h: '40%', bottom: '10%', right: '10%', color: 'rgba(244,114,182,0.07)', anim: 'aurora-drift-1 32s ease-in-out infinite reverse', blur: 56 },
];

const PARTICLES = [
  { left:'8%',  top:'82%', size:3, color:'rgba(124,111,255,0.7)', dur:'9s',  delay:'0s',   dx:'22px'  },
  { left:'18%', top:'75%', size:2, color:'rgba(6,182,212,0.6)',   dur:'12s', delay:'1.8s', dx:'-18px' },
  { left:'30%', top:'88%', size:4, color:'rgba(52,211,153,0.55)', dur:'10s', delay:'3.2s', dx:'14px'  },
  { left:'42%', top:'78%', size:2, color:'rgba(244,114,182,0.6)', dur:'14s', delay:'0.6s', dx:'-22px' },
  { left:'53%', top:'85%', size:3, color:'rgba(124,111,255,0.5)', dur:'11s', delay:'2.5s', dx:'18px'  },
  { left:'63%', top:'72%', size:5, color:'rgba(6,182,212,0.45)',  dur:'8s',  delay:'4.2s', dx:'-10px' },
  { left:'74%', top:'80%', size:2, color:'rgba(52,211,153,0.6)',  dur:'13s', delay:'1.1s', dx:'20px'  },
  { left:'84%', top:'76%', size:3, color:'rgba(251,146,60,0.5)',  dur:'9s',  delay:'5.5s', dx:'-14px' },
  { left:'92%', top:'83%', size:2, color:'rgba(167,139,250,0.6)', dur:'11s', delay:'2s',   dx:'10px'  },
  { left:'22%', top:'92%', size:2, color:'rgba(244,114,182,0.4)', dur:'15s', delay:'0.3s', dx:'-8px'  },
  { left:'48%', top:'90%', size:3, color:'rgba(99,102,241,0.5)',  dur:'10s', delay:'6s',   dx:'16px'  },
  { left:'70%', top:'88%', size:2, color:'rgba(52,211,153,0.45)', dur:'12s', delay:'3.8s', dx:'-20px' },
];

interface Props {
  /** fixed = landing (cubre toda la pantalla), absolute = dentro de un contenedor */
  position?: 'fixed' | 'absolute';
}

export default function AuroraBackground({ position = 'absolute' }: Props) {
  return (
    <div aria-hidden style={{ position, inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {NEBULAS.map((n, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: n.w, height: n.h,
          top: n.top, left: (n as Record<string,string>).left, right: (n as Record<string,string>).right, bottom: (n as Record<string,string>).bottom,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${n.color} 0%, transparent 70%)`,
          animation: n.anim,
          filter: `blur(${n.blur}px)`,
        }} />
      ))}
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: p.left, top: p.top,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          boxShadow: `0 0 ${p.size * 4}px ${p.size}px ${p.color}`,
          animation: `pp-float ${p.dur} ease-in infinite`,
          animationDelay: p.delay,
          ['--dx' as string]: p.dx,
        }} />
      ))}
    </div>
  );
}
