'use client';

import { useRouter } from 'next/navigation';
import { ThemeToggle, Button } from '@macropaytd/lib-front-ui-components';
import { useT } from '@/shared/i18n';

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="text-lg font-bold"
        >
          {t('nav.app_name')}
        </Button>
        <ThemeToggle />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

