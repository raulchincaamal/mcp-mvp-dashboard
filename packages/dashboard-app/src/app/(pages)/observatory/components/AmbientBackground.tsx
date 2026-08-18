'use client';

import { useRef, useEffect, useState } from 'react';
import type { CursorState } from '../hooks/useCursor';

interface Props {
  cursor: CursorState;
  centerElement?: HTMLElement | null; // Reference to CoreLight container
}

interface OrbitingChart {
  id: number;
  type: 'bar' | 'line' | 'pie' | 'scatter';
  angle: number;
  radius: number;
  speed: number;
  size: number;
}

const CHARTS: OrbitingChart[] = [
  { id: 1, type: 'bar', angle: 0, radius: 220, speed: 0.0004, size: 70 },
  { id: 2, type: 'line', angle: Math.PI * 0.5, radius: 260, speed: -0.0005, size: 90 },
  { id: 3, type: 'pie', angle: Math.PI, radius: 200, speed: 0.0006, size: 60 },
  { id: 4, type: 'scatter', angle: Math.PI * 1.5, radius: 280, speed: -0.0004, size: 80 },
  { id: 5, type: 'bar', angle: Math.PI * 0.25, radius: 300, speed: 0.0003, size: 65 },
  { id: 6, type: 'line', angle: Math.PI * 1.25, radius: 240, speed: -0.0003, size: 75 },
];

export default function AmbientBackground({ cursor, centerElement }: Props) {
  const [positions, setPositions] = useState<{ x: number; y: number }[]>(
    CHARTS.map(() => ({ x: 0, y: 0 }))
  );
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const anglesRef = useRef(CHARTS.map(c => c.angle));
  const [windowSize, setWindowSize] = useState({ w: 1920, h: 1080 });

  // Track window size
  useEffect(() => {
    const update = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Track center element position
  useEffect(() => {
    if (!centerElement) {
      // Default to screen center if no element provided
      setCenter({ x: windowSize.w / 2, y: windowSize.h / 2 });
      return;
    }

    const updateCenter = () => {
      const rect = centerElement.getBoundingClientRect();
      setCenter({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    };

    updateCenter();
    const interval = setInterval(updateCenter, 100); // Update periodically
    return () => clearInterval(interval);
  }, [centerElement, windowSize]);

  // Animate orbits
  useEffect(() => {
    let raf: number;
    const animate = () => {
      const offsetX = cursor.normalizedX * 20;
      const offsetY = cursor.normalizedY * 15;

      const newPositions = CHARTS.map((chart, i) => {
        anglesRef.current[i] += chart.speed;
        const angle = anglesRef.current[i];
        return {
          x: center.x + offsetX + Math.cos(angle) * chart.radius,
          y: center.y + offsetY + Math.sin(angle) * chart.radius,
        };
      });

      setPositions(newPositions);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [cursor.normalizedX, cursor.normalizedY, center]);

  const adjustedCenter = {
    x: center.x + cursor.normalizedX * 20,
    y: center.y + cursor.normalizedY * 15,
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      background: 'var(--bg)',
      overflow: 'hidden',
      transition: 'background 0.3s ease',
    }}>
      {/* Aurora layers */}
      <div style={{
        position: 'absolute', top: '5%', left: '25%', width: '60vw', height: '50vh',
        background: 'radial-gradient(ellipse at center, var(--primary-light) 0%, transparent 70%)',
        filter: 'blur(80px)', animation: 'float1 25s ease-in-out infinite', opacity: 0.5,
      }} />
      <div style={{
        position: 'absolute', top: '35%', right: '15%', width: '50vw', height: '45vh',
        background: 'radial-gradient(ellipse at center, rgba(120, 80, 180, 0.08) 0%, transparent 70%)',
        filter: 'blur(100px)', animation: 'float2 30s ease-in-out infinite',
      }} />

      {/* Connection lines SVG */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox={`0 0 ${windowSize.w} ${windowSize.h}`}
      >
        {/* Lines from center to each chart */}
        {positions.map((pos, i) => (
          <g key={CHARTS[i].id}>
            {/* Connection line */}
            <line
              x1={adjustedCenter.x}
              y1={adjustedCenter.y}
              x2={pos.x}
              y2={pos.y}
              stroke="var(--primary)"
              strokeWidth="1"
              opacity="0.12"
              strokeDasharray="6 6"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="12"
                dur="1s"
                repeatCount="indefinite"
              />
            </line>
            {/* Node at chart position */}
            <circle cx={pos.x} cy={pos.y} r="5" fill="var(--primary)" opacity="0.25" />
            {/* Pulse ring */}
            <circle cx={pos.x} cy={pos.y} r="5" fill="none" stroke="var(--primary)" strokeWidth="1" opacity="0.15">
              <animate attributeName="r" from="5" to="25" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.2" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* Orbiting charts */}
      {CHARTS.map((chart, i) => (
        <div
          key={chart.id}
          style={{
            position: 'absolute',
            left: positions[i].x - chart.size / 2,
            top: positions[i].y - chart.size / 2,
            width: chart.size,
            height: chart.size * 0.65,
            opacity: 0.1,
          }}
        >
          {chart.type === 'bar' && <GhostBarChart />}
          {chart.type === 'line' && <GhostLineChart />}
          {chart.type === 'pie' && <GhostPieChart />}
          {chart.type === 'scatter' && <GhostScatterChart />}
        </div>
      ))}

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(var(--border-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--border-color) 1px, transparent 1px)`,
        backgroundSize: '100px 100px', opacity: 0.15,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, var(--bg) 100%)',
        opacity: 0.7,
      }} />

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -20px) scale(1.05); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-35px, 25px); }
        }
      `}</style>
    </div>
  );
}

function GhostBarChart() {
  const bars = [0.4, 0.75, 0.5, 0.9, 0.6];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', gap: 3 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, background: 'var(--primary)', borderRadius: 2,
          height: `${h * 100}%`,
          animation: `barPulse 3s ease-in-out ${i * 0.2}s infinite`,
          transformOrigin: 'bottom',
        }} />
      ))}
      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.7); }
        }
      `}</style>
    </div>
  );
}

function GhostLineChart() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
      <path
        d="M0,50 Q20,40 30,30 T60,35 T100,20"
        fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray="150" strokeDashoffset="0"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="300" dur="4s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function GhostPieChart() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="22" fill="none" stroke="var(--primary)" strokeWidth="5"
        strokeDasharray="45 20 30 45" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 30 30" to="360 30 30" dur="10s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function GhostScatterChart() {
  const points = [[20, 35], [35, 20], [50, 40], [65, 25], [80, 32]];
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 60">
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="var(--primary)">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
          <animate attributeName="r" values="4;2;4" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
