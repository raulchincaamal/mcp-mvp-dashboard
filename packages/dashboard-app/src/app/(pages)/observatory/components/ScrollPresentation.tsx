'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import ReactECharts from 'echarts-for-react';
import GlassPanel from './GlassPanel';
import AuroraChart from '@/shared/components/AuroraChart';
import AuroraBackground from './AuroraBackground';
import type { CursorState } from '../hooks/useCursor';
import type { InsightData } from '../state-machine';

// Renders raw ECharts options — used for candlestick, ProgressGroup horizontal, etc.
function EChartsRaw({ opts, height }: { opts: Record<string, unknown>; height: number }) {
  // Strip internal keys before passing to ECharts
  const { _auroraType: _t, _auroraData: _d, ...echartsOpts } = opts;
  return (
    <ReactECharts
      option={echartsOpts as never}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}

interface Props {
  insights: InsightData[];
  cursor: CursorState;
  query: string | null;
  onReset: () => void;
}

type ViewMode = 'presentation' | 'grid';

export default function ScrollPresentation({ insights, cursor, query, onReset }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
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
    if (presentationRef.current) gsap.set(presentationRef.current, { opacity: 0, visibility: 'hidden', pointerEvents: 'none', y: 0, scale: 1 });
    if (gridRef2.current)        gsap.set(gridRef2.current,        { opacity: 1, visibility: 'visible', pointerEvents: 'auto', y: 0, scale: 1 });
  }, []);

  const switchMode = (next: ViewMode) => {
    if (isTransitioning.current || next === viewMode) return;
    isTransitioning.current = true;
    const outEl = viewMode === 'presentation' ? presentationRef.current : gridRef2.current;
    const inEl  = next    === 'presentation' ? presentationRef.current : gridRef2.current;
    if (!outEl || !inEl) { setViewMode(next); isTransitioning.current = false; return; }
    gsap.set(inEl, { visibility: 'visible', opacity: 0, y: next === 'presentation' ? 60 : -60, scale: 0.96, pointerEvents: 'none' });
    if (next === 'grid') {
      gridCardRefs.current.forEach(el => { if (el) gsap.set(el, { opacity: 0, x: 0, y: 0, scale: 1 }); });
      const headerCard = gridRef2.current?.querySelector('[data-header-card]') as HTMLElement | null;
      if (headerCard) gsap.set(headerCard, { opacity: 0, x: 0, y: 0, scale: 1 });
    }
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
      <AuroraBackground />
      <div ref={presentationRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', visibility: 'hidden', opacity: 0, pointerEvents: 'none', zIndex: 1 }}>
        <PresentationMode insights={insights} cursor={cursor} query={query} onReset={onReset} currentSlide={currentSlide} totalSlides={totalSlides} />
      </div>
      <div ref={gridRef2} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 1, overflow: 'hidden' }}>
        <GridMode insights={insights} cursor={cursor} query={query} onReset={onReset} visible={viewMode === 'grid'} cardRefs={gridCardRefs} onExpand={setExpandedInsight} />
      </div>
      {/* Controls — position:absolute to avoid being clipped by ancestor transforms */}
      <div style={{ position: 'absolute', bottom: 24, left: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {viewMode === 'presentation' && (
          <button onClick={() => setAutoPlay(!autoPlay)} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 8, color: autoPlay ? 'var(--primary)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {autoPlay ? '⏸' : '▶'} {currentSlide + 1}/{totalSlides}
          </button>
        )}
        <button onClick={() => switchMode(viewMode === 'presentation' ? 'grid' : 'presentation')} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {viewMode === 'presentation' ? '⊞ Grid' : '▶ Slides'}
        </button>
      </div>
      {viewMode === 'presentation' && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: 6 }}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button key={i} onClick={() => goToSlide(i)} style={{ width: currentSlide === i ? 20 : 8, height: 8, borderRadius: 4, border: 'none', background: currentSlide === i ? 'var(--primary)' : 'var(--border-color)', cursor: 'pointer', transition: 'all 0.25s ease' }} />
          ))}
        </div>
      )}
      {viewMode === 'presentation' && (
        <>
          {currentSlide > 0 && <button onClick={prevSlide} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 100, width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button>}
          {currentSlide < totalSlides - 1 && <button onClick={nextSlide} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 100, width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button>}
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
  const isList = !!insight.listItems;
  const isStatCard = !insight.chartOptions && !isList;

  // Convert chartOptions back to AuroraChart-compatible data
  const auroraData = insight.chartOptions ? (() => {
    const opts = insight.chartOptions as Record<string, unknown>;
    // Tipos nativos: datos ya en formato AuroraChart
    if (opts._auroraData) return opts._auroraData as { labels: string[]; datasets: { label?: string; data: number[] }[] };
    // bar/line/area: xAxis.data + series[0].data
    const xAxis = opts.xAxis as { data?: string[] } | undefined;
    const series = opts.series as { type?: string; data?: unknown[] }[] | undefined;
    if (xAxis?.data && series?.[0]?.data) {
      const labels = xAxis.data;
      const datasets = (series as { type?: string; data?: unknown[]; name?: string }[]).map(s => ({
        label: s.name ?? '',
        data: (s.data as ({ value?: number } | number)[]).map(d => typeof d === 'number' ? d : (d as { value?: number }).value ?? 0),
      }));
      return { labels, datasets };
    }
    // pie: series[0].data = [{name, value}]
    const pieSeries = series?.[0] as { type?: string; data?: { name: string; value: number }[] } | undefined;
    if (pieSeries?.data && Array.isArray(pieSeries.data) && pieSeries.data[0]?.name !== undefined) {
      return {
        labels: pieSeries.data.map((d: { name: string }) => d.name),
        datasets: [{ data: pieSeries.data.map((d: { value: number }) => d.value) }],
      };
    }
    return null;
  })() : null;

  const chartType = insight.chartOptions ? (() => {
    const opts = insight.chartOptions as Record<string, unknown>;
    if (opts._auroraType) return opts._auroraType as 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;
    const t = series?.[0]?.type ?? 'bar';
    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }
    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];
    return (supported.includes(t) ? t : 'bar') as 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
  })() : 'bar';

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
          {auroraData && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
              {insight.chartOptions && (insight.chartOptions as Record<string,unknown>).series
                ? <EChartsRaw opts={insight.chartOptions as Record<string,unknown>} height={340} />
                : <AuroraChart type={chartType} data={auroraData} gradient="aurora" height={340} />}
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID MODE
// ═══════════════════════════════════════════════════════════════════════════

function getBentoSpan(insight: InsightData): { colSpan: number; rowSpan: number } {
  const hasChart   = !!insight.chartOptions && !insight.listItems;
  const isList     = !!insight.listItems;
  const isStatCard = !insight.chartOptions && !isList;
  if (isStatCard) return { colSpan: 1, rowSpan: 1 };
  if (isList)     return { colSpan: 1, rowSpan: 2 };
  if (hasChart) {
    const series = (insight.chartOptions as Record<string, unknown>)?.series as { type?: string }[] | undefined;
    if (series?.[0]?.type === 'pie') return { colSpan: 1, rowSpan: 2 };
    return { colSpan: 2, rowSpan: 2 };
  }
  return { colSpan: 1, rowSpan: 1 };
}

const ACCENT_COLORS = ['#7c6fff','#06b6d4','#34d399','#f472b6','#fb923c','#a78bfa','#38bdf8','#4ade80'];
const ROW_UNIT = 140; // px per row unit
const GAP = 16;

function GridMode({ insights, cursor, query, onReset, visible, cardRefs, onExpand }: Props & { visible: boolean; cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>; onExpand: (insight: InsightData) => void; onReset: () => void }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const headerCardRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  useEffect(() => { if (!visible) { hasAnimated.current = false; } }, [visible]);
  useEffect(() => {
    if (!visible || hasAnimated.current || !gridRef.current) return;
    const allRefs = [headerCardRef.current, ...cardRefs.current];
    allRefs.forEach(el => { if (el) gsap.set(el, { opacity: 0, x: 0, y: 0, scale: 1 }); });

    // Use offsetLeft/offsetTop — immune to ancestor GSAP transforms unlike getBoundingClientRect
    let rafId: number;
    const tryAnimate = () => {
      if (!gridRef.current) return;
      const validRefs = allRefs.filter(Boolean) as HTMLElement[];
      const allReady = validRefs.every(el => el.offsetWidth > 0);
      if (!allReady) { rafId = requestAnimationFrame(tryAnimate); return; }

      const gw = gridRef.current.offsetWidth;
      const gh = gridRef.current.offsetHeight;
      const cx = gw / 2, cy = gh / 2;
      validRefs.forEach((el, i) => {
        const ex = el.offsetLeft + el.offsetWidth / 2;
        const ey = el.offsetTop + el.offsetHeight / 2;
        const dx = (ex - cx) * 1.8;
        const dy = (ey - cy) * 1.8;
        el.dataset.animating = 'true';
        gsap.fromTo(el, { opacity: 0, x: dx, y: dy, scale: 0.82 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.75, delay: i * 0.07, ease: 'power3.out', onComplete: () => { delete el.dataset.animating; } });
      });
      hasAnimated.current = true;
    };
    rafId = requestAnimationFrame(tryAnimate);
    return () => cancelAnimationFrame(rafId);
  }, [visible]);

  const handleNewQuery = () => {
    if (!gridRef.current) { onReset(); return; }
    const allRefs = [headerCardRef.current, ...cardRefs.current].filter(Boolean) as HTMLDivElement[];
    allRefs.forEach((el, i) => {
      gsap.killTweensOf(el);
      gsap.to(el, {
        opacity: 0, scale: 0.7, y: 20,
        duration: 0.4, delay: i * 0.02,
        ease: 'power2.in', overwrite: true,
      });
    });
    gsap.delayedCall(0.4 + allRefs.length * 0.02, onReset);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', padding: '16px 32px', position: 'relative' }}>
      <div
        ref={gridRef}
        style={{
          position: 'relative', zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridAutoRows: `${ROW_UNIT}px`,
          gridAutoFlow: 'dense',
          gap: GAP,
        }}
      >
        {/* Header card */}
        <div ref={headerCardRef} data-header-card style={{ borderRadius: 20, background: 'rgba(255,255,255,0.06)', outline: '1px solid rgba(255,255,255,0.12)', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', margin: '0 0 4px' }}>Executive Intelligence</p>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{query}</h1>
          </div>
          <button onClick={handleNewQuery} style={{ padding: '7px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-color)', color: 'var(--text)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>← New Query</button>
        </div>
        {insights.map((insight, i) => {
          const { colSpan: cs, rowSpan: rs } = getBentoSpan(insight);
          return (
            <BentoCard
              key={insight.id}
              ref={el => { cardRefs.current[i] = el; }}
              insight={insight}
              accent={ACCENT_COLORS[i % ACCENT_COLORS.length]}
              colSpan={`span ${cs}`}
              rowSpan={`span ${rs}`}
              onClick={() => onExpand(insight)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ExpandedModal({ insight, cursor, onClose }: { insight: InsightData; cursor: CursorState; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef     = useRef<HTMLDivElement>(null);
  const isList      = !!insight.listItems;
  const isStatCard  = !insight.chartOptions && !isList;

  const auroraData = insight.chartOptions ? (() => {
    const opts = insight.chartOptions as Record<string, unknown>;
    if (opts._auroraData) return opts._auroraData as { labels: string[]; datasets: { label?: string; data: number[] }[] };
    const xAxis = opts.xAxis as { data?: string[] } | undefined;
    const series = opts.series as { type?: string; data?: unknown[]; name?: string }[] | undefined;
    if (xAxis?.data && series?.[0]?.data) {
      return {
        labels: xAxis.data,
        datasets: series.map(s => ({
          label: s.name ?? '',
          data: (s.data as ({ value?: number } | number)[]).map(d => typeof d === 'number' ? d : (d as { value?: number }).value ?? 0),
        })),
      };
    }
    const pieSeries = series?.[0] as { data?: { name: string; value: number }[] } | undefined;
    if (pieSeries?.data?.[0]?.name !== undefined) {
      return { labels: pieSeries.data!.map(d => d.name), datasets: [{ data: pieSeries.data!.map(d => d.value) }] };
    }
    return null;
  })() : null;

  const chartType = insight.chartOptions ? (() => {
    const opts = insight.chartOptions as Record<string, unknown>;
    if (opts._auroraType) return opts._auroraType as 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;
    const t = series?.[0]?.type ?? 'bar';
    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }
    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];
    return (supported.includes(t) ? t : 'bar') as 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
  })() : 'bar';

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      gsap.set(backdropRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { opacity: 0, scale: 0.92, y: 24 });
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      gsap.to(cardRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.3)', delay: 0.05 });
    }));
  }, []);

  const handleClose = () => { gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 }); gsap.to(cardRef.current, { opacity: 0, scale: 0.94, y: 16, duration: 0.2, onComplete: onClose }); };
  return (
    <div ref={backdropRef} onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 200, opacity: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'pointer' }}>
      <div ref={cardRef} onClick={e => e.stopPropagation()} style={{ position: 'relative', cursor: 'default', width: '100%', maxWidth: 900, height: isStatCard ? 'auto' : '75vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', opacity: 0 }}>
        <button onClick={handleClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ flexShrink: 0, padding: '28px 56px 20px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div><h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{insight.title}</h2>{insight.subtitle && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 0 }}>{insight.subtitle}</p>}</div>
            {insight.metric && <div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ fontSize: isStatCard ? 56 : 36, fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{insight.metric}</p>{insight.metricLabel && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>{insight.metricLabel}</p>}</div>}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border-color)', flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' }}>
          {auroraData && !isList && (
            insight.chartOptions && (insight.chartOptions as Record<string,unknown>).series
              ? <EChartsRaw opts={insight.chartOptions as Record<string,unknown>} height={340} />
              : <AuroraChart type={chartType} data={auroraData} gradient="aurora" height={340} />
          )}
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
    const isList     = !!insight.listItems;
    const isStatCard = !insight.chartOptions && !isList;

    const auroraData = insight.chartOptions ? (() => {
      const opts = insight.chartOptions as Record<string, unknown>;
      if (opts._auroraData) return opts._auroraData as { labels: string[]; datasets: { label?: string; data: number[] }[] };
      const xAxis = opts.xAxis as { data?: string[] } | undefined;
      const series = opts.series as { type?: string; data?: unknown[]; name?: string }[] | undefined;
      if (xAxis?.data && series?.[0]?.data) {
        return {
          labels: xAxis.data,
          datasets: series.map(s => ({
            label: s.name ?? '',
            data: (s.data as ({ value?: number } | number)[]).map(d => typeof d === 'number' ? d : (d as { value?: number }).value ?? 0),
          })),
        };
      }
      const pieSeries = series?.[0] as { data?: { name: string; value: number }[] } | undefined;
      if (pieSeries?.data?.[0]?.name !== undefined) {
        return {
          labels: pieSeries.data!.map(d => d.name),
          datasets: [{ data: pieSeries.data!.map(d => d.value) }],
        };
      }
      return null;
    })() : null;

    const chartType = insight.chartOptions ? (() => {
      const opts = insight.chartOptions as Record<string, unknown>;
      if (opts._auroraType) return opts._auroraType as 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
      const series = opts.series as { type?: string; radius?: unknown }[] | undefined;
      const t = series?.[0]?.type ?? 'bar';
      if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }
      const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];
      return (supported.includes(t) ? t : 'bar') as 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
    })() : 'bar';

    return (
      <div ref={ref} onClick={onClick}
        onMouseEnter={e => { if ((e.currentTarget as HTMLElement).dataset.animating) return; gsap.to(e.currentTarget, { scale: 1.02, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }); }}
        onMouseLeave={e => { if ((e.currentTarget as HTMLElement).dataset.animating) return; gsap.to(e.currentTarget, { scale: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' }); }}
        style={{ gridColumn: colSpan, gridRow: rowSpan, position: 'relative', borderRadius: 20, background: 'rgba(255,255,255,0.06)', outline: '1px solid rgba(255,255,255,0.12)', outlineOffset: '-1px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '22px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)', willChange: 'transform' }}
      >
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
        {auroraData && !isList && (
          <div style={{ flex: 1, minHeight: 0, marginTop: 4, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <AuroraChart type={chartType} data={auroraData} gradient="aurora" bare />
            </div>
          </div>
        )}
      </div>
    );
  }
);
BentoCard.displayName = 'BentoCard';
