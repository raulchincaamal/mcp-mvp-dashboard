'use client';

import { useRouter } from 'next/navigation';
import { Button, Text } from '@macropaytd/lib-front-ui-components';
import { useT } from '@/shared/i18n';

export default function Home() {
  const { t } = useT();
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Text size="xl" weight="bold">
          {t('home.title')}
        </Text>
        <Text size="base" className="text-muted-foreground">
          {t('home.description')}
        </Text>
        <Button variant="default" onClick={() => router.push('/dashboard')}>
          {t('home.go_to_dashboard')}
        </Button>
      </div>
    </main>
  );
}

