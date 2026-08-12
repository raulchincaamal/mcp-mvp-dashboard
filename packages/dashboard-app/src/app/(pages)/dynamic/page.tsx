'use client';

import { useState } from 'react';
import DynamicRenderer, { type UIConfig } from '@/shared/components/DynamicRenderer';

const API_URL = process.env.NEXT_PUBLIC_MCP_API_URL ?? 'http://localhost:4000';

const EXAMPLE_INTENTS = [
  'resumen ejecutivo de ventas',
  'gráfica de ventas de motos por estado',
  'tabla de las últimas 20 ventas de celulares',
  'estatus de créditos atrasados',
  'análisis por categoría',
];

export default function DynamicPage() {
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent.trim()) return;
    setLoading(true);
    setError(null);
    setUiConfig(null);
    try {
      const res = await fetch(`${API_URL}/api/generate-ui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: intent.trim(), dataset: 'ventas-credito' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Error generando el dashboard');
      setUiConfig(json.data as UIConfig);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ animation: 'fadeSlideUp 0.5s var(--ease-out-expo) both' }}>
        <h1 style={{
          fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.6px', lineHeight: 1.15,
          background: 'linear-gradient(135deg, var(--text) 0%, var(--primary) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          Dashboard IA
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
          Describe en español qué quieres ver y el sistema generará el dashboard automáticamente.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeSlideUp 0.5s 0.08s var(--ease-out-expo) both' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="ej: gráfica de ventas de motos por estado"
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--surface)',
              backdropFilter: 'var(--surface-blur)',
              WebkitBackdropFilter: 'var(--surface-blur)',
              border: '1.5px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              color: 'var(--text)',
              outline: 'none',
              transition: 'border-color var(--t-fast) var(--ease-out-expo), box-shadow var(--t-fast) var(--ease-out-expo)',
              opacity: loading ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-light), 0 0 12px rgba(73,164,216,0.08)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={loading || !intent.trim()}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading || !intent.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !intent.trim() ? 0.5 : 1,
              boxShadow: '0 2px 8px rgba(73,164,216,0.3)',
              transition: 'transform var(--t-fast) var(--ease-spring), filter var(--t-fast) var(--ease-out-expo), box-shadow var(--t-normal) var(--ease-out-expo)',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!loading && intent.trim()) {
                e.currentTarget.style.filter = 'brightness(1.1)';
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(73,164,216,0.45)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = '';
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(73,164,216,0.3)';
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; }}
          >
            {loading ? 'Generando...' : 'Generar'}
          </button>
        </div>

        {/* Example chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {EXAMPLE_INTENTS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setIntent(ex)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 20,
                padding: '0.3rem 0.875rem',
                fontSize: '0.78rem',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'background var(--t-fast) var(--ease-out-expo), color var(--t-fast) var(--ease-out-expo), border-color var(--t-fast) var(--ease-out-expo)',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--primary-light)';
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: 'var(--surface)',
          backdropFilter: 'var(--surface-blur)',
          WebkitBackdropFilter: 'var(--surface-blur)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          animation: 'fadeSlideUp 0.3s var(--ease-out-expo) both',
        }}>
          <div style={{
            width: 20, height: 20, flexShrink: 0,
            border: '2px solid var(--primary)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Bedrock está orquestando tu dashboard...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(255,69,58,0.08)',
          border: '1.5px solid rgba(255,69,58,0.35)',
          borderRadius: 'var(--radius)',
          padding: '1rem 1.25rem',
          fontSize: '0.875rem',
          color: 'var(--danger)',
          animation: 'fadeSlideUp 0.3s var(--ease-out-expo) both',
        }}>
          {error}
        </div>
      )}

      {/* Result */}
      {uiConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeSlideUp 0.4s var(--ease-out-expo) both' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)' }}>
              {uiConfig.title}
            </h2>
            {uiConfig.description && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {uiConfig.description}
              </p>
            )}
          </div>
          <DynamicRenderer config={uiConfig} />
        </div>
      )}
    </div>
  );
}
