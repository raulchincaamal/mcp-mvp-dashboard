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
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(0,200,240,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(0,217,126,0.06) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 50% 50%, rgba(129,140,248,0.04) 0%, transparent 70%)',
        transition: 'background var(--t-slow) var(--ease-in-out)',
      }}>
        {children}
      </main>
    </div>
  );
}
