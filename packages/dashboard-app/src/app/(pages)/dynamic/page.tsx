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

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Error generando el dashboard');
      }

      setUiConfig(json.data as UIConfig);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard Dinámico</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe en español qué quieres ver y el sistema generará el dashboard automáticamente.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="ej: gráfica de ventas de motos por estado"
            disabled={loading}
            className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !intent.trim()}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? 'Generando...' : 'Generar'}
          </button>
        </div>

        {/* Example intents */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_INTENTS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setIntent(ex)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Bedrock está orquestando tu dashboard...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {uiConfig && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{uiConfig.title}</h2>
          <DynamicRenderer config={uiConfig} />
        </div>
      )}
    </div>
  );
}
