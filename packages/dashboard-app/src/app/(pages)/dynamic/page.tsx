'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Card, Text } from '@macropaytd/lib-front-ui-components';
import { useT } from '@/shared/i18n';
import DynamicRenderer, { type UIConfig } from './components/DynamicRenderer';

const MCP_MAIN_URL =
  process.env.NEXT_PUBLIC_MCP_MAIN_URL || 'http://localhost:4000';

const DATASET = 'ventas-credito';

export default function DynamicPage() {
  const { t } = useT();
  const [intent, setIntent] = useState('');
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!intent.trim()) return;

    setLoading(true);
    setError(null);
    setUiConfig(null);

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

      setUiConfig(json.data as UIConfig);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [intent]);

  return (
    <main className="flex flex-col gap-6 p-6">
      <Text size="xl" weight="bold">
        {t('dynamic.title')}
      </Text>
      <Text size="sm" className="text-muted-foreground">
        {t('dynamic.description')}
      </Text>

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

      {uiConfig && (
        <div className="mt-4">
          <DynamicRenderer config={uiConfig} />
        </div>
      )}
    </main>
  );
}

