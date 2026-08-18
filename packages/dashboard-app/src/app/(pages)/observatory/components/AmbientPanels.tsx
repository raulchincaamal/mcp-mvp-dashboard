'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import GlassPanel from './GlassPanel';
import type { CursorState } from '../hooks/useCursor';

interface Props {
  cursor: CursorState;
  visible: boolean;
}

interface AmbientMetric {
  label: string;
  baseValue: number;
  suffix: string;
  prefix: string;
  variance: number;
}

const METRICS: AmbientMetric[] = [
  { label: 'REVENUE', baseValue: 12.4, suffix: '%', prefix: '+', variance: 5 },
  { label: 'SALES', baseValue: 18.4, suffix: 'K', prefix: '', variance: 3 },
  { label: 'CUSTOMERS', baseValue: 8.2, suffix: '%', prefix: '+', variance: 4 },
  { label: 'GROWTH', baseValue: 24, suffix: '%', prefix: '', variance: 8 },
];

const POSITIONS = [
  { top: '15%', left: '8%', depth: 0.3 },
  { top: '12%', right: '10%', depth: 0.5 },
  { bottom: '25%', left: '10%', depth: 0.4 },
  { bottom: '18%', right: '12%', depth: 0.6 },
];

function getColor(value: number, base: number): string {
  const diff = value - base;
  if (diff > 2) return 'var(--accent-color)';
  if (diff < -2) return 'var(--danger)';
  if (diff > 0) return 'var(--primary)';
  return 'var(--warning)';
}

function AnimatedValue({ metric }: { metric: AmbientMetric }) {
  const [value, setValue] = useState(metric.baseValue);
  const [color, setColor] = useState('var(--primary)');
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const newValue = metric.baseValue + (Math.random() - 0.5) * metric.variance * 2;
      const rounded = Math.round(newValue * 10) / 10;
      
      // Animate the change
      if (valueRef.current) {
        gsap.to(valueRef.current, {
          scale: 1.1,
          duration: 0.15,
          ease: 'power2.out',
          onComplete: () => {
            setValue(rounded);
            setColor(getColor(rounded, metric.baseValue));
            gsap.to(valueRef.current, {
              scale: 1,
              duration: 0.3,
              ease: 'elastic.out(1, 0.5)',
            });
          },
        });
      }
    }, 2000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [metric]);

  const isPositive = value >= metric.baseValue;
  const arrow = metric.label === 'GROWTH' ? (isPositive ? '↗' : '↘') : '';

  return (
    <span
      ref={valueRef}
      style={{
        color,
        display: 'inline-block',
        transition: 'color 0.3s ease',
        textShadow: `0 0 20px ${color}40`,
      }}
    >
      {arrow}{metric.prefix}{value.toFixed(1)}{metric.suffix}
    </span>
  );
}

export default function AmbientPanels({ cursor, visible }: Props) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return;
      gsap.to(el, {
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.85,
        duration: 0.8,
        delay: visible ? i * 0.15 : 0,
        ease: 'power3.out',
      });
    });
  }, [visible]);

  return (
    <>
      {METRICS.map((metric, i) => (
        <div
          key={metric.label}
          ref={el => { refs.current[i] = el; }}
          style={{
            position: 'absolute',
            ...POSITIONS[i],
            opacity: 0,
            zIndex: 2,
          }}
        >
          <GlassPanel cursor={cursor} depth={POSITIONS[i].depth}>
            <div style={{ padding: '18px 24px', minWidth: 110 }}>
              <p style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: 'var(--text-tertiary)',
                margin: 0,
                textTransform: 'uppercase',
              }}>
                {metric.label}
              </p>
              <p style={{
                fontSize: 26,
                fontWeight: 700,
                margin: '6px 0 0',
                letterSpacing: '-0.02em',
              }}>
                <AnimatedValue metric={metric} />
              </p>
            </div>
          </GlassPanel>
        </div>
      ))}
    </>
  );
}
