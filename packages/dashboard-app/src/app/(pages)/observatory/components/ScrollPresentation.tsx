'use client';

import { useEffect, useRef, useState } from 'react';
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

  const totalSlides = insights.length + 2; // header + insights + end

  // Auto-play
  useEffect(() => {
    if (!autoPlay || viewMode !== 'presentation') return;
    const timer = setTimeout(() => {
      if (currentSlide < totalSlides - 1) {
        setCurrentSlide(s => s + 1);
      } else {
        setAutoPlay(false);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [autoPlay, currentSlide, viewMode, totalSlides]);

  const goToSlide = (i: number) => {
    setAutoPlay(false);
    setCurrentSlide(i);
  };

  const nextSlide = () => {
    setAutoPlay(false);
    if (currentSlide < totalSlides - 1) setCurrentSlide(s => s + 1);
  };

  const prevSlide = () => {
    setAutoPlay(false);
    if (currentSlide > 0) setCurrentSlide(s => s - 1);
  };

  // Keyboard navigation
  useEffect(() => {
    if (viewMode !== 'presentation') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevSlide();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewMode, currentSlide]);

  return (
    <div style={{ 
      position: 'absolute',
      inset: 0,
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {viewMode === 'presentation' ? (
        <PresentationMode
          insights={insights}
          cursor={cursor}
          query={query}
          onReset={onReset}
          currentSlide={currentSlide}
          totalSlides={totalSlides}
        />
      ) : (
        <GridMode 
          insights={insights} 
          cursor={cursor} 
          query={query} 
          onReset={onReset} 
        />
      )}

      {/* Controls */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {viewMode === 'presentation' && (
          <GlassPanel cursor={cursor} depth={0.15} glowOnHover={false}>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                color: autoPlay ? 'var(--primary)' : 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {autoPlay ? '⏸' : '▶'} {currentSlide + 1}/{totalSlides}
            </button>
          </GlassPanel>
        )}

        <GlassPanel cursor={cursor} depth={0.15} glowOnHover={false}>
          <div style={{ display: 'flex', padding: 4, gap: 2 }}>
            <ModeButton 
              active={viewMode === 'presentation'} 
              onClick={() => setViewMode('presentation')}
              label="Slides"
            />
            <ModeButton 
              active={viewMode === 'grid'} 
              onClick={() => setViewMode('grid')}
              label="Grid"
            />
          </div>
        </GlassPanel>
      </div>

      {/* Slide dots */}
      {viewMode === 'presentation' && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          gap: 6,
        }}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              style={{
                width: currentSlide === i ? 20 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                background: currentSlide === i ? 'var(--primary)' : 'var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Nav arrows */}
      {viewMode === 'presentation' && (
        <>
          {currentSlide > 0 && (
            <button
              onClick={prevSlide}
              style={{
                position: 'fixed',
                left: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ‹
            </button>
          )}
          {currentSlide < totalSlides - 1 && (
            <button
              onClick={nextSlide}
              style={{
                position: 'fixed',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ›
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? 'var(--primary-light)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: active ? 'var(--primary)' : 'var(--text-tertiary)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESENTATION MODE - Simple slide-based
// ═══════════════════════════════════════════════════════════════════════════

function PresentationMode({ insights, cursor, query, onReset, currentSlide, totalSlides }: {
  insights: InsightData[];
  cursor: CursorState;
  query: string | null;
  onReset: () => void;
  currentSlide: number;
  totalSlides: number;
}) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Header slide */}
      <Slide isActive={currentSlide === 0}>
        <HeaderContent query={query} count={insights.length} />
      </Slide>

      {/* Insight slides */}
      {insights.map((insight, i) => (
        <Slide key={insight.id} isActive={currentSlide === i + 1}>
          <InsightContent insight={insight} cursor={cursor} index={i} total={insights.length} />
        </Slide>
      ))}

      {/* End slide */}
      <Slide isActive={currentSlide === totalSlides - 1}>
        <EndContent cursor={cursor} onReset={onReset} />
      </Slide>
    </div>
  );
}

function Slide({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      opacity: isActive ? 1 : 0,
      scale: isActive ? 1 : 0.97,
      y: isActive ? 0 : 20,
      duration: 0.55,
      ease: 'power3.out',
      pointerEvents: isActive ? 'auto' : 'none',
    });
  }, [isActive]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 48px 72px',
        opacity: 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function HeaderContent({ query, count }: { query: string | null; count: number }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 700 }}>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--primary)',
        marginBottom: 16,
      }}>
        Executive Intelligence
      </p>
      <h1 style={{
        fontSize: 36,
        fontWeight: 700,
        color: 'var(--text)',
        margin: 0,
        lineHeight: 1.3,
      }}>
        {query}
      </h1>
      <p style={{
        fontSize: 15,
        color: 'var(--text-tertiary)',
        marginTop: 16,
      }}>
        {count} insights generated
      </p>
    </div>
  );
}

function EndContent({ cursor, onReset }: { cursor: CursorState; onReset: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginBottom: 12,
      }}>
        Analysis Complete
      </p>
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--text)',
        margin: '0 0 24px',
      }}>
        Ready for your next question
      </h2>
      <GlassPanel cursor={cursor} depth={0.2} glowOnHover={false}>
        <button
          onClick={onReset}
          style={{
            padding: '14px 28px',
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          New Query
        </button>
      </GlassPanel>
    </div>
  );
}

function InsightContent({ insight, cursor, index, total }: {
  insight: InsightData;
  cursor: CursorState;
  index: number;
  total: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const isStatCard = !insight.chartOptions;

  useEffect(() => {
    if (isStatCard) return;
    const el = document.getElementById(`insight-chart-${insight.id}`);
    if (!el) return;

    let instance: echarts.ECharts | null = null;
    let ro: ResizeObserver | null = null;
    let initialized = false;

    function tryInit() {
      if (initialized || !el || el.clientHeight < 50) return;
      initialized = true;
      instance = echarts.init(el, null, { renderer: 'canvas' });
      instance.setOption({
        ...insight.chartOptions,
        backgroundColor: 'transparent',
        animation: true,
        animationDuration: 900,
        animationEasing: 'cubicOut',
      } as echarts.EChartsOption);
      instance.resize();
      // Keep ResizeObserver for window resizes after init
      ro = new ResizeObserver(() => instance?.resize());
      ro.observe(el);
    }

    // Poll until the slide is visible and the div has real height
    const poll = setInterval(() => {
      if (el.clientHeight >= 50) {
        clearInterval(poll);
        tryInit();
      }
    }, 50);

    return () => {
      clearInterval(poll);
      ro?.disconnect();
      instance?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      width: '100%',
      maxWidth: isStatCard ? 600 : 1100,
      marginLeft: 'auto',
      marginRight: 'auto',
      display: 'flex',
      flexDirection: 'column',
      ...(isStatCard ? {} : { flex: 1, minHeight: 0, alignSelf: 'stretch' }),
    }}>
      <GlassPanel
        cursor={cursor}
        depth={0.2}
        glowOnHover={false}
        style={isStatCard ? {} : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div style={{
          padding: isStatCard ? '48px 56px' : '28px 40px 24px',
          display: 'flex',
          flexDirection: 'column',
          ...(isStatCard ? {} : { flex: 1, minHeight: 0 }),
        }}>

          {/* Counter */}
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            color: 'var(--text-tertiary)',
            marginBottom: 14,
            textTransform: 'uppercase',
          }}>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>

          {/* Header row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isStatCard ? 'center' : 'flex-start',
            gap: 32,
            marginBottom: isStatCard ? 0 : 20,
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
                {insight.title}
              </h2>
              {insight.subtitle && (
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {insight.subtitle}
                </p>
              )}
            </div>
            {insight.metric && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                  fontSize: isStatCard ? 72 : 44,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  margin: 0,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}>
                  {insight.metric}
                </p>
                {insight.metricLabel && (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    {insight.metricLabel}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Chart — takes all remaining space */}
          {!isStatCard && (
            <div
              id={`insight-chart-${insight.id}`}
              ref={chartRef}
              style={{ flex: 1, minHeight: 0 }}
            />
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID MODE - Scrollable grid with expandable cards
// ═══════════════════════════════════════════════════════════════════════════

function GridMode({ insights, cursor, query, onReset }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [expandedInsight, setExpandedInsight] = useState<InsightData | null>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('[data-card]');
    gsap.fromTo(cards,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }
    );
  }, []);

  // Close on ESC
  useEffect(() => {
    if (!expandedInsight) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedInsight(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expandedInsight]);

  return (
    <div style={{ 
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Fixed Header */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg)',
        padding: '20px 32px 16px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <p style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              margin: '0 0 4px',
            }}>
              Executive Intelligence
            </p>
            <h1 style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}>
              {query}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}>
              {insights.length} insights
            </span>
            <button
              onClick={onReset}
              style={{
                padding: '8px 16px',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              New Query
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Grid */}
      <div 
        ref={gridRef}
        style={{ 
          flex: 1,
          overflow: 'auto',
          padding: '24px 32px 100px',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 20,
        }}>
          {insights.map((insight) => (
            <GridCard 
              key={insight.id} 
              insight={insight} 
              cursor={cursor}
              onClick={() => setExpandedInsight(insight)}
            />
          ))}
        </div>
      </div>

      {/* Expanded Modal */}
      {expandedInsight && (
        <ExpandedModal 
          insight={expandedInsight} 
          cursor={cursor}
          onClose={() => setExpandedInsight(null)} 
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPANDED MODAL
// ═══════════════════════════════════════════════════════════════════════════

function ExpandedModal({ insight, cursor, onClose }: { 
  insight: InsightData; 
  cursor: CursorState;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    gsap.fromTo(backdropRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' }
    );
    gsap.fromTo(cardRef.current,
      { opacity: 0, scale: 0.85, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)', delay: 0.1 }
    );
  }, []);

  useEffect(() => {
    if (!chartRef.current || !insight.chartOptions) return;
    let instance: echarts.ECharts | null = null;
    let ro: ResizeObserver | null = null;
    const t = setTimeout(() => {
      if (!chartRef.current) return;
      instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
      instance.setOption({
        ...insight.chartOptions,
        backgroundColor: 'transparent',
        animation: true,
        animationDuration: 800,
      } as echarts.EChartsOption);
      ro = new ResizeObserver(() => instance?.resize());
      ro.observe(chartRef.current);
    }, 550);
    return () => {
      clearTimeout(t);
      ro?.disconnect();
      instance?.dispose();
    };
  }, [insight.chartOptions]);

  const handleClose = () => {
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(cardRef.current, { 
      opacity: 0, scale: 0.9, y: 20, duration: 0.2, 
      onComplete: onClose 
    });
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        cursor: 'pointer',
        opacity: 0,
      }}
    >
      <div
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 880,
          maxHeight: '80vh',
          overflow: 'auto',
          cursor: 'default',
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          opacity: 0,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1px solid var(--border-color)',
            background: 'var(--bg)',
            color: 'var(--text-tertiary)',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ×
        </button>

        <div style={{ padding: '28px 36px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            marginBottom: 24,
            paddingRight: 30,
          }}>
            <div>
              <h2 style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}>
                {insight.title}
              </h2>
              {insight.subtitle && (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {insight.subtitle}
                </p>
              )}
            </div>
            {insight.metric && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                  fontSize: 38,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  margin: 0,
                  lineHeight: 1,
                }}>
                  {insight.metric}
                </p>
                {insight.metricLabel && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {insight.metricLabel}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Chart */}
          {insight.chartOptions && <div ref={chartRef} style={{ height: 340 }} />}
        </div>
      </div>
    </div>
  );
}

function GridCard({ insight, cursor, onClick }: { 
  insight: InsightData; 
  cursor: CursorState;
  onClick: () => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isStatCard = !insight.chartOptions;

  useEffect(() => {
    if (isStatCard || !cardRef.current) return;
    let instance: echarts.ECharts | null = null;
    let ro: ResizeObserver | null = null;
    let rafId: number;

    // Poll until card is visible (GSAP stagger sets opacity > 0)
    function waitForVisible() {
      const el = cardRef.current;
      if (!el) return;
      const opacity = parseFloat(getComputedStyle(el).opacity);
      if (opacity > 0.5 && chartRef.current && !instance) {
        instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        instance.setOption({
          ...insight.chartOptions,
          backgroundColor: 'transparent',
          animation: true,
          animationDuration: 600,
        } as echarts.EChartsOption);
        instance.resize();
        ro = new ResizeObserver(() => instance?.resize());
        ro.observe(chartRef.current);
      } else if (!instance) {
        rafId = requestAnimationFrame(waitForVisible);
      }
    }
    rafId = requestAnimationFrame(waitForVisible);

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      instance?.dispose();
    };
  }, [insight.chartOptions, isStatCard]);

  return (
    <div 
      data-card
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        opacity: 0,
        gridColumn: insight.isPrimary ? '1 / -1' : undefined,
        cursor: 'pointer',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: `1px solid ${isHovered ? 'var(--primary)' : 'var(--border-color)'}`,
        boxShadow: isHovered ? 'var(--shadow-lg)' : 'var(--shadow)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isStatCard ? 'center' : 'flex-start',
            gap: 12,
            marginBottom: isStatCard ? 0 : 14,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                margin: 0,
              }}>
                {insight.title}
              </p>
              {insight.subtitle && (
                <p style={{ 
                  fontSize: 12, 
                  color: 'var(--text-tertiary)', 
                  margin: '4px 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {insight.subtitle}
                </p>
              )}
            </div>
            {insight.metric && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                  fontSize: isStatCard ? 28 : 20,
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                  lineHeight: 1,
                }}>
                  {insight.metric}
                </p>
                {isStatCard && insight.metricLabel && (
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                    {insight.metricLabel}
                  </p>
                )}
              </div>
            )}
          </div>
          {!isStatCard && (
            <div
              ref={chartRef}
              style={{ height: insight.isPrimary ? 220 : (insight.chartType === 'pie' ? 180 : 150) }}
            />
          )}
        </div>
        
        {/* Expand hint on hover */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 10,
          fontSize: 9,
          color: 'var(--text-tertiary)',
          opacity: isHovered ? 0.8 : 0,
          transition: 'opacity 0.2s ease',
        }}>
          Click to expand
        </div>
      </div>
    </div>
  );
}
