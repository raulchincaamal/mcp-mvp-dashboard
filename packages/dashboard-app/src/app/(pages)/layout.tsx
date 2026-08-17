'use client';

import Navbar from '@/shared/components/Navbar';

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main style={{
        paddingTop: 56,
        minHeight: '100vh',
        background: 'var(--bg)',
        transition: 'background var(--t-slow) var(--ease-in-out)',
      }}>
        {children}
      </main>
    </div>
  );
}
