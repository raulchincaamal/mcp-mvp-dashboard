'use client';

import dynamic from 'next/dynamic';
import { signIn } from 'next-auth/react';

// El efecto dot halftone usa canvas del lado del cliente, se carga solo en el navegador.
const DotHalftone = dynamic(() => import('./DotHalftone'), {
  ssr: false,
});

export default function LoginPage() {
  const handleLogin = () => {
    signIn('azure-ad', { callbackUrl: '/' });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Loading intro — fondo sólido */}
      <div className="absolute inset-0 bg-[#060A13]" />

      {/* Textura de puntos sutil */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 flex items-center justify-center h-full px-8">
        <div className="flex items-center gap-8 md:gap-16 flex-col md:flex-row">
          {/* Lobo con efecto Dot Halftone */}
          <DotHalftone
            src="/images/wolf.png"
            alt="Macropay"
            width={315}
            height={473}
            dotSpacing={5.5}
            dotColor="#ffffff"
            animate
            mask="circle"
            maskScale={1.3}
            className="drop-shadow-[0_0_40px_rgba(60,110,220,0.25)]"
          />

          {/* Texto + botón */}
          <div className="flex flex-col items-start gap-8">
            <h1
              className="text-4xl md:text-5xl text-white tracking-[0.15em] font-light"
              style={{ fontFamily: 'ui-monospace, "Courier New", monospace' }}
            >
              BIENVENIDO
            </h1>

            <button
              onClick={handleLogin}
              type="button"
              className="group flex items-center gap-1 cursor-pointer"
              aria-label="Ingresar con Microsoft 365"
            >
              <span className="px-7 py-3 rounded-full bg-[#93b4f5] text-[#0a1a30] text-lg font-medium transition-colors duration-200 group-hover:bg-[#a8c4f8]">
                Ingresar
              </span>
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#93b4f5] transition-colors duration-200 group-hover:bg-[#a8c4f8]">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0a1a30"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
