'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

interface ScrambleTextProps {
  /** Texto final que debe revelarse. */
  text: string;
  /** Duración de la animación en segundos. */
  duration?: number;
  /** Retardo antes de iniciar en segundos. */
  delay?: number;
  /** Caracteres usados durante el scramble. */
  chars?: string;
  /** Velocidad de cambio de caracteres (0-1). */
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Etiqueta HTML a renderizar. Default 'span'. */
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Anima un texto con el efecto "scramble" de GSAP: los caracteres aparecen
 * revueltos y se van resolviendo hasta formar el texto final.
 */
const ScrambleText = ({
  text,
  duration = 1.6,
  delay = 0.2,
  chars = 'upperCase',
  speed = 0.5,
  className,
  style,
  as = 'span',
}: ScrambleTextProps) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tween = gsap.to(el, {
      duration,
      delay,
      scrambleText: {
        text,
        chars,
        speed,
        revealDelay: 0.3,
      },
    });

    return () => {
      tween.kill();
    };
  }, [text, duration, delay, chars, speed]);

  const Tag = as as React.ElementType;

  // Renderizamos el texto final como contenido inicial para que sea accesible
  // y no haya salto de layout; GSAP lo sobreescribe al animar.
  return (
    <Tag ref={ref} className={className} style={style} aria-label={text}>
      {text}
    </Tag>
  );
};

export default ScrambleText;

