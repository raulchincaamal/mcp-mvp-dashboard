'use client';

import { useEffect, useRef } from 'react';

interface DotHalftoneProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  /** Separación de la malla de puntos en px (menor = más puntos, más detalle). */
  dotSpacing?: number;
  /** Color de los puntos. */
  dotColor?: string;
  /** Si es true, los puntos "respiran" (oscilan de tamaño). */
  animate?: boolean;
}

interface Dot {
  x: number;
  y: number;
  baseRadius: number; // radio según brillo
  phase: number; // desfase para la animación
}

/**
 * Efecto "Dot halftone": convierte una imagen en una malla de puntos circulares
 * cuyo tamaño depende del brillo del píxel. Pensado para imágenes con fondo
 * removido (PNG transparente) sobre un fondo oscuro.
 */
export default function DotHalftone({
  src,
  alt = 'Dot halftone',
  width = 390,
  height = 585,
  className,
  dotSpacing = 7,
  dotColor = '#ffffff',
  animate = true,
}: DotHalftoneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const w = canvas.width;
    const h = canvas.height;

    const spacing = dotSpacing * dpr;
    const maxRadius = spacing / 2;

    let dots: Dot[] = [];
    let rafId = 0;
    let startTime = 0;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onerror = () => {
      console.error(
        `[DotHalftone] No se pudo cargar la imagen: "${src}". ` +
          `Verifica que exista en public${src}`,
      );
      ctx.strokeStyle = 'rgba(147,180,245,0.4)';
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = 'rgba(147,180,245,0.6)';
      ctx.font = `${14 * dpr}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('Falta public' + src, w / 2, h / 2);
    };

    img.onload = () => {
      // Dibujar la imagen escalada (contain) y leer píxeles
      const scale = Math.min(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offX = (w - drawW) / 2;
      const offY = (h - drawH) / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, offX, offY, drawW, drawH);
      const data = ctx.getImageData(0, 0, w, h).data;
      ctx.clearRect(0, 0, w, h);

      // Construir la malla de puntos
      dots = [];
      for (let y = spacing / 2; y < h; y += spacing) {
        for (let x = spacing / 2; x < w; x += spacing) {
          const px = Math.min(Math.floor(x), w - 1);
          const py = Math.min(Math.floor(y), h - 1);
          const i = (py * w + px) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];

          // Ignorar píxeles transparentes (fondo removido)
          if (alpha < 20) continue;

          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          // Ignorar píxeles muy oscuros
          if (brightness < 0.08) continue;

          dots.push({
            x,
            y,
            baseRadius: brightness * maxRadius,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }

      startTime = performance.now();
      render();
    };

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dotColor;

      const t = (performance.now() - startTime) / 1000;
      const omega = (Math.PI * 2) / 2.6; // periodo de respiración ~2.6s

      for (const dot of dots) {
        let radius = dot.baseRadius;
        if (animate) {
          // Oscilación sutil del tamaño (breathing)
          const breathe = 0.88 + 0.12 * Math.sin(omega * t + dot.phase);
          radius *= breathe;
        }
        if (radius < 0.4) continue;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (animate) {
        rafId = requestAnimationFrame(render);
      }
    };

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [src, width, height, dotSpacing, dotColor, animate]);

  return (
    <canvas ref={canvasRef} aria-label={alt} role="img" className={className} />
  );
}

