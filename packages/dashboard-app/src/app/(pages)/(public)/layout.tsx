'use client';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {children}
    </div>
  );
}
