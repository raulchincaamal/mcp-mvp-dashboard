'use client';

import { useState, useRef, useEffect } from 'react';
import DynamicRenderer, { type UIConfig } from '@/shared/components/DynamicRenderer';

const API_URL = process.env.NEXT_PUBLIC_MCP_API_URL ?? 'http://localhost:4000';

const EXAMPLE_INTENTS = [
  { label: 'Resumen ejecutivo', intent: 'resumen ejecutivo de ventas', icon: '📊' },
  { label: 'Motos por estado', intent: 'gráfica de ventas de motos por estado', icon: '🏍️' },
  { label: 'Últimas ventas', intent: 'tabla de las últimas 20 ventas de celulares', icon: '📱' },
  { label: 'Créditos atrasados', intent: 'estatus de créditos atrasados', icon: '⚠️' },
  { label: 'Por categoría', intent: 'análisis por categoría', icon: '🗂️' },
];

const LOADING_MESSAGES = [
  'Interpretando tu intent con Bedrock...',
  'Consultando el dataset de ventas...',
  'Seleccionando componentes UI...',
  'Generando el dashboard...',
];

export default function DynamicPage() {
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credExpired, setCredExpired] = useState(false);
  const [resultKey, setResultKey] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use refs for values needed inside polling closure
  const pollingHashRef = useRef<string | null>(null);

  // Polling: single interval, uses refs to avoid stale closures
  useEffect(() => {
    async function checkLatest() {
      try {
        const res = await fetch(`${API_URL}/api/latest`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || !json.hash) return;

        if (json.hash === pollingHashRef.current) return;

        pollingHashRef.current = json.hash;

        if (json.status === 'processing') {
          setUiConfig(null);
          setError(null);
          setLoading(true);
          setChatOpen(false);
          // Clear any previous timeout
          if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = setTimeout(() => {
            processingTimeoutRef.current = null;
            setLoading(false);
            setError('El dashboard tardó demasiado. Intenta de nuevo.');
          }, 120000);
        } else if (json.status === 'ready' && json.data) {
          // Cancel timeout — result arrived in time
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          setError(null);
          setCredExpired(false);
          setLoading(false);
          setUiConfig(json.data);
          setResultKey((k) => k + 1);
          setChatOpen(false);
        }
      } catch {
        // silently ignore — API may not be running
      }
    }

    pollingInterval.current = setInterval(checkLatest, 1000);
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    };
  }, []); // single interval, never recreated

  // Loading message rotation
  useEffect(() => {
    if (loading) {
      setLoadingMsg(0);
      loadingInterval.current = setInterval(() => {
        setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
      }, 1800);
    } else {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    }
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current); };
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent.trim()) return;
    setLoading(true);
    setError(null);
    setCredExpired(false);
    setUiConfig(null);
    try {
      const res = await fetch(`${API_URL}/api/generate-ui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: intent.trim(), dataset: 'ventas-credito' }),
      });
      const json = await res.json();
      if (res.status === 401 || json.code === 'AWS_CREDENTIALS_EXPIRED') {
        setCredExpired(true);
        return;
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Error generando el dashboard');
      setResultKey((k) => k + 1);
      setUiConfig(json.data as UIConfig);
      setChatOpen(false);
      // Sync polling hash so polling doesn't re-render the same result
      const latestRes = await fetch(`${API_URL}/api/latest`).catch(() => null);
      if (latestRes?.ok) {
        const latestJson = await latestRes.json();
        if (latestJson.hash) pollingHashRef.current = latestJson.hash;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleChip(ex: string) {
    setIntent(ex);
    inputRef.current?.focus();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Top bar: input area ─────────────────────────────── */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--surface)',
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        overflow: 'hidden',
        maxHeight: chatOpen ? 160 : 0,
        padding: chatOpen ? '1.25rem 2rem' : '0 2rem',
        transition: 'max-height var(--t-slow) var(--ease-in-out), padding var(--t-slow) var(--ease-in-out)',
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{
              width: 36, height: 36, flexShrink: 0,
              background: 'var(--primary-light)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}>✦</div>
            <input
              ref={inputRef}
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Describe el dashboard que quieres ver en español..."
              disabled={loading}
              autoFocus
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'inherit',
                opacity: loading ? 0.5 : 1,
              }}
            />
            <button
              type="submit"
              disabled={loading || !intent.trim()}
              style={{
                background: loading || !intent.trim() ? 'var(--surface-3)' : 'var(--primary)',
                color: loading || !intent.trim() ? 'var(--text-tertiary)' : '#fff',
                border: 'none', padding: '0.55rem 1.25rem', borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem', fontWeight: 600,
                cursor: loading || !intent.trim() ? 'not-allowed' : 'pointer',
                boxShadow: loading || !intent.trim() ? 'none' : '0 2px 8px rgba(73,164,216,0.3)',
                transition: 'all var(--t-fast) var(--ease-out-expo)',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
              onMouseEnter={e => {
                if (!loading && intent.trim()) {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(73,164,216,0.4)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = '';
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = loading || !intent.trim() ? 'none' : '0 2px 8px rgba(73,164,216,0.3)';
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 12, height: 12, border: '2px solid currentColor',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Generando
                </>
              ) : <>Generar →</>}
            </button>
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.875rem', paddingLeft: 44 }}>
            {EXAMPLE_INTENTS.map((ex) => (
              <button
                key={ex.intent}
                type="button"
                onClick={() => handleChip(ex.intent)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  background: intent === ex.intent ? 'var(--primary-light)' : 'var(--surface-2)',
                  border: `1px solid ${intent === ex.intent ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: 20, padding: '0.25rem 0.75rem',
                  fontSize: '0.78rem', fontWeight: 500,
                  color: intent === ex.intent ? 'var(--primary)' : 'var(--text-tertiary)',
                  cursor: 'pointer', transition: 'all var(--t-fast) var(--ease-out-expo)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  if (intent !== ex.intent) {
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (intent !== ex.intent) {
                    e.currentTarget.style.background = 'var(--surface-2)';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
              >
                <span>{ex.icon}</span>
                {ex.label}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* ── Content area ────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Loading */}
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '1.5rem', paddingTop: '5rem',
            animation: 'fadeSlideUp 0.3s var(--ease-out-expo) both',
          }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--primary-light)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>✦</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{LOADING_MESSAGES[loadingMsg]}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>Bedrock está orquestando tu dashboard</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {LOADING_MESSAGES.map((_, i) => (
                <div key={i} style={{
                  width: i === loadingMsg ? 20 : 6, height: 6, borderRadius: 99,
                  background: i === loadingMsg ? 'var(--primary)' : 'var(--border-color)',
                  transition: 'all 0.3s var(--ease-out-expo)',
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Credentials expired */}
        {credExpired && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', paddingTop: '4rem', textAlign: 'center', animation: 'fadeSlideUp 0.3s var(--ease-out-expo) both' }}>
            <div style={{ width: 56, height: 56, background: 'rgba(255,159,10,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>🔑</div>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Credenciales AWS expiradas</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.35rem', maxWidth: 420 }}>El token de sesión de AWS SSO ha expirado. Actualiza las variables en</p>
              <code style={{ display: 'inline-block', marginTop: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.8rem', color: 'var(--primary)', fontFamily: 'monospace' }}>packages/mcp-main/.env</code>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>y reinicia con <code style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>npm run dev:mcp-main</code></p>
            </div>
            <button onClick={() => { setCredExpired(false); setIntent(''); }} style={{ marginTop: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 1rem', fontSize: '0.82rem', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all var(--t-fast) var(--ease-out-expo)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>Reintentar</button>
          </div>
        )}

        {/* Error */}
        {error && !loading && !uiConfig && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', paddingTop: '4rem', textAlign: 'center', animation: 'fadeSlideUp 0.3s var(--ease-out-expo) both' }}>
            <div style={{ width: 56, height: 56, background: 'rgba(255,69,58,0.08)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>⚠️</div>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}>Error al generar el dashboard</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.35rem', maxWidth: 420 }}>{error}</p>
            </div>
            <button onClick={() => { setError(null); inputRef.current?.focus(); }} style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 1rem', fontSize: '0.82rem', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all var(--t-fast) var(--ease-out-expo)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>Reintentar</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !uiConfig && !credExpired && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', paddingTop: '5rem', textAlign: 'center', animation: 'fadeSlideUp 0.5s 0.1s var(--ease-out-expo) both' }}>
            <div style={{ width: 80, height: 80, background: 'var(--primary-light)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', boxShadow: '0 0 40px rgba(73,164,216,0.15)' }}>✦</div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text)' }}>Dashboard IA</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', marginTop: '0.4rem', maxWidth: 380 }}>Describe en español qué quieres visualizar y Bedrock generará el dashboard automáticamente.</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {['Gráficas', 'KPIs', 'Tablas', 'Análisis por categoría', 'Estatus de créditos'].map((f) => (
                <span key={f} style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '0.3rem 0.875rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {uiConfig && !loading && (
          <div key={resultKey} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeSlideDown 0.4s var(--ease-out-expo) both' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.4px', background: 'linear-gradient(135deg, var(--text) 0%, var(--primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {uiConfig.title}
                </h2>
                {uiConfig.description && (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{uiConfig.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => setChatOpen(o => !o)}
                  style={{
                    background: chatOpen ? 'var(--primary-light)' : 'var(--surface)',
                    border: `1px solid ${chatOpen ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.875rem',
                    fontSize: '0.8rem', fontWeight: 500,
                    color: chatOpen ? 'var(--primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all var(--t-fast) var(--ease-out-expo)',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}
                  onMouseEnter={e => { if (!chatOpen) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; } }}
                  onMouseLeave={e => { if (!chatOpen) { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-tertiary)'; } }}
                >
                  <span style={{ display: 'inline-block', transition: 'transform var(--t-normal) var(--ease-spring)', transform: chatOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>↑</span>
                  {chatOpen ? 'Ocultar' : 'Chat'}
                </button>
                <button
                  onClick={() => { setUiConfig(null); setIntent(''); setChatOpen(true); inputRef.current?.focus(); }}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.875rem', fontSize: '0.8rem', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all var(--t-fast) var(--ease-out-expo)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  ‹ Nuevo
                </button>
              </div>
            </div>
            <DynamicRenderer key={resultKey} config={uiConfig} animated />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
