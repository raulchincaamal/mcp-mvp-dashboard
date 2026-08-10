import { redirect } from 'next/navigation';
import { RedisCache } from '@mp-front/common/cache-providers';
import DashboardContainer from './components/Container';

const CACHE_PREFIX = 'mcp-dashboard';

async function getUIConfig(
  key: string,
): Promise<{ data: unknown; error?: string } | null> {
  try {
    const redis = new RedisCache<unknown>();
    const fullKey = key.includes(':') ? key : `${CACHE_PREFIX}:ui:${key}`;
    const result = await redis.simpleGet(fullKey);

    if (!result) {
      return { data: null, error: 'UIConfig not found. It may have expired.' };
    }

    return { data: JSON.parse(result) };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}

interface DashboardPageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { key } = await searchParams;

  if (!key) {
    redirect('/');
  }

  const result = await getUIConfig(key);

  if (!result || result.error) {
    return (
      <main className="flex flex-col items-center justify-center gap-4 p-6 min-h-[50vh]">
        <p className="text-lg text-destructive">
          Error: {result?.error || 'No se pudo cargar el dashboard'}
        </p>
        <p className="text-sm text-muted-foreground">
          La clave proporcionada puede haber expirado o no existe en cache.
        </p>
      </main>
    );
  }

  return <DashboardContainer config={result.data} />;
}

