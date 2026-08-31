'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import ReactECharts from 'echarts-for-react';
import GlassPanel from './GlassPanel';
import AuroraChart from '@/shared/components/AuroraChart';
import MexicoMapChart from '@/shared/components/MexicoMapChart';
import AuroraBackground from './AuroraBackground';
import type { CursorState } from '../hooks/useCursor';
import type { InsightData } from '../state-machine';
import type { LayoutHint, GridSpec } from '../layout-engine';

function EChartsRaw({ opts, height }: { opts: Record<string, unknown>; height: number }) {
  const { _auroraType: _t, _auroraData: _d, ...echartsOpts } = opts;
  return <ReactECharts option={echartsOpts as never} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />;
}

interface Props {
  insights: InsightData[];
  cursor: CursorState;
  query: string | null;
  description: string | null;
  onReset: () => void;
  layoutHint?: LayoutHint | null;
}

type ViewMode = 'presentation' | 'grid';

export default function ScrollPresentation({ insights, cursor, query, description, onReset, layoutHint }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<InsightData | null>(null);
  const [cornerHovered, setCornerHovered] = useState(false);
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
        <LayoutRenderer insights={insights} cursor={cursor} query={query} description={description} onReset={onReset} visible={viewMode === 'grid'} cardRefs={gridCardRefs} onExpand={setExpandedInsight} layoutHint={layoutHint} />
      </div>
      {/* Hot corner — bottom-left 80×80 invisible trigger zone */}
      <div
        onMouseEnter={() => setCornerHovered(true)}
        onMouseLeave={() => setCornerHovered(false)}
        style={{ position: 'absolute', bottom: 0, left: 0, width: 80, height: 80, zIndex: 99 }}
      />
      {/* Slides / Grid toggle — visible only on hover or when in presentation mode */}
      <div
        onMouseEnter={() => setCornerHovered(true)}
        onMouseLeave={() => setCornerHovered(false)}
        style={{
          position: 'absolute', bottom: 20, left: 20, zIndex: 100,
          display: 'flex', flexDirection: 'column', gap: 8,
          opacity: viewMode === 'presentation' || cornerHovered ? 1 : 0,
          transform: viewMode === 'presentation' || cornerHovered ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: viewMode === 'presentation' || cornerHovered ? 'auto' : 'none',
        }}
      >
        {viewMode === 'presentation' && (
          <button onClick={() => setAutoPlay(!autoPlay)} style={{ padding: '8px 14px', background: 'var(--surface, #1a1f2e)', border: '1px solid var(--border-color)', borderRadius: 8, color: autoPlay ? 'var(--primary)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {autoPlay ? '⏸' : '▶'} {currentSlide + 1}/{totalSlides}
          </button>
        )}
        <button onClick={() => switchMode(viewMode === 'presentation' ? 'grid' : 'presentation')} style={{ padding: '8px 14px', background: 'var(--surface, #1a1f2e)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
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

  const auroraData = insight.chartOptions ? (() => {
    const opts = insight.chartOptions as Record<string, unknown>;
    if (opts._auroraData) return opts._auroraData as { labels: string[]; datasets: { label?: string; data: number[] }[] };
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
          {auroraData && (chartType as string) === 'map' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
              <MexicoMapChart data={auroraData.labels.map((name, i) => ({ name, value: (auroraData.datasets?.[0]?.data?.[i] as number) ?? 0 }))} height={340} gradient="aurora" bare />
            </div>
          )}
          {auroraData && (chartType as string) === 'progress' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8, overflowY: 'auto' }}>{renderChart(insight, 340, true)}</div>
          )}
          {auroraData && (chartType as string) !== 'map' && (chartType as string) !== 'progress' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
              <AuroraChart type={chartType} data={auroraData} gradient="aurora" height={340} />
            </div>
          )}
          {!auroraData && insight.chartOptions && !!(insight.chartOptions as Record<string,unknown>).series && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
              <EChartsRaw opts={insight.chartOptions as Record<string,unknown>} height={340} />
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

type GridProps = Props & {
  visible: boolean;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onExpand: (insight: InsightData) => void;
  layoutHint?: LayoutHint | null;
};

type LayoutProps = Omit<GridProps, 'cursor' | 'layoutHint'>;

const ACCENT_COLORS = ['#00c8f0','#00d97e','#f5a623','#818cf8','#38bdf8','#34d399','#fb923c','#a78bfa'];
const GAP = 14;

function cardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 16,
    background: 'rgba(255,255,255,0.038)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    boxShadow: '0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    ...extra,
  };
}

function accentLine(color: string): React.CSSProperties {
  return { position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}cc, transparent)` };
}

function hoverIn(el: HTMLElement, accent: string) {
  gsap.to(el, { scale: 1.012, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
  el.style.borderColor = `${accent}44`;
  el.style.boxShadow = `0 6px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.09), 0 0 0 1px ${accent}18`;
}

function hoverOut(el: HTMLElement) {
  gsap.to(el, { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
  el.style.borderColor = '';
  el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.2)';
}

function renderChart(insight: InsightData, height: number, bare = false, preview = false): React.ReactNode {
  if (!insight.chartOptions) return null;
  const opts = insight.chartOptions as Record<string, unknown>;
  const auroraData = opts._auroraData as { labels: string[]; datasets: { label?: string; data: number[] }[] } | undefined;
  const chartType = (opts._auroraType as string) ?? 'bar';

  if (chartType === 'map' && auroraData) {
    return <MexicoMapChart data={auroraData.labels.map((name, i) => ({ name, value: (auroraData.datasets?.[0]?.data?.[i] as number) ?? 0 }))} height={bare ? '100%' : height} gradient="aurora" bare={bare} />;
  }

  if (chartType === 'progress' && auroraData) {
    const PC = ['#10d97e','#5bb8f5','#fbbf24','#f472b6','#a78bfa','#22d3ee','#fde68a','#818cf8'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
        {auroraData.labels.map((label, i) => {
          const value = Math.min(100, Math.max(0, auroraData.datasets?.[0]?.data?.[i] ?? 0));
          const color = PC[i % PC.length];
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary, rgba(230,236,244,0.8))' }}>{label}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary, rgba(170,185,210,0.6))' }}>{value}%</span>
              </div>
              <div style={{ height: 8, width: '100%', borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${value}%`, background: color, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const displayData = preview && auroraData
    ? chartType === 'heatmap'
      ? { labels: auroraData.labels.slice(0, 6), datasets: auroraData.datasets.slice(0, 4).map(ds => ({ ...ds, data: ds.data.slice(0, 6) })) }
      : chartType === 'radar'
      ? { labels: auroraData.labels.slice(0, 4), datasets: auroraData.datasets.map(ds => ({ ...ds, data: ds.data.slice(0, 4) })) }
      : auroraData
    : auroraData;

  if (displayData) return <AuroraChart type={chartType as never} data={displayData} gradient="aurora" height={bare ? '100%' : height} bare={bare} />;
  if (opts.series) return <EChartsRaw opts={opts} height={height || 200} />;
  return null;
}

// Canonical widget heights — mirrors layout-engine WIDGET_SIZE
const WIDGET_H: Record<string, number> = {
  // tall
  map: 400, heatmap: 400, candlestick: 400, 'bar-race': 400,
  'hierarchical-bar': 400, 'diverging-bar': 400, 'radial-stacked-bar': 400,
  // wide
  scatter: 320, 'stacked-area': 320, bollinger: 320, area: 320, line: 320, treemap: 320,
  // medium
  bar: 260, doughnut: 260, pie: 260, radar: 260, funnel: 260, progress: 260,
  // small
  gauge: 160,
};

function getChartMinH(insight: InsightData): number {
  const type = (insight.chartOptions as Record<string, unknown>)?._auroraType as string ?? 'bar';
  return WIDGET_H[type] ?? 260;
}

// KPI card height + list item height constants
const KPI_H   = 72;   // approximate rendered height of a KpiCard
const LIST_H  = 180;  // approximate rendered height of a list/transaction card
const HEADER_H = 52;  // HeaderBar height
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.4;

/**
 * Measures the actual scrollHeight of the container after render and computes
 * the zoom factor needed so all content fits without scrolling.
 */
function useAdaptiveZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  _requiredH: number,
  baseZoom: number,
): number {
  const [zoom, setZoom] = useState(baseZoom);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      // Temporarily reset zoom to measure true content size
      const prev = el.style.zoom;
      el.style.zoom = '1';
      const contentH = el.scrollHeight;
      const availH   = el.clientHeight || window.innerHeight;
      el.style.zoom = prev;
      if (contentH <= availH) {
        setZoom(Math.min(baseZoom, MAX_ZOOM));
      } else {
        setZoom(Math.max(MIN_ZOOM, availH / contentH));
      }
    };
    // Measure after paint
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [baseZoom]);
  return zoom;
}

function AutoHeightChart({ insight, height, preview = false }: { insight: InsightData; height?: number; preview?: boolean }) {
  const h = height ?? getChartMinH(insight);
  return <div style={{ width: '100%', height: h }}>{renderChart(insight, h, true, preview)}</div>;
}

function KpiCard({ ins, accent, cardRef, onClick }: { ins: InsightData; accent: string; cardRef?: (el: HTMLDivElement | null) => void; onClick: () => void }) {
  const trend = ins.metricLabel?.toLowerCase();
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const isTrend = isUp || isDown || trend === 'neutral';
  const trendColor = isUp ? '#34d399' : isDown ? '#f87171' : '#60a5fa';
  const trendLabel = isUp ? '↑ up' : isDown ? '↓ down' : '● neutral';
  return (
    <div data-animate ref={cardRef} onClick={onClick}
      onMouseEnter={e => hoverIn(e.currentTarget as HTMLElement, accent)}
      onMouseLeave={e => hoverOut(e.currentTarget as HTMLElement)}
      style={cardStyle({ padding: '18px 20px 16px', cursor: 'pointer', position: 'relative', background: `linear-gradient(135deg, ${accent}22 0%, ${accent}0a 100%)`, borderColor: `${accent}55`, boxShadow: `0 4px 24px ${accent}20, inset 0 1px 0 ${accent}30` })}>
      {/* top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)`, borderRadius: '16px 16px 0 0' }} />
      {/* accent dot */}
      <div style={{ position: 'absolute', top: 14, right: 16, width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, margin: '0 0 10px', opacity: 0.9, paddingRight: 16 }}>{ins.title}</p>
      <p style={{ fontSize: 30, fontWeight: 500, color: '#ffffff', margin: 0, lineHeight: 1, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', fontFamily: '"DM Mono", monospace' }}>{ins.metric}</p>
      <div style={{ marginTop: 10, height: 1, background: `linear-gradient(90deg, ${accent}40, transparent)` }} />
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        {isTrend ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: trendColor, background: `${trendColor}18`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${trendColor}30` }}>{trendLabel}</span>
        ) : ins.metricLabel ? (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.03em' }}>{ins.metricLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function InsightTextCard({ ins, accent, cardRef, onClick }: { ins: InsightData; accent: string; cardRef?: (el: HTMLDivElement | null) => void; onClick: () => void }) {
  const bullets = ins.subtitle?.split('\n').filter(Boolean) ?? [];
  return (
    <div data-animate ref={cardRef} onClick={onClick}
      onMouseEnter={e => hoverIn(e.currentTarget as HTMLElement, accent)}
      onMouseLeave={e => hoverOut(e.currentTarget as HTMLElement)}
      style={cardStyle({ padding: '16px 18px', cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' })}>
      <div style={accentLine(accent)} />
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff', margin: '0 0 10px' }}>{ins.title}</p>
      {bullets.length > 1 ? (
        <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 12, color: 'rgba(200,220,240,0.85)', lineHeight: 1.5, letterSpacing: '0.01em' }}>{b}</li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13, color: 'rgba(200,220,240,0.85)', margin: 0, lineHeight: 1.6 }}>{ins.subtitle ?? ins.metric}</p>
      )}
    </div>
  );
}

function ChartCard({ ins, accent, cardRef, onClick, style, preview = false }: { ins: InsightData; accent: string; cardRef?: (el: HTMLDivElement | null) => void; onClick: () => void; style?: React.CSSProperties; preview?: boolean }) {
  const canonicalH = getChartMinH(ins);
  const outerH = (style?.height as number | undefined) ?? canonicalH + 36;
  const chartType = (ins.chartOptions as Record<string, unknown>)?._auroraType as string ?? 'bar';
  const isProgress = chartType === 'progress';
  // Progress charts need flexible height to show all items
  const chartH = isProgress ? undefined : (outerH - 36);
  return (
    <div data-animate ref={cardRef} onClick={onClick}
      onMouseEnter={e => hoverIn(e.currentTarget as HTMLElement, accent)}
      onMouseLeave={e => hoverOut(e.currentTarget as HTMLElement)}
      style={cardStyle({ display: 'flex', flexDirection: 'column', padding: '12px 14px', cursor: 'pointer', position: 'relative', ...style, height: isProgress ? 'auto' : outerH, minHeight: isProgress ? canonicalH + 36 : undefined })}>
      <div style={accentLine(accent)} />
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff', margin: '0 0 8px', flexShrink: 0 }}>{ins.title}</p>
      <div style={isProgress ? { flex: 1 } : { height: chartH, flexShrink: 0 }}><AutoHeightChart insight={ins} height={chartH} preview={preview} /></div>
    </div>
  );
}

function HeaderBar({ query, description, onNewQuery }: { query: string | null; description: string | null; onNewQuery: () => void }) {
  return (
    <div data-animate style={cardStyle({ gridColumn: 'span 2', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', background: 'rgba(0,200,240,0.04)', borderColor: 'rgba(0,200,240,0.12)' })}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, rgba(0,200,240,0.7) 40%, rgba(100,120,255,0.5) 70%, transparent 100%)', borderRadius: '16px 16px 0 0' }} />
      <button onClick={onNewQuery} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: 'rgba(0,200,240,0.08)', border: '1px solid rgba(0,200,240,0.2)', color: 'rgba(0,200,240,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,240,0.16)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,240,0.08)'; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <div style={{ width: 1, height: 32, background: 'rgba(0,200,240,0.15)', flexShrink: 0 }} />
      <h1 style={{ flex: 1, fontSize: 17, fontWeight: 300, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.04em', lineHeight: 1.4, opacity: 0.85 }}>{query}</h1>
      {description && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(0,200,240,0.08)', border: '1px solid rgba(0,200,240,0.18)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,240,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span style={{ fontSize: 11, color: 'rgba(0,200,240,0.8)', fontWeight: 500, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{description}</span>
        </div>
      )}
    </div>
  );
}

function useGridAnimation(visible: boolean, containerRef: React.RefObject<HTMLDivElement | null>, onReset: () => void) {
  const hasAnimated = useRef(false);
  useEffect(() => { if (!visible) hasAnimated.current = false; }, [visible]);
  useEffect(() => {
    if (!visible || hasAnimated.current || !containerRef.current) return;
    const allEls = containerRef.current.querySelectorAll<HTMLElement>('[data-animate]');
    allEls.forEach(el => gsap.set(el, { opacity: 0, y: 20, scale: 0.97 }));
    let rafId: number;
    const tryAnimate = () => {
      if (!Array.from(allEls).every(el => el.offsetWidth > 0)) { rafId = requestAnimationFrame(tryAnimate); return; }
      allEls.forEach((el, i) => gsap.to(el, { opacity: 1, y: 0, scale: 1, duration: 0.55, delay: i * 0.07, ease: 'power3.out' }));
      hasAnimated.current = true;
    };
    rafId = requestAnimationFrame(tryAnimate);
    return () => cancelAnimationFrame(rafId);
  }, [visible]);

  const handleNewQuery = () => {
    if (!containerRef.current) { onReset(); return; }
    const allEls = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-animate]'));
    allEls.forEach((el, i) => gsap.to(el, { opacity: 0, scale: 0.88, y: 12, duration: 0.3, delay: i * 0.02, ease: 'power2.in', overwrite: true }));
    gsap.delayedCall(0.3 + allEls.length * 0.02, onReset);
  };
  return { handleNewQuery };
}

function LayoutRenderer({ insights, cursor, query, description, onReset, visible, cardRefs, onExpand, layoutHint }: GridProps) {
  const variant = layoutHint?.variant ?? 'procedural';
  switch (variant) {
    case 'procedural': return <ProceduralLayout insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} gridSpec={layoutHint?.gridSpec} />;
    case 'hero':       return <HeroLayout       insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
    case 'bento-asym': return <BentoAsymLayout  insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
    case 'comparison': return <ComparisonLayout insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
    case 'focus':      return <FocusLayout      insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
    case 'minimal':    return <MinimalLayout    insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
    default:           return <BentoSymLayout   insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// PROCEDURAL LAYOUT
// ───────────────────────────────────────────────────────────────────────────

type ProceduralProps = LayoutProps & { gridSpec?: GridSpec };

function ProceduralLayout({ insights, query, description, onReset, visible, cardRefs, onExpand, gridSpec }: ProceduralProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);

  // Build a lookup: insightId → insight
  const byId = React.useMemo(() => {
    const m: Record<string, InsightData> = {};
    insights.forEach(i => { m[i.id] = i; });
    return m;
  }, [insights]);

  // Compute total required height: sum of unique row heights + gaps
  // Each cell's rowStart maps to a row; we sum the max minH per unique rowStart
  const requiredH = React.useMemo(() => {
    if (!gridSpec) return 600;
    // Collect unique rowStarts and their max minH using the same simulation as cellRowStart
    const COLS = gridSpec.cols;
    const colCursor = new Array(COLS).fill(0);
    const rowMap = new Map<number, number>();
    gridSpec.cells.forEach(cell => {
      const startCol = colCursor.indexOf(Math.min(...colCursor.slice(0, COLS - cell.colSpan + 1)));
      const rowStart = Math.max(...colCursor.slice(startCol, startCol + cell.colSpan));
      rowMap.set(rowStart, Math.max(rowMap.get(rowStart) ?? 0, cell.minH));
      const rowEnd = rowStart + cell.minH + GAP;
      for (let c = startCol; c < startCol + cell.colSpan; c++) colCursor[c] = rowEnd;
    });
    // Total = sum of all row heights + gaps between them + bottom padding
    let total = 0;
    rowMap.forEach(h => { total += h + GAP; });
    return total + 32;
  }, [gridSpec]);

  const baseZoom = insights.length <= 4 ? 1.2 : insights.length <= 7 ? 1.05 : 0.95;
  const zoom = useAdaptiveZoom(containerRef, requiredH, baseZoom);

  if (!gridSpec) {
    // Fallback to BentoSymLayout if no spec
    return <BentoSymLayout insights={insights} query={query} description={description} onReset={onReset} visible={visible} cardRefs={cardRefs} onExpand={onExpand} />;
  }

  const COLS = gridSpec.cols;

  // Compute max height per CSS grid row so all cards in the same row share the same height
  // We simulate row placement using a column cursor (same logic as requiredH above)
  const rowHeights = React.useMemo(() => {
    const colCursor = new Array(COLS).fill(0);
    const rowMap = new Map<number, number>(); // rowStart → maxMinH
    gridSpec.cells.forEach(cell => {
      if (cell.insightId === '__header__') return;
      const startCol = colCursor.indexOf(Math.min(...colCursor.slice(0, COLS - cell.colSpan + 1)));
      const rowStart = Math.max(...colCursor.slice(startCol, startCol + cell.colSpan));
      rowMap.set(rowStart, Math.max(rowMap.get(rowStart) ?? 0, cell.minH));
      const rowEnd = rowStart + cell.minH + GAP;
      for (let c = startCol; c < startCol + cell.colSpan; c++) colCursor[c] = rowEnd;
    });
    return rowMap;
  }, [gridSpec, COLS]);

  // Map each cell to its rowStart so we can look up the row's max height
  const cellRowStart = React.useMemo(() => {
    const colCursor = new Array(COLS).fill(0);
    const map = new Map<string, number>();
    gridSpec.cells.forEach(cell => {
      if (cell.insightId === '__header__') return;
      const startCol = colCursor.indexOf(Math.min(...colCursor.slice(0, COLS - cell.colSpan + 1)));
      const rowStart = Math.max(...colCursor.slice(startCol, startCol + cell.colSpan));
      map.set(cell.insightId, rowStart);
      const rowEnd = rowStart + cell.minH + GAP;
      for (let c = startCol; c < startCol + cell.colSpan; c++) colCursor[c] = rowEnd;
    });
    return map;
  }, [gridSpec, COLS]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, minHeight: 0, height: '100%', padding: '16px 20px', overflow: 'hidden', zoom,
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridAutoRows: 'min-content',
        gap: GAP,
        alignContent: 'start',
      }}
    >
      {gridSpec.cells.map((cell, idx) => {
        const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];

        // Special: header cell
        if (cell.insightId === '__header__') {
          return (
            <div key="__header__" style={{ gridColumn: `span ${cell.colSpan}` }}>
              <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
            </div>
          );
        }

        const ins = byId[cell.insightId];
        if (!ins) return null;

        const isKpi = !ins.chartOptions && !ins.listItems && ins.chartType !== 'text';
        const isText = ins.chartType === 'text';

        // Use the row's max height so all cards in the same row are equal height
        const rowStart = cellRowStart.get(cell.insightId) ?? 0;
        const rowMaxH  = rowHeights.get(rowStart) ?? cell.minH;

        if (isText) {
          return (
            <div key={ins.id} style={{ gridColumn: `span ${cell.colSpan}`, gridRow: `span ${cell.rowSpan}`, height: rowMaxH }}>
              <InsightTextCard
                ins={ins}
                accent={accent}
                cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
                onClick={() => onExpand(ins)}
              />
            </div>
          );
        }

        if (isKpi) {
          return (
            <div key={ins.id} style={{ gridColumn: `span ${cell.colSpan}`, gridRow: `span ${cell.rowSpan}`, minHeight: cell.minH, display: 'flex', flexDirection: 'column' }}>
              <KpiCard
                ins={ins}
                accent={accent}
                cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
                onClick={() => onExpand(ins)}
              />
            </div>
          );
        }

        return (
          <ChartCard
            key={ins.id}
            ins={ins}
            accent={accent}
            cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
            onClick={() => onExpand(ins)}
            style={{ gridColumn: `span ${cell.colSpan}`, gridRow: `span ${cell.rowSpan}`, height: rowMaxH }}
            preview={cell.rowSpan === 1}
          />
        );
      })}
    </div>
  );
}

function HeroLayout({ insights, query, description, onReset, visible, cardRefs, onExpand }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);
  const kpis      = insights.filter(i => !i.chartOptions && !i.listItems);
  const charts    = insights.filter(i => !!i.chartOptions);
  const primary   = charts[0] ?? null;
  const secondary = charts.slice(1);

  const kpiGridH  = kpis.length > 0 ? Math.ceil(kpis.slice(0, 4).length / 2) * (KPI_H + GAP) : 0;
  const secH      = secondary.reduce((s, c) => s + getChartMinH(c) + 36 + GAP, 0);
  const requiredH = HEADER_H + GAP + kpiGridH + secH + 32;
  const baseZoom  = insights.length <= 4 ? 1.3 : insights.length <= 7 ? 1.1 : 0.95;
  const zoom      = useAdaptiveZoom(containerRef, requiredH, baseZoom);

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', minHeight: 0, padding: '16px 20px', gap: GAP, zoom, overflow: 'hidden' }}>
      <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>
        <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
        {kpis.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP, flexShrink: 0 }}>
            {kpis.slice(0, 4).map((ins, i) => (
              <KpiCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length]}
                cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)} />
            ))}
          </div>
        )}
        {secondary.map((ins, i) => (
          <ChartCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 3) % ACCENT_COLORS.length]}
            cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
            onClick={() => onExpand(ins)}
            style={{ flexShrink: 0, height: getChartMinH(ins) + 36 }}
            preview />
        ))}
      </div>
      {primary && (
        <div style={{ flex: '0 0 62%', minWidth: 0 }}>
          <ChartCard ins={primary} accent={ACCENT_COLORS[0]}
            cardRef={el => { cardRefs.current[insights.indexOf(primary)] = el; }}
            onClick={() => onExpand(primary)} style={{ height: '100%', minHeight: getChartMinH(primary) + 36 }} />
        </div>
      )}
    </div>
  );
}

function BentoAsymLayout({ insights, query, description, onReset, visible, cardRefs, onExpand }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);
  const kpis      = insights.filter(i => !i.chartOptions && !i.listItems).slice(0, 4);
  const charts    = insights.filter(i => !!i.chartOptions);
  const primary   = charts[0] ?? null;
  const secondary = charts.slice(1);

  const kpiGridH  = kpis.length > 0 ? Math.ceil(kpis.length / 2) * (KPI_H + GAP) : 0;
  const secH      = secondary.reduce((s, c) => s + getChartMinH(c) + 36 + GAP, 0);
  const requiredH = HEADER_H + GAP + kpiGridH + secH + 32;
  const baseZoom  = insights.length <= 5 ? 1.2 : insights.length <= 8 ? 1.0 : 0.85;
  const zoom      = useAdaptiveZoom(containerRef, requiredH, baseZoom);

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', minHeight: 0, padding: '16px 20px', gap: GAP, zoom, overflow: 'hidden' }}>
      {primary && (
        <div style={{ flex: '0 0 62%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}>
          <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
          <ChartCard ins={primary} accent={ACCENT_COLORS[0]}
            cardRef={el => { cardRefs.current[insights.indexOf(primary)] = el; }}
            onClick={() => onExpand(primary)}
            style={{ flex: 1, minHeight: getChartMinH(primary) + 36 }} />
        </div>
      )}
      <div style={{ flex: '0 0 38%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}>
        {!primary && <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />}
        {kpis.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP, flexShrink: 0 }}>
            {kpis.map((ins, i) => (
              <KpiCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length]}
                cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)} />
            ))}
          </div>
        )}
        {secondary.map((ins, i) => (
          <ChartCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 2) % ACCENT_COLORS.length]}
            cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
            onClick={() => onExpand(ins)}
            style={{ flexShrink: 0, height: getChartMinH(ins) + 36 }}
            preview />
        ))}
      </div>
    </div>
  );
}

function BentoSymLayout({ insights, query, description, onReset, visible, cardRefs, onExpand }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);
  const kpis      = insights.filter(i => !i.chartOptions && !i.listItems);
  const charts    = insights.filter(i => !!i.chartOptions);
  const primary   = charts[0] ?? null;
  const secondary = charts.slice(1);
  const kpisLeft  = kpis.slice(0, 4);

  const kpiGridH  = kpisLeft.length > 0 ? Math.ceil(kpisLeft.length / 2) * (KPI_H + GAP) : 0;
  const secH      = secondary.reduce((s, c) => s + getChartMinH(c) + 36 + GAP, 0);
  const requiredH = HEADER_H + GAP + kpiGridH + secH + 32;
  const baseZoom  = insights.length <= 4 ? 1.4 : insights.length <= 6 ? 1.2 : insights.length <= 8 ? 1.0 : 0.85;
  const zoom      = useAdaptiveZoom(containerRef, requiredH, baseZoom);

  return (
    <div ref={containerRef} key={insights.length} style={{ flex: 1, display: 'flex', minHeight: 0, padding: '16px 20px', gap: GAP, zoom, overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}>
        <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
        {kpisLeft.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP, flexShrink: 0 }}>
            {kpisLeft.map((ins, i) => (
              <KpiCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length]}
                cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)} />
            ))}
          </div>
        )}
        {secondary.map((ins, i) => (
          <ChartCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 4) % ACCENT_COLORS.length]}
            cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
            onClick={() => onExpand(ins)}
            style={{ flexShrink: 0, height: getChartMinH(ins) + 36 }}
            preview />
        ))}
      </div>
      {primary && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <ChartCard ins={primary} accent={ACCENT_COLORS[0]}
            cardRef={el => { cardRefs.current[insights.indexOf(primary)] = el; }}
            onClick={() => onExpand(primary)} style={{ height: '100%', minHeight: getChartMinH(primary) + 36 }} />
        </div>
      )}
    </div>
  );
}

function ComparisonLayout({ insights, query, description, onReset, visible, cardRefs, onExpand }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);
  const kpis   = insights.filter(i => !i.chartOptions && !i.listItems).slice(0, 4);
  const charts = insights.filter(i => !!i.chartOptions);
  const [chartA, chartB, ...rest] = charts;

  // Required height: header + KPI row + main chart row + extra charts
  const kpiH    = kpis.length > 0 ? KPI_H + GAP : 0;
  const mainH   = Math.max(
    chartA ? getChartMinH(chartA) + 36 : 0,
    chartB ? getChartMinH(chartB) + 36 : 0,
  );
  const extraH  = rest.reduce((s, c) => s + getChartMinH(c) + 36 + GAP, 0);
  const requiredH = HEADER_H + GAP + kpiH + mainH + GAP + extraH + 32;
  const baseZoom  = insights.length <= 5 ? 1.2 : insights.length <= 8 ? 1.0 : 0.85;
  const zoom      = useAdaptiveZoom(containerRef, requiredH, baseZoom);

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 20px', gap: GAP, zoom, overflow: 'hidden' }}>
      <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
      {kpis.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(kpis.length, 2)}, 1fr)`, gap: GAP, flexShrink: 0 }}>
          {kpis.map((ins, i) => (
            <KpiCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length]}
              cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)} />
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP, flexShrink: 0, height: mainH }}>
        {chartA && <ChartCard ins={chartA} accent={ACCENT_COLORS[0]} cardRef={el => { cardRefs.current[insights.indexOf(chartA)] = el; }} onClick={() => onExpand(chartA)} style={{ height: '100%' }} />}
        {chartB && <ChartCard ins={chartB} accent={ACCENT_COLORS[3]} cardRef={el => { cardRefs.current[insights.indexOf(chartB)] = el; }} onClick={() => onExpand(chartB)} style={{ height: '100%' }} />}
      </div>
      {rest.map((ins, i) => (
        <ChartCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 5) % ACCENT_COLORS.length]}
          cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
          onClick={() => onExpand(ins)}
          style={{ flexShrink: 0, height: getChartMinH(ins) + 36 }}
          preview />
      ))}
    </div>
  );
}

function FocusLayout({ insights, query, description, onReset, visible, cardRefs, onExpand }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);
  const kpis   = insights.filter(i => !i.chartOptions && !i.listItems);
  const charts = insights.filter(i => !!i.chartOptions);
  const [hero, ...rest] = kpis;
  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 20px', gap: GAP }}>
      <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
      {hero && (
        <div data-animate ref={el => { cardRefs.current[insights.indexOf(hero)] = el; }} onClick={() => onExpand(hero)}
          onMouseEnter={e => hoverIn(e.currentTarget as HTMLElement, ACCENT_COLORS[0])}
          onMouseLeave={e => hoverOut(e.currentTarget as HTMLElement)}
          style={cardStyle({ padding: '32px 40px', cursor: 'pointer', position: 'relative', textAlign: 'center' })}>
          <div style={accentLine(ACCENT_COLORS[0])} />
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT_COLORS[0], margin: '0 0 12px' }}>{hero.title}</p>
          <p style={{ fontSize: 56, fontWeight: 700, color: '#e4f0ff', margin: 0, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{hero.metric}</p>
          {hero.metricLabel && <p style={{ fontSize: 11, color: 'rgba(120,165,220,0.5)', margin: '10px 0 0' }}>{hero.metricLabel}</p>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: GAP }}>
        {rest.map((ins, i) => (
          <KpiCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 2) % ACCENT_COLORS.length]}
            cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)} />
        ))}
      </div>
      {charts.map((ins, i) => (
        <ChartCard key={ins.id} ins={ins} accent={ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length]}
          cardRef={el => { cardRefs.current[insights.indexOf(ins)] = el; }}
          onClick={() => onExpand(ins)} style={{ flex: 1, minHeight: 200 }} preview />
      ))}
    </div>
  );
}

function MinimalLayout({ insights, query, description, onReset, visible, cardRefs, onExpand }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleNewQuery } = useGridAnimation(visible, containerRef, onReset);
  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '24px 48px', gap: GAP }}>
      <HeaderBar query={query} description={description ?? null} onNewQuery={handleNewQuery} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP, justifyContent: 'center', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        {insights.map((ins, i) => {
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
          if (ins.chartOptions) {
            return <ChartCard key={ins.id} ins={ins} accent={accent} cardRef={el => { cardRefs.current[i] = el; }} onClick={() => onExpand(ins)} style={{ minHeight: 260 }} />;
          }
          return <KpiCard key={ins.id} ins={ins} accent={accent} cardRef={el => { cardRefs.current[i] = el; }} onClick={() => onExpand(ins)} />;
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
    if (opts._auroraType) return opts._auroraType as string;
    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;
    const t = series?.[0]?.type ?? 'bar';
    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }
    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];
    return (supported.includes(t) ? t : 'bar') as string;
  })() : 'bar';

  // Adaptive modal sizing
  const WIDE_TYPES = new Set(['line','area','stacked-area','bollinger','bar-race','theme-river','calendar-heatmap','candlestick','candlestick-ma']);
  const TALL_TYPES = new Set(['map','heatmap','hierarchical-bar','diverging-bar','radial-stacked-bar','sankey','sunburst']);
  const modalMaxW = WIDE_TYPES.has(chartType) ? 1280 : TALL_TYPES.has(chartType) ? 860 : 900;
  const modalH = isStatCard ? 'auto' : WIDE_TYPES.has(chartType) ? 'min(78vh, calc(100vh - 48px))' : 'min(80vh, calc(100vh - 48px))';

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      gsap.set(backdropRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { opacity: 0, scale: 0.92, y: 24 });
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      gsap.to(cardRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.3)', delay: 0.05 });
    }));
  }, []);

  const handleClose = () => {
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(cardRef.current, { opacity: 0, scale: 0.94, y: 16, duration: 0.2, onComplete: onClose });
  };

  return (
    <div ref={backdropRef} onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 200, opacity: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', cursor: 'pointer' }}>
      <div ref={cardRef} onClick={e => e.stopPropagation()} style={{ position: 'relative', cursor: 'default', width: '100%', maxWidth: modalMaxW, height: modalH, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', opacity: 0 }}>
        <button onClick={handleClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ flexShrink: 0, padding: '28px 56px 20px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div><h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{insight.title}</h2>{insight.subtitle && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 0 }}>{insight.subtitle}</p>}</div>
            {insight.metric && <div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ fontSize: isStatCard ? 56 : 36, fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{insight.metric}</p>{insight.metricLabel && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>{insight.metricLabel}</p>}</div>}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border-color)', flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' }}>
          {auroraData && !isList && (chartType as string) === 'map' && (
            <div style={{ flex: 1, minHeight: 0 }}>
              <MexicoMapChart data={auroraData.labels.map((name, i) => ({ name, value: (auroraData.datasets?.[0]?.data?.[i] as number) ?? 0 }))} height="100%" gradient="aurora" bare />
            </div>
          )}
          {auroraData && !isList && (chartType as string) === 'progress' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{renderChart(insight, 400, true)}</div>
          )}
          {auroraData && !isList && (chartType as string) !== 'map' && (chartType as string) !== 'progress' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <AuroraChart type={chartType as never} data={auroraData} gradient="aurora" height="100%" bare />
            </div>
          )}
          {!auroraData && !isList && insight.chartOptions && !!(insight.chartOptions as Record<string,unknown>).series && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <EChartsRaw opts={insight.chartOptions as Record<string,unknown>} height={400} />
            </div>
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
