'use client';

import { useEffect } from 'react';

const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  // Las páginas públicas (login) ocupan exactamente la pantalla y no deben
  // scrollear. Neutralizamos el scroll que Lenis habilita globalmente
  // mientras estas páginas están montadas, y lo restauramos al salir.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: '#06070C',
      }}
    >
      {children}
    </div>
  );
};

export default PublicLayout;
