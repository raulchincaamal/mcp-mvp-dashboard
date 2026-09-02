'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Theme = 'dark' | 'slate' | 'light';

const NAV_ITEMS = [
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
  { value: 'light', label: 'Light',   dot: '#d8dfe8' },
  { value: 'slate', label: 'Slate',   dot: '#282c34' },
  { value: 'dark',  label: 'Midnight', dot: '#0b0e17' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('dark');
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as Theme | null;
    if (current) setTheme(current);
  }, []);

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
    setTheme(t);
    setThemeOpen(false);
  }

  return (
    <aside style={{
      width: 248,
      background: 'var(--sidebar-bg)',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, minWidth: 36,
            background: 'linear-gradient(135deg, var(--primary) 0%, #5E5CE6 100%)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem',
            boxShadow: '0 2px 10px rgba(73,164,216,0.35)',
          }}>
            ✦
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.2px' }}>
              MCP Dashboard
            </div>
            <div style={{ color: 'var(--sidebar-text)', fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Pipeline IA
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                borderLeft: `2px solid ${active ? 'var(--sidebar-active-border)' : 'transparent'}`,
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                fontWeight: active ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'background var(--t-fast) var(--ease-out-expo), color var(--t-fast) var(--ease-out-expo)',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', width: 18, height: 18, flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer — theme switcher */}
      <div style={{ padding: '0.75rem 1.25rem 1rem', borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
        <button
          onClick={() => setThemeOpen((o) => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%',
            background: 'var(--sidebar-surface)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            color: 'var(--sidebar-text)',
            fontFamily: 'inherit',
            transition: 'background var(--t-fast) var(--ease-out-expo)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: THEMES.find(t => t.value === theme)?.dot,
              border: '1px solid rgba(255,255,255,0.2)',
            }} />
            {THEMES.find(t => t.value === theme)?.label}
          </span>
          <span style={{ fontSize: '0.6rem', opacity: 0.5, transform: themeOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast) var(--ease-out-expo)' }}>▼</span>
        </button>

        {themeOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% - 0.75rem)', left: '1.25rem', right: '1.25rem',
            background: 'var(--sidebar-bg)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 200,
          }}>
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => applyTheme(t.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '0.6rem 0.875rem',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background var(--t-fast) var(--ease-out-expo)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.dot, border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: theme === t.value ? '#fff' : 'var(--sidebar-text)' }}>
                    {t.label}
                  </span>
                </span>
                {theme === t.value && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
