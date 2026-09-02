'use client';

import { useEffect, useRef } from 'react';

type MaskShape = 'none' | 'circle' | 'ellipse' | 'rounded';

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
  /**
   * Máscara de recorte que limita dónde se ven los puntos:
   * - 'none': sin recorte (solo la silueta de la imagen)
   * - 'circle' | 'ellipse': recorta a un círculo/elipse centrado
   * - 'rounded': recorta a un rectángulo con esquinas redondeadas
   */
  mask?: MaskShape;
  /** Radio de las esquinas para mask='rounded' (en px). */
  maskRadius?: number;
  /**
   * Escala del círculo para mask='circle'. 1 = radio por defecto (mitad del lado menor).
   * Valores > 1 lo hacen más grande, < 1 más pequeño.
   */
  maskScale?: number;
  /** Centro horizontal del círculo como fracción del ancho (0-1). Default 0.5 (centro). */
  maskCenterX?: number;
  /** Centro vertical del círculo como fracción del alto (0-1). Default 0.5 (centro). */
  maskCenterY?: number;
  /**
   * Radio en px de la "lupa" de zoom que sigue al cursor. 0 desactiva el efecto.
   * Los puntos dentro de este radio se agrandan según su cercanía al cursor.
   */
  hoverRadius?: number;
  /**
   * Fuerza del zoom localizado. Ej: 1.6 = los puntos justo bajo el cursor
   * crecen hasta ~160% de su tamaño base.
   */
  hoverZoom?: number;
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
 *
 * Admite una máscara de recorte opcional para limitar el área visible.
 */
const DotHalftone = ({
  src,
  alt = 'Dot halftone',
  width = 390,
  height = 585,
  className,
  dotSpacing = 7,
  dotColor = '#ffffff',
  animate = true,
  mask = 'none',
  maskRadius = 24,
  maskScale = 1,
  maskCenterX = 0.5,
  maskCenterY = 0.5,
  hoverRadius = 90,
  hoverZoom = 1.8,
}: DotHalftoneProps) => {
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
    const hoverR = hoverRadius * dpr; // radio de la lupa en px del canvas

    let dots: Dot[] = [];
    let rafId = 0;
    let startTime = 0;

    // Posición del cursor (en coords del canvas). Objetivo vs. actual (suavizado).
    const target = { x: -9999, y: -9999, active: false };
    const current = { x: -9999, y: -9999, strength: 0 };

    // Define la ruta de recorte según la máscara elegida.
    const applyMask = () => {
      if (mask === 'none') return;

      ctx.beginPath();
      if (mask === 'circle') {
        const radius = (Math.min(w, h) / 2) * maskScale;
        ctx.arc(w * maskCenterX, h * maskCenterY, radius, 0, Math.PI * 2);
      } else if (mask === 'ellipse') {
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else if (mask === 'rounded') {
        const r = maskRadius * dpr;
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.arcTo(w, 0, w, r, r);
        ctx.lineTo(w, h - r);
        ctx.arcTo(w, h, w - r, h, r);
        ctx.lineTo(r, h);
        ctx.arcTo(0, h, 0, h - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
      }
      ctx.closePath();
      ctx.clip();
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    const handleError = () => {
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

    const handleLoad = () => {
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

    const zoomEnabled = hoverR > 0 && hoverZoom > 1;

    const render = () => {
      // Suavizar el seguimiento del cursor y la intensidad del efecto (lerp)
      if (zoomEnabled) {
        const targetStrength = target.active ? 1 : 0;
        current.strength += (targetStrength - current.strength) * 0.12;
        if (target.active) {
          // Si aún no teníamos posición, saltar directo para evitar un barrido
          if (current.x < -9000) {
            current.x = target.x;
            current.y = target.y;
          } else {
            current.x += (target.x - current.x) * 0.2;
            current.y += (target.y - current.y) * 0.2;
          }
        }
      }

      ctx.clearRect(0, 0, w, h);

      // Guardar estado, aplicar máscara y dibujar dentro de ella
      ctx.save();
      applyMask();

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

        // Zoom localizado tipo lupa: los puntos cercanos al cursor crecen
        // proporcionalmente a su propio tamaño (no se fuerza un mínimo, para
        // no fundir puntos vecinos en una mancha).
        if (zoomEnabled && current.strength > 0.001 && radius > 0.4) {
          const dx = dot.x - current.x;
          const dy = dot.y - current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hoverR) {
            // Falloff suave (coseno) desde el centro hacia el borde de la lupa
            const falloff = Math.cos((dist / hoverR) * (Math.PI / 2));
            const boost = 1 + (hoverZoom - 1) * falloff * current.strength;
            radius *= boost;
          }
        }

        if (radius < 0.4) continue;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // El loop corre si hay breathing O si el zoom está activo/animándose
      if (
        animate ||
        (zoomEnabled && (target.active || current.strength > 0.001))
      ) {
        rafId = requestAnimationFrame(render);
      }
    };

    // ── Eventos del cursor para el zoom localizado ──
    const updateTarget = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      target.x = (clientX - rect.left) * dpr;
      target.y = (clientY - rect.top) * dpr;
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateTarget(e.clientX, e.clientY);
    };

    const handleMouseEnter = (e: MouseEvent) => {
      updateTarget(e.clientX, e.clientY);
      target.active = true;
      // Reactivar el loop si estaba detenido (cuando animate=false)
      if (!animate) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(render);
      }
    };

    const handleMouseLeave = () => {
      target.active = false;
    };

    img.addEventListener('error', handleError);
    img.addEventListener('load', handleLoad);

    if (zoomEnabled) {
      canvas.addEventListener('mouseenter', handleMouseEnter);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      cancelAnimationFrame(rafId);
      img.removeEventListener('error', handleError);
      img.removeEventListener('load', handleLoad);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [
    src,
    width,
    height,
    dotSpacing,
    dotColor,
    animate,
    mask,
    maskRadius,
    maskScale,
    maskCenterX,
    maskCenterY,
    hoverRadius,
    hoverZoom,
  ]);

  return (
    <canvas ref={canvasRef} aria-label={alt} role="img" className={className} />
  );
};

export default DotHalftone;

