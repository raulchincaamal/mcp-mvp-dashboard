'use client';

import DynamicRenderer from '@/shared/components/DynamicRenderer';
import type { UIConfig } from '@/shared/components/DynamicRenderer';

interface DashboardContainerProps {
  config: unknown;
}

export default function DashboardContainer({
  config,
}: DashboardContainerProps) {
  return (
    <main className="flex flex-col gap-4 p-6">
      <DynamicRenderer config={config as UIConfig} />
    </main>
  );
}

