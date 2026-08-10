'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Card, Text } from '@macropaytd/lib-front-ui-components';
import { useT } from '@/shared/i18n';

const MCP_MAIN_URL =
  process.env.NEXT_PUBLIC_MCP_MAIN_URL || 'http://localhost:4000';

const DATASET = 'ventas-credito';

export default function Home() {
  const { t } = useT();
  const [intent, setIntent] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!intent.trim()) return;

    setLoading(true);
    setError(null);
    setGeneratedUrl(null);

    try {
      const res = await fetch(`${MCP_MAIN_URL}/api/generate-ui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: DATASET, intent }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Error generating UI');
        return;
      }

      const dashboardUrl = `${window.location.origin}/dashboard?key=${json.key}`;
      setGeneratedUrl(dashboardUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [intent]);

  const handleCopyUrl = useCallback(() => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
    }
  }, [generatedUrl]);

  return (
    <main className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="space-y-2">
        <Text size="xl" weight="bold">
          {t('home.title')}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {t('home.description')}
        </Text>
      </div>

      <Card className="p-4 space-y-4">
        <Input
          label={t('dynamic.intent_label')}
          placeholder={t('dynamic.intent_placeholder')}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />

        <Button
          variant="default"
          onClick={handleGenerate}
          disabled={loading || !intent.trim()}
        >
          {loading ? t('dynamic.generating') : t('dynamic.generate')}
        </Button>

        {error && (
          <Text size="sm" className="text-destructive">
            {error}
          </Text>
        )}
      </Card>

      {generatedUrl && (
        <Card className="p-4 space-y-3">
          <Text size="sm" weight="bold">
            Dashboard generado:
          </Text>
          <div className="flex items-center gap-2">
            <Input
              value={generatedUrl}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleCopyUrl}>
              Copiar
            </Button>
          </div>
          <a
            href={generatedUrl}
            className="text-sm text-primary underline hover:no-underline"
          >
            Abrir dashboard →
          </a>
        </Card>
      )}
    </main>
  );
}

