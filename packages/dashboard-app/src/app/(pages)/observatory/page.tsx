'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useCursor } from './hooks/useCursor';
import { observatory, runMockFlow, ALEXA_USER_ID, ENV_USER_ID } from './state-machine';
import type { ObservatoryContext, InsightData } from './state-machine';
import AmbientBackground from './components/AmbientBackground';
import CursorLight from './components/CursorLight';
import CoreLight from './components/CoreLight';
import BuildingAnimation from './components/BuildingAnimation';
import ScrollPresentation from './components/ScrollPresentation';
import HotCorner from './components/HotCorner';

// Monta useCursor una sola vez para inicializar el RAF global del cursorRef
// Sin pasar cursor como prop a nadie — evita re-renders en cascada
function CursorBootstrap() {
  useCursor();
  return null;
}

function FadeIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out' });
  }, []);
  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
}

export default function ObservatoryPage() {
  const [ctx, setCtx] = useState<ObservatoryContext>(() => observatory.getContext());
  const [visibleInsights, setVisibleInsights] = useState<InsightData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputOpen, setInputOpen] = useState(false);
  const [zoomQuery, setZoomQuery] = useState<string | null>(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [zoomKey, setZoomKey] = useState(0);
  const [coreLightTriggered, setCoreLightTriggered] = useState(false);
  const pendingIntentRef = useRef<{ intent: string; userId: string } | null>(null);
  const activeUserIdRef = useRef<string>(ALEXA_USER_ID);

  const zoomOverlayRef = useRef<HTMLDivElement>(null);
  const buildingRef    = useRef<HTMLDivElement>(null);
  const inputPanelRef  = useRef<HTMLDivElement>(null);
  const coreLightRef   = useRef<HTMLDivElement>(null);
  const pendingRect    = useRef<DOMRect | null>(null);
  const prevState      = useRef(ctx.state);

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_MCP_API_URL ?? 'http://localhost:4000'}/health`, { signal: AbortSignal.timeout(3000) });
        setApiOnline(res.ok);
      } catch { setApiOnline(false); }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => observatory.subscribe(setCtx), []);

  // Fullscreen with F11 or Ctrl+Shift+F
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isF11 = e.key === 'F11';
      const isCtrlShiftF = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f';
      if (isF11 || isCtrlShiftF) {
        e.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Hide cursor after 5s of inactivity
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const hide = () => {
      document.documentElement.style.setProperty('cursor', 'none', 'important');
      document.documentElement.classList.add('cursor-hidden');
    };
    const show = () => {
      document.documentElement.style.removeProperty('cursor');
      document.documentElement.classList.remove('cursor-hidden');
      clearTimeout(timeout);
      timeout = setTimeout(hide, 5000);
    };

    window.addEventListener('mousemove', show);
    timeout = setTimeout(hide, 5000);

    return () => {
      window.removeEventListener('mousemove', show);
      clearTimeout(timeout);
      document.documentElement.style.removeProperty('cursor');
      document.documentElement.classList.remove('cursor-hidden');
    };
  }, []);

  // Command bar slide
  useEffect(() => {
    if (!inputPanelRef.current) return;
    if (inputOpen) {
      gsap.fromTo(inputPanelRef.current, { opacity: 0, yPercent: 100 }, { opacity: 1, yPercent: 0, duration: 0.55, ease: 'power3.out' });
    } else {
      gsap.to(inputPanelRef.current, { opacity: 0, yPercent: 100, duration: 0.4, ease: 'power3.in' });
    }
  }, [inputOpen]);

  // Zoom animation
  useEffect(() => {
    if (!zoomQuery || !pendingRect.current) return;
    const el   = zoomOverlayRef.current;
    const rect = pendingRect.current;
    pendingRect.current = null;
    if (!el) return;

    gsap.killTweensOf(el);
    gsap.killTweensOf(buildingRef.current);
    gsap.set(buildingRef.current, { opacity: 0, scale: 0.95, clearProps: 'transform' });
    // Forzar re-mount de BuildingAnimation reseteando el key
    setZoomKey(k => k + 1);
    gsap.set(el, {
      display: 'flex',
      left: rect.left, top: rect.top,
      width: rect.width, height: rect.height,
      borderRadius: rect.width < 200 ? '50%' : 18,
      opacity: 1,
    });

    const tl = gsap.timeline();
    tl.to(el, { left: 0, top: 0, width: '100vw', height: '100vh', borderRadius: 0, duration: 0.55, ease: 'power3.inOut' });
    tl.fromTo(buildingRef.current, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, '-=0.1');
    tl.call(() => runMockFlow(zoomQuery, activeUserIdRef.current, pendingFiltersRef.current ?? undefined), [], 0.2);
  }, [zoomQuery]);

  // State transitions
  useEffect(() => {
    const prev = prevState.current;
    const next = ctx.state;
    prevState.current = next;
    if (prev === next) return;

    if (next === 'IDLE') {
      setVisibleInsights([]);
      setInputOpen(false);
      // setShowPresentation(false) is handled by handleReset with GSAP fade — don't duplicate
      const el = zoomOverlayRef.current;
      if (el && el.style.display !== 'none') {
        if (ctx.error) return;
        gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => {
          gsap.set(el, { display: 'none', clearProps: 'left,top,width,height,borderRadius' });
          setZoomQuery(null);
        }});
      } else { setZoomQuery(null); }
    }

    if (next === 'REVEAL') {
      if (ctx.insights.length > 0) setVisibleInsights(ctx.insights);
    }

    if (next === 'PRESENTATION') {
      const el = zoomOverlayRef.current;
      setZoomQuery(null);
      setShowPresentation(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (el) gsap.to(el, { opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: () => gsap.set(el, { display: 'none' }) });
      }));
    }
  }, [ctx.state, ctx.insights]);

  // Error overlay
  useEffect(() => {
    if (!ctx.error) return;
    const el = zoomOverlayRef.current;
    if (!el) return;
    gsap.set(el, { display: 'flex', opacity: 1, left: 0, top: 0, width: '100vw', height: '100vh', borderRadius: 0 });
    gsap.to(buildingRef.current, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
  }, [ctx.error]);

  const pendingFiltersRef = useRef<Record<string, unknown> | null>(null);

  const triggerZoom = useCallback((query: string, rect: DOMRect, userId?: string, filters?: Record<string, unknown>) => {
    if (userId) activeUserIdRef.current = userId;
    pendingFiltersRef.current = filters ?? null;
    setShowPresentation(false);
    setZoomQuery(null);
    pendingRect.current = rect;
    setTimeout(() => setZoomQuery(query), 16);
  }, []);

  // SSE: detectar intent externo (Alexa) via /api/stream
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_MCP_API_URL ?? 'http://localhost:4000';

    function connectSSE(userId: string) {
      const es = new EventSource(`${API_URL}/api/stream?userId=${userId}`);
      es.onmessage = (e) => {
        try {
          const { intent, status } = JSON.parse(e.data);
          if (status === 'processing' && intent && observatory.getContext().state === 'IDLE') {
            pendingIntentRef.current = { intent, userId };
            setCoreLightTriggered(true);
          }
        } catch { /* silencioso */ }
      };
      return es;
    }

    const connections = [connectSSE(ALEXA_USER_ID)];
    if (ENV_USER_ID && ENV_USER_ID !== ALEXA_USER_ID) connections.push(connectSSE(ENV_USER_ID));

    return () => connections.forEach(es => es.close());
  }, [triggerZoom]);

  // Mapa de categorías a intents enriquecidos con contexto específico
  const CATEGORY_INTENTS: Record<string, string> = {
    'Motos': 'Dashboard completo de ventas de Motos: productos más vendidos, distribución por estado, evolución mensual, estatus de créditos y análisis de cartera',
    'Celulares': 'Dashboard completo de ventas de Celulares: modelos más vendidos, distribución por estado, tendencia mensual, estatus de créditos y canales de venta',
    'Bicicletas Eléctricas': 'Dashboard completo de ventas de Bicicletas Eléctricas: productos top, distribución geográfica, evolución mensual y salud crediticia',
    'Pantallas/TV': 'Dashboard completo de ventas de Pantallas y TV: modelos más vendidos, distribución por estado, tendencia mensual y estatus de créditos',
    'Audio': 'Dashboard completo de ventas de Audio: productos más vendidos, distribución por estado, evolución mensual y análisis de créditos',
    'Tablets': 'Dashboard completo de ventas de Tablets: modelos top, distribución geográfica, tendencia mensual y estatus de cartera',
    'Consolas': 'Dashboard completo de ventas de Consolas: productos más vendidos, distribución por estado, evolución mensual y análisis crediticio',
    'Climatización': 'Dashboard completo de ventas de Climatización: productos top, distribución por estado, tendencia mensual y salud de créditos',
  };

  const handleCategoryClick = useCallback((label: string, rect: DOMRect) => {
    const intent = CATEGORY_INTENTS[label] ?? `Dashboard completo de ventas de ${label}: productos más vendidos, distribución por estado, evolución mensual y estatus de créditos`;
    // Pasar filtro de categoría pre-construido para garantizar que llegue aunque Bedrock falle
    const categoryMap: Record<string, string> = {
      'Bicicletas Eléctricas': 'Bicicletas Eléctricas',
      'Pantallas/TV': 'Pantallas/TV',
      'Climatización': 'Climatización',
    };
    const categoriaValue = categoryMap[label] ?? label;
    triggerZoom(intent, rect, undefined, { categoria: categoriaValue });
  }, [triggerZoom]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const query = inputValue.trim();
    setInputValue('');
    setInputOpen(false);
    const rect = coreLightRef.current?.getBoundingClientRect();
    if (rect) triggerZoom(query, rect);
  }, [inputValue, triggerZoom]);

  const handleSuggestion = useCallback((q: string) => {
    setInputOpen(false);
    const rect = coreLightRef.current?.getBoundingClientRect();
    if (rect) triggerZoom(q, rect);
  }, [triggerZoom]);

  const presentationWrapperRef = useRef<HTMLDivElement>(null);

  const handleReset = useCallback(() => {
    // Pre-posicionar CoreLight invisible
    if (coreLightRef.current) {
      gsap.killTweensOf(coreLightRef.current);
      gsap.set(coreLightRef.current, { opacity: 0, scale: 0.4 });
    }
    // Fade out el wrapper de presentación, luego desmontar React
    const wrapper = presentationWrapperRef.current;
    if (wrapper) {
      gsap.to(wrapper, { opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => {
        setShowPresentation(false);
        setZoomQuery(null);
        observatory.transition('IDLE');
        if (coreLightRef.current) {
          gsap.fromTo(coreLightRef.current,
            { opacity: 0, scale: 0.4 },
            { opacity: 1, scale: 1, duration: 1.1, ease: 'back.out(1.4)', delay: 0.1 }
          );
        }
      }});
    } else {
      setShowPresentation(false);
      setZoomQuery(null);
      observatory.transition('IDLE');
    }
  }, []);

  // Splash: animate CoreLight in on mount
  useEffect(() => {
    if (!coreLightRef.current) return;
    gsap.fromTo(coreLightRef.current,
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1, duration: 1.2, ease: 'back.out(1.4)', delay: 0.3 }
    );
  }, []);

  const isIdle = ctx.state === 'IDLE';

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: '"Chivo Mono", monospace',
      position: 'relative', overflow: 'hidden', cursor: 'default',
    }}>
      {/* Inicializa cursorRef sin causar re-renders */}
      <CursorBootstrap />

      {/* Logo — top left */}
      <div style={{
        position: 'fixed', top: 20, left: 24, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        pointerEvents: 'none',
      }}>
        <img src="/macropay-happy.svg" alt="Macropay" style={{ width: 22, height: 18 }} />
        <span style={{
          fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.01em',
          color: 'rgba(255,255,255,0.55)',
          fontFamily: '"Chivo Mono", monospace',
        }}>Macropay AI Diagrams | Ventas</span>
      </div>

      {/* Layer 0 — Three.js + widgets + Coconauta 3D */}
      <AmbientBackground onCategoryClick={handleCategoryClick} showCoconauta={isIdle && !zoomQuery && !showPresentation} />

{/* Layer 1 — Cursor light */}
      <CursorLight />

      {/* Hot corner — bottom left theme switcher (solo en landing) */}
      <HotCorner enabled={isIdle && !zoomQuery && !showPresentation} />

      {/* Layer 2 — CoreLight: siempre montado, GSAP controla opacity */}
      <div
        ref={coreLightRef}
        onClick={() => isIdle && setInputOpen(o => !o)}
        style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 6, opacity: 0,
          cursor: isIdle ? 'pointer' : 'default',
          pointerEvents: (!showPresentation && !zoomQuery) ? 'auto' : 'none',
        }}
      >
        <CoreLight
          state={ctx.state}
          triggered={coreLightTriggered}
          onTriggerComplete={() => {
            setCoreLightTriggered(false);
            const pending = pendingIntentRef.current;
            pendingIntentRef.current = null;
            if (pending) {
              const rect = coreLightRef.current?.getBoundingClientRect();
              if (rect) triggerZoom(pending.intent, rect, pending.userId);
            }
          }}
        />
      </div>

      {/* Layer 3 — Command bar */}
      {isIdle && !zoomQuery && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          zIndex: 8, pointerEvents: 'none',
          overflow: 'hidden', paddingTop: 80,
        }}>
          <div ref={inputPanelRef} style={{
            width: '100%', maxWidth: 580, padding: '0 24px 32px',
            opacity: 0, pointerEvents: inputOpen ? 'auto' : 'none',
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
              {['Dame diagramas de ventas de motos', 'Resumen ejecutivo de ventas', 'Creditos atrasados por estado'].map(q => (
                <button key={q} onClick={() => handleSuggestion(q)} style={{
                  padding: '7px 14px', borderRadius: 100, fontSize: 11,
                  border: '1px solid var(--border-color)', background: 'var(--surface)',
                  color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s ease', backdropFilter: 'blur(12px)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >{q}</button>
              ))}
            </div>
            <form onSubmit={handleSubmit} style={{
              display: 'flex', background: 'var(--surface)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--border-color)', borderRadius: 16,
              boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <input
                autoFocus={inputOpen} value={inputValue}
                onChange={e => { const v = e.target.value; setInputValue(v.length === 1 ? v.toUpperCase() : v); }}
                placeholder="Ask Alexa..."
                style={{ flex: 1, padding: '16px 20px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
              />
              <button type="submit" style={{
                padding: '16px 24px', background: 'transparent',
                border: 'none', borderLeft: '1px solid var(--border-color)',
                color: 'var(--primary)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >Ask ↵</button>
            </form>
          </div>
        </div>
      )}

      {/* Layer 4 — iOS zoom overlay */}
      <div ref={zoomOverlayRef} style={{
        position: 'fixed', display: 'none',
        zIndex: 20, opacity: 0,
        inset: 0,
      }}>
        <div ref={buildingRef} style={{ opacity: 1, width: '100%', height: '100%' }}>
          <BuildingAnimation key={zoomKey} state={ctx.state} query={zoomQuery ?? ''} statusMessage={ctx.statusMessage} />
          {ctx.error && (
            <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 10, maxWidth: 480, textAlign: 'center', zIndex: 10 }}>
              <p style={{ color: '#ff453a', fontSize: 13, margin: 0 }}>{ctx.error}</p>
              <button onClick={handleReset} style={{ marginTop: 10, padding: '6px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,69,58,0.4)', color: '#ff453a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
            </div>
          )}
        </div>
      </div>

      {/* Layer 5 — Presentation */}
      {showPresentation && (
        <FadeIn>
          <div ref={presentationWrapperRef} style={{ position: 'fixed', inset: 0, zIndex: 30 }}>
            <ScrollPresentation
              insights={visibleInsights}
              cursor={{ x: 0, y: 0, normalizedX: 0, normalizedY: 0, velocityX: 0, velocityY: 0, speed: 0, isMoving: false }}
              query={ctx.query?.raw ?? null}
              onReset={handleReset}
            />
          </div>
        </FadeIn>
      )}
    </div>
  );
}
