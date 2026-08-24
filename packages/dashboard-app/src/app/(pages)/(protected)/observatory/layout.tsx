'use client';

import { useEffect } from 'react';

// Observatory tiene su propio layout sin Navbar para experiencia inmersiva
export default function ObservatoryLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Deshabilitar scroll del body mientras estamos en observatory
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div style={{ 
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      zIndex: 9999,
      background: 'var(--bg)',
    }}>
      {children}
    </div>
  );
}
