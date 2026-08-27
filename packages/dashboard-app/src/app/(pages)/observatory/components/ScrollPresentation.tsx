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
          {auroraData && chartType === 'map' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
              <MexicoMapChart
                data={auroraData.labels.map((name, i) => ({ name, value: (auroraData.datasets?.[0]?.data?.[i] as number) ?? 0 }))}
                height={340}
                gradient="aurora"
                bare
              />
            </div>
          )}
          {auroraData && chartType === 'progress' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8, overflowY: 'auto' }}>
              {renderChart(insight, 340, true)}
            </div>
          )}
          {auroraData && chartType !== 'map' && chartType !== 'progress' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
              <AuroraChart type={chartType} data={auroraData} gradient="aurora" height={340} />
            </div>
          )}
          {!auroraData && insight.chartOptions && (insight.chartOptions as Record<string,unknown>).series && (
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
// GRID MODE
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT_COLORS = ['#7c6fff','#06b6d4','#34d399','#f472b6','#fb923c','#a78bfa','#38bdf8','#4ade80'];
const GAP = 14;

function renderChart(insight: InsightData, height: number, bare = false, preview = false) {
  const opts = insight.chartOptions as Record<string, unknown>;
  const auroraData = opts._auroraData as { labels: string[]; datasets: { label?: string; data: number[] }[] } | undefined;
  const chartType = (opts._auroraType as string) ?? 'bar';

  if (chartType === 'map' && auroraData) {
    const mapData = auroraData.labels.map((name, i) => ({
      name,
      value: (auroraData.datasets?.[0]?.data?.[i] as number) ?? 0,
    }));
    return <MexicoMapChart data={mapData} height={bare ? '100%' : height} gradient="aurora" bare={bare} />;
  }

  if (chartType === 'progress' && auroraData) {
    const PROGRESS_COLORS = ['#0CF49B','#60a5fa','#fb923c','#f472b6','#c084fc','#67e8f9','#fcd34d','#818cf8'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
        {auroraData.labels.map((label, i) => {
          const value = Math.min(100, Math.max(0, auroraData.datasets?.[0]?.data?.[i] ?? 0));
          const color = PROGRESS_COLORS[i % PROGRESS_COLORS.length];
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

  // Heatmap preview: slice to max 4 rows × 6 cols so it fits the card
  // Radar preview: slice to max 4 indicators
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

function AutoHeightChart({ insight, preview = false }: { insight: InsightData; preview?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(200);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height;
      if (height > 10) setH(height);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {renderChart(insight, h, true, preview)}
    </div>
  );
}

function GridMode({ insights, cursor, query, onReset, visible, cardRefs, onExpand }: Props & { visible: boolean; cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>; onExpand: (insight: InsightData) => void; onReset: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  // Split: KPIs, primary chart (first), all secondary charts (rest), lists
  const kpis      = insights.filter(ins => !ins.chartOptions && !ins.listItems);
  const charts    = insights.filter(ins => !!ins.chartOptions);
  const lists     = insights.filter(ins => !!ins.listItems);
  const primary   = charts[0] ?? null;
  const secondary = charts.slice(1); // ALL secondary charts go LEFT
  const txList    = lists[0] ?? null;

  // Derived stats from TransactionList
  const allItems = lists.flatMap(l => l.listItems ?? []);
  const positiveRate = allItems.length > 0 ? Math.round((allItems.filter(i => i.status === 'positive').length / allItems.length) * 100) : null;
  const negativeRate = allItems.length > 0 ? Math.round((allItems.filter(i => i.status === 'negative').length / allItems.length) * 100) : null;

  useEffect(() => { if (!visible) { hasAnimated.current = false; } }, [visible]);
  useEffect(() => {
    if (!visible || hasAnimated.current || !containerRef.current) return;
    const allEls = containerRef.current.querySelectorAll<HTMLElement>('[data-animate]');
    allEls.forEach(el => gsap.set(el, { opacity: 0, y: 20, scale: 0.97 }));
    let rafId: number;
    const tryAnimate = () => {
      const allReady = Array.from(allEls).every(el => el.offsetWidth > 0);
      if (!allReady) { rafId = requestAnimationFrame(tryAnimate); return; }
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

  const CARD = (extra?: React.CSSProperties): React.CSSProperties => ({
    borderRadius: 20,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease',
    ...extra,
  });

  const accentLine = (color: string) => ({
    position: 'absolute' as const,
    top: 0, left: '15%', right: '15%', height: 1,
    background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
  });

  const kpisLeft = kpis.slice(0, 4); // max 4 KPIs en izquierda (2 filas)
  const kpiRows = Math.ceil(kpisLeft.length / 2);
  const secRows = secondary.length;

  // Auto-zoom: scale up by default, reduce when many components
  const totalComponents = kpisLeft.length + secondary.length + (primary ? 1 : 0) + (txList ? 1 : 0);
  const zoom = totalComponents <= 4 ? 1.4 : totalComponents <= 6 ? 1.2 : totalComponents <= 8 ? 1.0 : totalComponents <= 10 ? 0.85 : 0.75;

  return (
    <div ref={containerRef} key={totalComponents} style={{ flex: 1, display: 'flex', minHeight: 0, padding: '16px 20px', gap: GAP, zoom }}>

      {/* LEFT: header + KPIs (max 4) + ALL secondary charts */}
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: `auto repeat(${kpiRows}, auto) repeat(${secRows}, minmax(180px, 1fr))`, gap: GAP }}>

        {/* Header */}
        <div data-animate style={{ ...CARD({ gridColumn: 'span 2', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12, position: 'relative' }) }}>
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, var(--primary)66, transparent)' }} />
          <button onClick={handleNewQuery} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg><span>New</span></button>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--primary)', margin: '0 0 5px', opacity: 0.8 }}>Executive Intelligence</p>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{query}</h1>
          </div>
        </div>

        {/* KPIs — max 4, 2 per row, auto height */}
        {kpisLeft.map((ins, i) => {
          const accent = ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length];
          return (
            <div key={ins.id} data-animate ref={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)}
              onMouseEnter={e => { gsap.to(e.currentTarget, { scale: 1.03, duration: 0.2, ease: 'power2.out', overwrite: 'auto' }); (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`; }}
              onMouseLeave={e => { gsap.to(e.currentTarget, { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' }); (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              style={{ ...CARD({ padding: '14px 16px', cursor: 'pointer', position: 'relative' }) }}>
              <div style={accentLine(accent)} />
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, margin: '0 0 6px', opacity: 0.9 }}>{ins.title}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.92)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{ins.metric}</p>
              {ins.metricLabel && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', margin: '4px 0 0' }}>{ins.metricLabel}</p>}
            </div>
          );
        })}

        {/* ALL secondary charts — each spans 2 cols, equal height via 1fr rows */}
        {secondary.map((ins, i) => {
          const accent = ACCENT_COLORS[(i + 4) % ACCENT_COLORS.length];
          return (
            <div key={ins.id} data-animate ref={el => { cardRefs.current[insights.indexOf(ins)] = el; }} onClick={() => onExpand(ins)}
              onMouseEnter={e => { gsap.to(e.currentTarget, { scale: 1.01, duration: 0.2, ease: 'power2.out', overwrite: 'auto' }); (e.currentTarget as HTMLElement).style.borderColor = `${accent}33`; }}
              onMouseLeave={e => { gsap.to(e.currentTarget, { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' }); (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              style={{ ...CARD({ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', padding: '14px 16px', cursor: 'pointer', position: 'relative' }) }}>
              <div style={accentLine(accent)} />
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, margin: '0 0 8px', flexShrink: 0, opacity: 0.9 }}>{ins.title}</p>
              <div style={{ flex: 1, minHeight: 0 }}><AutoHeightChart insight={ins} preview /></div>
            </div>
          );
        })}
      </div>

      {/* RIGHT: primary chart (flex 1) + bottom panel (resumen + tx list) */}
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateRows: '1fr auto', gap: GAP }}>

        {/* Primary chart */}
        {primary && (
          <div data-animate ref={el => { cardRefs.current[insights.indexOf(primary)] = el; }} onClick={() => onExpand(primary)}
            onMouseEnter={e => { gsap.to(e.currentTarget, { scale: 1.005, duration: 0.2, ease: 'power2.out', overwrite: 'auto' }); (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT_COLORS[0]}33`; }}
            onMouseLeave={e => { gsap.to(e.currentTarget, { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' }); (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            style={{ ...CARD({ display: 'flex', flexDirection: 'column', padding: '16px 18px', cursor: 'pointer', position: 'relative', minHeight: 0 }) }}>
            <div style={accentLine(ACCENT_COLORS[0])} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT_COLORS[0], margin: 0, opacity: 0.9 }}>{primary.title}</p>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>click to expand</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}><AutoHeightChart insight={primary} /></div>
          </div>
        )}

        {/* Bottom panel: resumen + tx list */}
        <div style={{ display: 'grid', gridTemplateColumns: txList ? '1fr 1.6fr' : '1fr', gap: GAP, minHeight: 180 }}>

          {/* Resumen derivado */}
          <div data-animate style={{ ...CARD({ display: 'flex', flexDirection: 'column', padding: '14px 16px', position: 'relative' }) }}>
            <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT_COLORS[6]}66, transparent)` }} />
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT_COLORS[6], margin: '0 0 8px', opacity: 0.9 }}>Resumen</p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
              {positiveRate !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Al corriente</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#34d399', margin: 0 }}>{positiveRate}%</p>
                </div>
              )}
              {negativeRate !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>En riesgo</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', margin: 0 }}>{negativeRate}%</p>
                </div>
              )}
              {kpis.slice(0, 4).map((kpi, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{kpi.title}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', margin: 0, flexShrink: 0 }}>{kpi.metric}</p>
                </div>
              ))}
            </div>
          </div>

          {/* TransactionList */}
          {txList && (
            <div data-animate ref={el => { cardRefs.current[insights.indexOf(txList)] = el; }} onClick={() => onExpand(txList)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT_COLORS[5]}44`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              style={{ ...CARD({ display: 'flex', flexDirection: 'column', padding: '14px 16px', cursor: 'pointer', position: 'relative' }) }}>
              <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT_COLORS[5]}66, transparent)` }} />
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT_COLORS[5], margin: '0 0 8px', flexShrink: 0, opacity: 0.9 }}>{txList.title}</p>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {txList.listItems!.slice(0, 6).map((item, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: j < 5 ? '1px solid rgba(255,255,255,0.05)' : 'none', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      {item.subtitle && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '1px 0 0' }}>{item.subtitle}</p>}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 700, margin: 0, flexShrink: 0, color: item.status === 'positive' ? '#34d399' : item.status === 'negative' ? '#f87171' : 'rgba(255,255,255,0.75)' }}>{item.amount}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
          {auroraData && !isList && chartType === 'map' && (
            <MexicoMapChart
              data={auroraData.labels.map((name, i) => ({ name, value: (auroraData.datasets?.[0]?.data?.[i] as number) ?? 0 }))}
              height={340}
              gradient="aurora"
              bare
            />
          )}
          {auroraData && !isList && chartType !== 'map' && (
            <AuroraChart type={chartType} data={auroraData} gradient="aurora" height={chartType === 'heatmap' ? Math.max(400, (auroraData.datasets?.length ?? 4) * 40 + 80) : 340} />
          )}
          {!auroraData && !isList && insight.chartOptions && (insight.chartOptions as Record<string,unknown>).series && (
            <EChartsRaw opts={insight.chartOptions as Record<string,unknown>} height={340} />
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

