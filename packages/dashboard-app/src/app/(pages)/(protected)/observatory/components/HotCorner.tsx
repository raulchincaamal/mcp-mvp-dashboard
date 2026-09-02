'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

type Theme = 'dark' | 'slate' | 'light';

const THEMES: { value: Theme; label: string; dot: string }[] = [
  { value: 'dark',   label: 'Midnight', dot: '#080c14' },
  { value: 'slate',  label: 'Slate',    dot: '#1e2230' },
  { value: 'light',  label: 'Light',    dot: '#e8ecf4' },
];

const TRIGGER_ZONE = 80; // px from corner to trigger

export default function HotCorner({ enabled = true }: { enabled?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef       = useRef<HTMLDivElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const hideTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mcp-theme') as Theme | null;
    const initial = (saved ?? 'dark') as Theme;
    setTheme(initial);
    // Ensure DOM reflects the saved/default theme on mount
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  useEffect(() => {
    if (!enabled && visible) setVisible(false);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!enabled) {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => setVisible(false), 0);
        return;
      }
      const nearCorner =
        e.clientX < TRIGGER_ZONE &&
        e.clientY > window.innerHeight - TRIGGER_ZONE;

      if (nearCorner) {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        if (!visible) setVisible(true);
      } else {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => setVisible(false), 600);
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [visible, enabled]);

  // Animate in/out
  useEffect(() => {
    if (!dotRef.current || !panelRef.current) return;
    if (visible) {
      gsap.to(dotRef.current, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' });
      gsap.to(panelRef.current, { opacity: 1, x: 0, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.05 });
    } else {
      gsap.to(dotRef.current, { opacity: 0, scale: 0.4, duration: 0.25, ease: 'power2.in' });
      gsap.to(panelRef.current, { opacity: 0, x: -8, y: 8, duration: 0.25, ease: 'power2.in' });
    }
  }, [visible]);

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('mcp-theme', t);
    setTheme(t);
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        zIndex: 999,
        padding: '0 0 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Theme panel */}
      <div
        ref={panelRef}
        style={{
          opacity: 0,
          transform: 'translate(-8px, 8px)',
          background: '#0e1220',
          border: '1px solid rgba(91,184,245,0.14),',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(91,184,245,0.12),',
          overflow: 'hidden',
          minWidth: 140,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '8px 12px 6px',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          Tema
        </div>
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => applyTheme(t.value)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '8px 12px',
              background: theme === t.value ? 'rgba(91,184,245,0.14)' : 'transparent',
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { if (theme !== t.value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { if (theme !== t.value) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: t.dot,
                border: '1px solid rgba(255,255,255,0.25)',
                flexShrink: 0,
                boxShadow: theme === t.value ? `0 0 8px ${t.dot}` : 'none',
              }} />
              <span style={{
                fontSize: 12, fontWeight: theme === t.value ? 600 : 400,
                color: theme === t.value ? '#fff' : 'rgba(255,255,255,0.5)',
              }}>
                {t.label}
              </span>
            </span>
            {theme === t.value && (
              <span style={{ fontSize: 10, color: '#5bb8f5' }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Corner dot indicator */}
      <div
        ref={dotRef}
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--primary)',
          boxShadow: '0 0 12px var(--primary)',
          opacity: 0, scale: '0.4',
          marginLeft: 4,
        }}
      />
    </div>
  );
}
