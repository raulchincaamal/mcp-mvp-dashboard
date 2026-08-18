'use client';

// Observatory tiene su propio layout sin Navbar para experiencia inmersiva
export default function ObservatoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ 
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}
