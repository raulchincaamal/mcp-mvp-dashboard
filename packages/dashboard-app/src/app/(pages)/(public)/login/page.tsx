'use client';

import { useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';

function HalftoneCanvas({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      const scale = Math.min(
        window.innerWidth / img.width,
        window.innerHeight / img.height,
      );
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (canvas.width - drawWidth) / 2;
      const offsetY = (canvas.height - drawHeight) / 2;

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const dotSpacing = 5;
      const maxRadius = dotSpacing / 2;

      for (let y = 0; y < canvas.height; y += dotSpacing) {
        for (let x = 0; x < canvas.width; x += dotSpacing) {
          const i = (y * canvas.width + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];

          const brightness = (r + g + b) / (3 * 255);
          const radius = brightness * maxRadius;

          if (radius > 0.3) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fill();
          }
        }
      }
    };

    const handleResize = () => {
      img.onload?.(new Event('load') as unknown as Event);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover opacity-70"
    />
  );
}

export default function LoginPage() {
  const handleLogin = () => {
    signIn('azure-ad', { callbackUrl: '/' });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <HalftoneCanvas src="/images/login-bg.jpg" />

      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-6 p-12 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] max-w-[400px] w-full">
          {/* Logo */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect
              width="40"
              height="40"
              rx="8"
              fill="white"
              fillOpacity="0.1"
            />
            <path
              d="M12 20L20 12L28 20L20 28L12 20Z"
              stroke="white"
              strokeWidth="2"
            />
          </svg>

          <h1 className="text-3xl font-bold text-white tracking-tight">
            Macropay
          </h1>

          <p className="text-sm text-white/50 text-center">
            Dashboard Intelligence Platform
          </p>

          <button
            className="flex items-center gap-3 px-6 py-3.5 rounded-lg border border-white/15 bg-white/5 text-white text-[0.9375rem] font-medium cursor-pointer transition-all duration-200 w-full justify-center mt-4 hover:bg-white/10 hover:border-white/30 hover:-translate-y-0.5 active:translate-y-0"
            onClick={handleLogin}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            <span>Iniciar sesión con Microsoft 365</span>
          </button>
        </div>
      </div>
    </div>
  );
}

