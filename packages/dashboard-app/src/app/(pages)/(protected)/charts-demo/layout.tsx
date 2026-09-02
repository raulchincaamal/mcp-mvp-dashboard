'use client';

import { useEffect, type ReactNode } from 'react';

export default function ChartsDemoLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  return <>{children}</>;
}
