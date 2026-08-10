import { RedisCache } from '@mp-front/common/cache-providers';
import DashboardContainer from './components/Container';
import DashboardEmpty from './components/DashboardEmpty';

const CACHE_PREFIX = 'mcp-dashboard';

async function getUIConfig(
  key: string,
): Promise<{ data: unknown; error?: string }> {
  try {
    const redis = new RedisCache<unknown>();
    const fullKey = key.includes(':') ? key : `${CACHE_PREFIX}:ui:${key}`;
    const result = await redis.simpleGet(fullKey);

    if (!result) {
      return { data: null, error: 'expired' };
    }

    return { data: JSON.parse(result) };
  } catch {
    return { data: null, error: 'connection' };
  }
}

interface DashboardPageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { key } = await searchParams;

  // No key provided — show empty state
  if (!key) {
    return <DashboardEmpty type="no-key" />;
  }

  const result = await getUIConfig(key);

  // Key not found or expired
  if (!result.data || result.error) {
    return (
      <DashboardEmpty type={result.error === 'expired' ? 'expired' : 'error'} />
    );
  }

  return <DashboardContainer config={result.data} />;
}

