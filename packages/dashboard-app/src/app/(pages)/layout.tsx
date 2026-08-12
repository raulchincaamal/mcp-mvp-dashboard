'use client';

import Sidebar from '@/shared/components/Sidebar';

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: 248,
        minHeight: '100vh',
        background: 'var(--bg)',
        transition: 'background var(--t-slow) var(--ease-in-out)',
      }}>
        {children}
      </main>
    </div>
  );
}
