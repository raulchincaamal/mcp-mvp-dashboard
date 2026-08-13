'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Theme = 'dark' | 'slate' | 'light';

const NAV_ITEMS = [
  {
    href: '/dynamic',
    label: 'Dashboard IA',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Dashboards',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v9H3z" /><path d="M14 3h7v5h-7z" /><path d="M14 12h7v9h-7z" /><path d="M3 16h7v5H3z" />
      </svg>
    ),
  },
];

const THEMES: { value: Theme; label: string; dot: string }[] = [
  { value: 'light',  label: 'Light',    dot: '#d8dfe8' },
  { value: 'slate',  label: 'Slate',    dot: '#282c34' },
  { value: 'dark',   label: 'Midnight', dot: '#0b0e17' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('light');
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mcp-theme') as Theme | null;
    const initial = saved ?? 'light';
    document.documentElement.setAttribute('data-theme', initial);
    setTheme(initial);
  }, []);

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('mcp-theme', t);
    setTheme(t);
    setThemeOpen(false);
  }

  return (
    <header style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 56,
      background: 'var(--navbar-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.5rem',
      gap: '1.5rem',
      zIndex: 100,
    }}>
      {/* Logo */}
      <button
        onClick={() => router.push('/dynamic')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
      >
        <div style={{
          width: 30, height: 30,
          background: 'linear-gradient(135deg, var(--primary) 0%, #5E5CE6 100%)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem',
          boxShadow: '0 2px 8px rgba(73,164,216,0.35)',
        }}>
          ✦
        </div>
        <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '-0.2px' }}>
          MCP Dashboard
        </span>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', flexShrink: 0 }} />

      {/* Nav links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: active ? 'var(--primary-light)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--text-tertiary)',
                fontWeight: active ? 600 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'background var(--t-fast) var(--ease-out-expo), color var(--t-fast) var(--ease-out-expo)',
                fontFamily: 'inherit',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
              {active && (
                <span style={{
                  position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
                  width: 20, height: 2, borderRadius: 99,
                  background: 'var(--primary)',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme switcher */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setThemeOpen((o) => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.35rem 0.65rem',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
            fontSize: '0.8rem',
            fontWeight: 500,
            transition: 'background var(--t-fast) var(--ease-out-expo)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
        >
          <span style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            background: THEMES.find(t => t.value === theme)?.dot,
            border: '1px solid rgba(255,255,255,0.2)',
          }} />
          {THEMES.find(t => t.value === theme)?.label}
          <span style={{ fontSize: '0.55rem', opacity: 0.5, transform: themeOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast) var(--ease-out-expo)' }}>▼</span>
        </button>

        {themeOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              onClick={() => setThemeOpen(false)}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#1a1d27',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              minWidth: 140,
              zIndex: 200,
              animation: 'fadeSlideUp 0.15s var(--ease-out-expo) both',
            }}>
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => applyTheme(t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.6rem 0.875rem',
                    background: theme === t.value ? 'rgba(73,164,216,0.12)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => { if (theme !== t.value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { if (theme !== t.value) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.dot, border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: theme === t.value ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                      {t.label}
                    </span>
                  </span>
                  {theme === t.value && <span style={{ fontSize: '0.7rem', color: '#49a4d8' }}>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
