'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as echarts from 'echarts';
import GlassPanel from './GlassPanel';
import type { CursorState } from '../hooks/useCursor';
import type { InsightData } from '../state-machine';

interface Props {
  insights: InsightData[];
  cursor: CursorState;
  query: string | null;
  onReset: () => void;
}

type ViewMode = 'presentation' | 'grid';

export default function ScrollPresentation({ insights, cursor, query, onReset }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('presentation');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [expandedInsight, setExpandedInsight] = useState<InsightData | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const gridRef2        = useRef<HTMLDivElement>(null);
  const isTransitioning = useRef(false);
  const gridCardRefs    = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!expandedInsight) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedInsight(null); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expandedInsight]);

  useEffect(() => {
    if (presentationRef.current) gsap.set(presentationRef.current, { opacity: 1, visibility: 'visible', pointerEvents: 'auto', y: 0, scale: 1 });
    if (gridRef2.current)        gsap.set(gridRef2.current,        { opacity: 0, visibility: 'hidden',  pointerEvents: 'none', y: 0, scale: 1 });
  }, []);

  const switchMode = (next: ViewMode) => {
    if (isTransitioning.current || next === viewMode) return;
    isTransitioning.current = true;
    const outEl = viewMode === 'presentation' ? presentationRef.current : gridRef2.current;
    const inEl  = next    === 'presentation' ? presentationRef.current : gridRef2.current;
    if (!outEl || !inEl) { setViewMode(next); isTransitioning.current = false; return; }
    gsap.set(inEl, { visibility: 'visible', opacity: 0, y: next === 'presentation' ? 60 : -60, scale: 0.96, pointerEvents: 'none' });
    if (next === 'grid') gridCardRefs.current.forEach(el => { if (el) gsap.set(el, { opacity: 0, x: 0, y: 0, scale: 1 }); });
    const tl = gsap.timeline({ onComplete: () => { gsap.set(outEl, { visibility: 'hidden', pointerEvents: 'none' }); gsap.set(inEl, { pointerEvents: 'auto' }); setViewMode(next); isTransitioning.current = false; } });
    tl.to(outEl, { opacity: 0, y: viewMode === 'presentation' ? -60 : 60, scale: 0.96, duration: 0.35, ease: 'power3.in' }, 0);
    tl.to(inEl,  { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }, 0.25);
  };

  const totalSlides = insights.length + 2;

  useEffect(() => {
    if (!autoPlay || viewMode !== 'presentation') return;
    const timer = setTimeout(() => { if (currentSlide < totalSlides - 1) setCurrentSlide(s => s + 1); else setAutoPlay(false); }, 4000);
    return () => clearTimeout(timer);
  }, [autoPlay, currentSlide, viewMode, totalSlides]);

  const goToSlide = (i: number) => { setAutoPlay(false); setCurrentSlide(i); };
  const nextSlide = () => { setAutoPlay(false); if (currentSlide < totalSlides - 1) setCurrentSlide(s => s + 1); };
  const prevSlide = () => { setAutoPlay(false); if (currentSlide > 0) setCurrentSlide(s => s - 1); };

  useEffect(() => {
    if (viewMode !== 'presentation') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); nextSlide(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevSlide(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewMode, currentSlide]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div ref={presentationRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <PresentationMode insights={insights} cursor={cursor} query={query} onReset={onReset} currentSlide={currentSlide} totalSlides={totalSlides} />
      </div>
      <div ref={gridRef2} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', visibility: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <GridMode insights={insights} cursor={cursor} query={query} onReset={onReset} visible={viewMode === 'grid'} cardRefs={gridCardRefs} onExpand={setExpandedInsight} />
      </div>
      <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {viewMode === 'presentation' && (
          <button onClick={() => setAutoPlay(!autoPlay)} style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, color: autoPlay ? 'var(--primary)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(12px)' }}>
            {autoPlay ? '⏸' : '▶'} {currentSlide + 1}/{totalSlides}
          </button>
        )}
        <button onClick={() => switchMode(viewMode === 'presentation' ? 'grid' : 'presentation')} style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(12px)' }}>
          {viewMode === 'presentation' ? '⊞ Grid' : '▶ Slides'}
        </button>
      </div>
      {viewMode === 'presentation' && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: 6 }}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button key={i} onClick={() => goToSlide(i)} style={{ width: currentSlide === i ? 20 : 8, height: 8, borderRadius: 4, border: 'none', background: currentSlide === i ? 'var(--primary)' : 'var(--border-color)', cursor: 'pointer', transition: 'all 0.25s ease' }} />
          ))}
        </div>
      )}
      {viewMode === 'presentation' && (
        <>
          {currentSlide > 0 && <button onClick={prevSlide} style={{ position: 'fixed', left: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 100, width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
          {currentSlide < totalSlides - 1 && <button onClick={nextSlide} style={{ position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 100, width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
        </>
      )}
      {expandedInsight && <ExpandedModal insight={expandedInsight} cursor={cursor} onClose={() => setExpandedInsight(null)} />}
    </div>
  );
}

function PresentationMode({ insights, cursor, query, onReset, currentSlide, totalSlides }: { insights: InsightData[]; cursor: CursorState; query: string | null; onReset: () => void; currentSlide: number; totalSlides: number }) {
  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <Slide isActive={currentSlide === 0}><HeaderContent query={query} count={insights.length} /></Slide>
      {insights.map((insight, i) => <Slide key={insight.id} isActive={currentSlide === i + 1}><InsightContent insight={insight} cursor={cursor} index={i} total={insights.length} /></Slide>)}
      <Slide isActive={currentSlide === totalSlides - 1}><EndContent cursor={cursor} onReset={onReset} /></Slide>
    </div>
  );
}

function Slide({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!ref.current) return; gsap.to(ref.current, { opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.97, y: isActive ? 0 : 20, duration: 0.55, ease: 'power3.out', pointerEvents: isActive ? 'auto' : 'none' }); }, [isActive]);
  return <div ref={ref} style={{ position: 'absolute', inset: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 48px 72px', opacity: 0, overflow: 'hidden' }}>{children}</div>;
}

function HeaderContent({ query, count }: { query: string | null; count: number }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 700 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 16 }}>Executive Intelligence</p>
      <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>{query}</h1>
      <p style={{ fontSize: 15, color: 'var(--text-tertiary)', marginTop: 16 }}>{count} insights generated</p>
    </div>
  );
}

function EndContent({ cursor, onReset }: { cursor: CursorState; onReset: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Analysis Complete</p>
      <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: '0 0 24px' }}>Ready for your next question</h2>
      <GlassPanel cursor={cursor} depth={0.2} glowOnHover={false}>
        <button onClick={onReset} style={{ padding: '14px 28px', background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>New Query</button>
      </GlassPanel>
    </div>
  );
}

function InsightContent({ insight, cursor, index, total }: { insight: InsightData; cursor: CursorState; index: number; total: number }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const isList = !!insight.listItems;
  const isStatCard = !insight.chartOptions && !isList;
  useEffect(() => {
    if (!insight.chartOptions) return;
    const el = document.getElementById(`insight-chart-${insight.id}`);
    if (!el) return;
    let instance: echarts.ECharts | null = null, ro: ResizeObserver | null = null, initialized = false;
    function tryInit() {
      if (initialized || !el || el.clientHeight < 50) return;
      initialized = true;
      instance = echarts.init(el, null, { renderer: 'canvas' });
      instance.setOption({ ...insight.chartOptions, backgroundColor: 'transparent', animation: true, animationDuration: 900, animationEasing: 'cubicOut' } as echarts.EChartsOption);
      instance.resize();
      ro = new ResizeObserver(() => instance?.resize());
      ro.observe(el);
    }
    const poll = setInterval(() => { if (el.clientHeight >= 50) { clearInterval(poll); tryInit(); } }, 50);
    return () => { clearInterval(poll); ro?.disconnect(); instance?.dispose(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ width: '100%', maxWidth: isStatCard ? 600 : 1100, marginLeft: 'auto', marginRight: 'auto', display: 'flex', flexDirection: 'column', ...(isStatCard || isList ? {} : { flex: 1, minHeight: 0, alignSelf: 'stretch' }) }}>
      <GlassPanel cursor={cursor} depth={0.2} glowOnHover={false} style={isStatCard || isList ? {} : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: isStatCard ? '48px 56px' : '28px 40px 24px', display: 'flex', flexDirection: 'column', ...(isStatCard || isList ? {} : { flex: 1, minHeight: 0 }) }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 14, textTransform: 'uppercase' }}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isStatCard ? 'center' : 'flex-start', gap: 32, marginBottom: isStatCard ? 0 : 20, flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{insight.title}</h2>
              {insight.subtitle && <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>{insight.subtitle}</p>}
            </div>
            {insight.metric && <div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ fontSize: isStatCard ? 72 : 44, fontWeight: 700, color: 'var(--primary)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{insight.metric}</p>{insight.metricLabel && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>{insight.metricLabel}</p>}</div>}
          </div>
          {isList && insight.listItems && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
              {insight.listItems.map((item, i) => {
                const amountColor = item.status === 'positive' ? '#30d158' : item.status === 'negative' ? 'var(--danger)' : 'var(--text)';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < insight.listItems!.length - 1 ? '1px solid var(--border-color)' : 'none', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>{item.subtitle && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>{item.subtitle}</p>}</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: amountColor, margin: 0, flexShrink: 0 }}>{item.amount}</p>
                  </div>
                );
              })}
            </div>
          )}
          {insight.chartOptions && <div id={`insight-chart-${insight.id}`} ref={chartRef} style={{ flex: 1, minHeight: 0 }} />}
        </div>
      </GlassPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID MODE
// ═══════════════════════════════════════════════════════════════════════════

function getBentoSpan(i: number, insight: InsightData): { col: string; row: string } {
  const hasChart = !!insight.chartOptions && !insight.listItems;
  const isList   = !!insight.listItems;
  if (hasChart) { const colPatterns = ['span 2','span 1','span 2','span 1','span 1','span 2']; return { col: colPatterns[i % colPatterns.length], row: 'span 2' }; }
  if (isList) return { col: 'span 1', row: 'span 2' };
  const patterns = [{ col: 'span 1', row: 'span 1' }, { col: 'span 2', row: 'span 1' }, { col: 'span 1', row: 'span 1' }];
  return patterns[i % patterns.length];
}

const ACCENT_COLORS = ['#7c6fff','#06b6d4','#34d399','#f472b6','#fb923c','#a78bfa','#38bdf8','#4ade80'];

function GridMode({ insights, cursor, query, onReset, visible, cardRefs, onExpand }: Props & { visible: boolean; cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>; onExpand: (insight: InsightData) => void }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  useEffect(() => { if (!visible) { hasAnimated.current = false; } }, [visible]);
  useEffect(() => {
    if (!visible || hasAnimated.current || !gridRef.current) return;
    requestAnimationFrame(() => {
      const cr = gridRef.current!.getBoundingClientRect();
      const cx = cr.width / 2, cy = cr.height / 2;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (r.left - cr.left + r.width / 2 - cx) * 1.8;
        const dy = (r.top - cr.top + r.height / 2 - cy) * 1.8;
        gsap.fromTo(el, { opacity: 0, x: dx, y: dy, scale: 0.82 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.75, delay: i * 0.07, ease: 'power3.out' });
      });
      hasAnimated.current = true;
    });
  }, [visible]);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: '20px 32px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', margin: '0 0 4px' }}>Executive Intelligence</p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{query}</h1>
        </div>
        <button onClick={onReset} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-color)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(12px)', flexShrink: 0 }}>← New Query</button>
      </div>
      <div ref={gridRef} data-lenis-prevent style={{ flex: 1, overflowY: 'scroll', overflowX: 'hidden', padding: '8px 32px 60px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '160px', gap: 12, alignContent: 'start', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {insights.map((insight, i) => { const span = getBentoSpan(i, insight); const accent = ACCENT_COLORS[i % ACCENT_COLORS.length]; return <BentoCard key={insight.id} ref={el => { cardRefs.current[i] = el; }} insight={insight} accent={accent} colSpan={span.col} rowSpan={span.row} onClick={() => onExpand(insight)} />; })}
      </div>
    </div>
  );
}

function ExpandedModal({ insight, cursor, onClose }: { insight: InsightData; cursor: CursorState; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef     = useRef<HTMLDivElement>(null);
  const chartRef    = useRef<HTMLDivElement>(null);
  const isList      = !!insight.listItems;
  const isStatCard  = !insight.chartOptions && !isList;
  useEffect(() => {
    // Double rAF ensures element is painted before animating
    requestAnimationFrame(() => requestAnimationFrame(() => {
      gsap.set(backdropRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { opacity: 0, scale: 0.92, y: 24 });
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      gsap.to(cardRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.3)', delay: 0.05 });
    }));
  }, []);
  useEffect(() => {
    if (!chartRef.current || !insight.chartOptions) return;
    let instance: echarts.ECharts | null = null, ro: ResizeObserver | null = null;
    const t = setTimeout(() => {
      if (!chartRef.current) return;
      instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
      instance.setOption({ ...insight.chartOptions, backgroundColor: 'transparent', animation: true, animationDuration: 800 } as echarts.EChartsOption);
      instance.resize();
      ro = new ResizeObserver(() => instance?.resize());
      ro.observe(chartRef.current);
    }, 200);
    return () => { clearTimeout(t); ro?.disconnect(); instance?.dispose(); };
  }, [insight.chartOptions]);
  const handleClose = () => { gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 }); gsap.to(cardRef.current, { opacity: 0, scale: 0.94, y: 16, duration: 0.2, onComplete: onClose }); };
  return (
    <div ref={backdropRef} onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 200, opacity: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'pointer' }}>
      <div ref={cardRef} onClick={e => e.stopPropagation()} style={{ position: 'relative', cursor: 'default', width: '100%', maxWidth: 900, height: isStatCard ? 'auto' : '75vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', opacity: 0 }}>
        <button onClick={handleClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ flexShrink: 0, padding: '28px 56px 20px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div><h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{insight.title}</h2>{insight.subtitle && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 0 }}>{insight.subtitle}</p>}</div>
            {insight.metric && <div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ fontSize: isStatCard ? 56 : 36, fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{insight.metric}</p>{insight.metricLabel && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>{insight.metricLabel}</p>}</div>}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border-color)', flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' }}>
          {insight.chartOptions && !isList && <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />}
          {isList && insight.listItems && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {insight.listItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < insight.listItems!.length - 1 ? '1px solid var(--border-color)' : 'none', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>{item.subtitle && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>{item.subtitle}</p>}</div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: 0, flexShrink: 0, color: item.status === 'positive' ? '#34d399' : item.status === 'negative' ? '#f87171' : 'var(--text)' }}>{item.amount}</p>
                </div>
              ))}
            </div>
          )}
          {isStatCard && <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>{insight.subtitle ?? ''}</p>}
        </div>
      </div>
    </div>
  );
}

const BentoCard = React.forwardRef<HTMLDivElement, { insight: InsightData; accent: string; colSpan: string; rowSpan: string; onClick: () => void }>(
  ({ insight, accent, colSpan, rowSpan, onClick }, ref) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const glowRef  = useRef<HTMLDivElement>(null);
    const isList   = !!insight.listItems;
    const isStatCard = !insight.chartOptions && !isList;
    useEffect(() => {
      if (!insight.chartOptions || isList) return;
      let instance: echarts.ECharts | null = null, ro: ResizeObserver | null = null;
      const t = setTimeout(() => {
        if (!chartRef.current) return;
        instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        instance.setOption({ ...insight.chartOptions, backgroundColor: 'transparent', animation: true, animationDuration: 700 } as echarts.EChartsOption);
        instance.resize();
        ro = new ResizeObserver(() => instance?.resize());
        ro.observe(chartRef.current!);
      }, 300);
      return () => { clearTimeout(t); ro?.disconnect(); instance?.dispose(); };
    }, [insight.chartOptions, isList]);
    return (
      <div ref={ref} onClick={onClick}
        onMouseEnter={e => { gsap.to(e.currentTarget, { scale: 1.02, duration: 0.35, ease: 'power2.out' }); if (glowRef.current) gsap.to(glowRef.current, { opacity: 1, duration: 0.35 }); }}
        onMouseLeave={e => { gsap.to(e.currentTarget, { scale: 1, duration: 0.45, ease: 'power2.out' }); if (glowRef.current) gsap.to(glowRef.current, { opacity: 0, duration: 0.45 }); }}
        style={{ gridColumn: colSpan, gridRow: rowSpan, position: 'relative', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '22px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)', willChange: 'transform' }}
      >
        <div ref={glowRef} style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', background: `radial-gradient(circle at 30% 80%, ${accent}22 0%, transparent 60%)`, borderRadius: 'inherit' }} />
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, margin: 0, opacity: 0.9 }}>{insight.title}</p>
          {insight.metric && isStatCard && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{insight.metricLabel}</p>}
        </div>
        {insight.metric && <p style={{ fontSize: isStatCard ? 52 : 32, fontWeight: 800, color: 'rgba(255,255,255,0.92)', margin: '0 0 8px', lineHeight: 1, letterSpacing: '-0.03em', flexShrink: 0 }}>{insight.metric}</p>}
        {insight.subtitle && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px', flexShrink: 0 }}>{insight.subtitle}</p>}
        {isList && insight.listItems && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {insight.listItems.slice(0, 5).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</p>
                <p style={{ fontSize: 12, fontWeight: 700, margin: 0, flexShrink: 0, marginLeft: 8, color: item.status === 'positive' ? '#34d399' : item.status === 'negative' ? '#f87171' : 'rgba(255,255,255,0.8)' }}>{item.amount}</p>
              </div>
            ))}
          </div>
        )}
        {insight.chartOptions && !isList && <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />}
      </div>
    );
  }
);
BentoCard.displayName = 'BentoCard';
