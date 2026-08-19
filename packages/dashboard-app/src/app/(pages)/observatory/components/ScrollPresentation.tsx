'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as echarts from 'echarts';
import GlassPanel from './GlassPanel';
import type { CursorState } from '../hooks/useCursor';
import type { InsightData } from '../state-machine';

gsap.registerPlugin(ScrollTrigger);

// Aurora color palette
const AURORA_COLORS = ['#c084fc', '#818cf8', '#67e8f9', '#60a5fa', '#f9a8d4', '#6ee7b7'];

interface Props {
  insights: InsightData[];
  cursor: CursorState;
  query: string | null;
  onReset: () => void;
}

type ViewMode = 'presentation' | 'grid';

export default function ScrollPresentation({ insights, cursor, query, onReset }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('presentation');
  const [autoPlay, setAutoPlay] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slidesRef = useRef<HTMLDivElement[]>([]);

  const totalSlides = insights.length + 2; // header + insights + end

  // Initialize Lenis
  useEffect(() => {
    if (viewMode !== 'presentation' || !containerRef.current) return;

    const lenis = new Lenis({
      wrapper: containerRef.current,
      content: containerRef.current,
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    // Track current slide based on scroll position
    lenis.on('scroll', ({ scroll }: { scroll: number }) => {
      if (!containerRef.current) return;
      const slideHeight = window.innerHeight;
      const newSlide = Math.round(scroll / slideHeight);
      setCurrentSlide(Math.min(newSlide, totalSlides - 1));
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [viewMode, totalSlides]);

  // Auto-play logic
  useEffect(() => {
    if (!autoPlay || viewMode !== 'presentation' || !lenisRef.current) return;

    const scrollToNextSlide = () => {
      if (!lenisRef.current || currentSlide >= totalSlides - 1) {
        setAutoPlay(false);
        return;
      }

      const nextSlide = currentSlide + 1;
      const targetScroll = nextSlide * window.innerHeight;
      lenisRef.current.scrollTo(targetScroll, { duration: 1.2 });
    };

    // Wait 5 seconds then scroll to next
    autoPlayTimerRef.current = setTimeout(scrollToNextSlide, 5000);

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, currentSlide, viewMode, totalSlides]);

  // Stop auto-play on user interaction
  const handleInterrupt = useCallback(() => {
    setAutoPlay(false);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
    }
  }, []);

  // Manual navigation
  const goToSlide = useCallback((index: number) => {
    if (!lenisRef.current) return;
    handleInterrupt();
    const targetScroll = index * window.innerHeight;
    lenisRef.current.scrollTo(targetScroll, { duration: 1 });
  }, [handleInterrupt]);

  return (
    <div style={{ 
      position: 'absolute',
      inset: 0,
      background: 'var(--bg)',
    }}>
      {viewMode === 'presentation' ? (
        <div
          ref={containerRef}
          onWheel={handleInterrupt}
          onTouchStart={handleInterrupt}
          style={{
            height: '100vh',
            overflow: 'auto',
          }}
        >
          {/* Header slide */}
          <SlideWrapper ref={(el) => { if (el) slidesRef.current[0] = el; }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: 40,
            }}>
              <p style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                margin: '0 0 12px',
              }}>
                Executive Intelligence
              </p>
              <h1 style={{
                fontSize: 38,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                textAlign: 'center',
                letterSpacing: '-0.02em',
                maxWidth: 650,
              }}>
                {query}
              </h1>
              <p style={{
                fontSize: 15,
                color: 'var(--text-tertiary)',
                margin: '14px 0 0',
              }}>
                {insights.length} insights generated
              </p>
            </div>
          </SlideWrapper>

          {/* Insight slides */}
          {insights.map((insight, index) => (
            <SlideWrapper 
              key={insight.id} 
              ref={(el) => { if (el) slidesRef.current[index + 1] = el; }}
            >
              <InsightSlide
                insight={insight}
                cursor={cursor}
                index={index}
                total={insights.length}
                isActive={currentSlide === index + 1}
              />
            </SlideWrapper>
          ))}

          {/* End slide */}
          <SlideWrapper ref={(el) => { if (el) slidesRef.current[totalSlides - 1] = el; }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: 40,
              gap: 20,
            }}>
              <p style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}>
                Analysis Complete
              </p>
              <h2 style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}>
                Ready for your next question
              </h2>
              <GlassPanel cursor={cursor} depth={0.3}>
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
          </SlideWrapper>
        </div>
      ) : (
        <GridMode insights={insights} cursor={cursor} query={query} onReset={onReset} />
      )}

      {/* Controls - Bottom Left */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Auto-play indicator / interrupt button */}
        {viewMode === 'presentation' && (
          <GlassPanel cursor={cursor} depth={0.2}>
            <button
              onClick={autoPlay ? handleInterrupt : () => setAutoPlay(true)}
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
              {autoPlay ? (
                <>
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: 'var(--primary)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  Auto • {currentSlide + 1}/{totalSlides}
                </>
              ) : (
                <>
                  <span style={{ opacity: 0.5 }}>▶</span>
                  Manual • {currentSlide + 1}/{totalSlides}
                </>
              )}
            </button>
          </GlassPanel>
        )}

        {/* View mode toggle */}
        <GlassPanel cursor={cursor} depth={0.2}>
          <div style={{ display: 'flex', padding: 4, gap: 2 }}>
            <ToggleButton 
              active={viewMode === 'presentation'} 
              onClick={() => setViewMode('presentation')}
              label="Slides"
            />
            <ToggleButton 
              active={viewMode === 'grid'} 
              onClick={() => setViewMode('grid')}
              label="Grid"
            />
          </div>
        </GlassPanel>
      </div>

      {/* Slide indicators - Bottom Center (presentation mode only) */}
      {viewMode === 'presentation' && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          gap: 8,
        }}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              style={{
                width: currentSlide === i ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                background: currentSlide === i ? 'var(--primary)' : 'var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: currentSlide === i ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// Slide wrapper with snap
const SlideWrapper = ({ children, ref }: { children: React.ReactNode; ref?: React.Ref<HTMLDivElement> }) => (
  <div
    ref={ref}
    style={{
      height: '100vh',
      width: '100%',
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID MODE
// ═══════════════════════════════════════════════════════════════════════════

function GridMode({ insights, cursor, query, onReset }: Props) {
  return (
    <div style={{ 
      height: '100vh',
      overflow: 'auto',
      padding: '24px 40px 80px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
        paddingTop: 8,
      }}>
        <div>
          <p style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            margin: '0 0 4px',
          }}>
            Executive Intelligence
          </p>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}>
            {query}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {insights.length} insights
          </span>
          <GlassPanel cursor={cursor} depth={0.3}>
            <button
              onClick={onReset}
              style={{
                padding: '9px 18px',
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              New Query
            </button>
          </GlassPanel>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: 20,
      }}>
        {insights.map((insight, i) => (
          <GridCard key={insight.id} insight={insight} cursor={cursor} index={i} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHT SLIDE
// ═══════════════════════════════════════════════════════════════════════════

function InsightSlide({ insight, cursor, index, total, isActive }: {
  insight: InsightData;
  cursor: CursorState;
  index: number;
  total: number;
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const prevActive = useRef(false);

  // Aurora animation when slide becomes active
  useEffect(() => {
    const container = containerRef.current;
    const glow = glowRef.current;
    if (!container || !glow) return;

    const color = AURORA_COLORS[index % AURORA_COLORS.length];

    if (isActive && !prevActive.current) {
      // Entering: Aurora reveal
      gsap.timeline()
        .fromTo(glow,
          { opacity: 0, scale: 0.8 },
          { opacity: 0.6, scale: 1.15, duration: 0.5, ease: 'power2.out' }
        )
        .to(glow, { opacity: 0, scale: 1, duration: 0.6, ease: 'power2.inOut' });

      gsap.fromTo(container,
        { opacity: 0.3, scale: 0.95, y: 30, rotateX: 8 },
        { opacity: 1, scale: 1, y: 0, rotateX: 0, duration: 0.7, ease: 'power3.out' }
      );

      // Border shimmer
      gsap.fromTo(container,
        { boxShadow: `0 0 0px 0px ${color}00` },
        {
          boxShadow: `0 0 40px 12px ${color}55`,
          duration: 0.5,
          delay: 0.2,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          onComplete: () => gsap.set(container, { clearProps: 'boxShadow' }),
        }
      );
    } else if (!isActive && prevActive.current) {
      // Leaving: fade out
      gsap.to(container, {
        opacity: 0.3,
        scale: 0.95,
        duration: 0.4,
        ease: 'power2.in',
      });
    }

    prevActive.current = isActive;
  }, [isActive, index]);

  // Chart initialization — mount immediately, don't wait for isActive
  useEffect(() => {
    if (!chartRef.current) return;
    const instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    chartInstance.current = instance;
    instance.setOption({
      ...insight.chartOptions,
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 1000,
    } as echarts.EChartsOption);
    setChartReady(true);
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(chartRef.current);
    return () => {
      ro.disconnect();
      instance.dispose();
      chartInstance.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowColor = AURORA_COLORS[index % AURORA_COLORS.length];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '50px 40px',
      perspective: '1200px',
    }}>
      <div style={{ 
        position: 'relative',
        width: '100%', 
        maxWidth: insight.isPrimary ? 900 : 750,
      }}>
        {/* Aurora glow layer */}
        <div
          ref={glowRef}
          style={{
            position: 'absolute',
            inset: -30,
            background: `radial-gradient(ellipse at 50% 30%, ${glowColor}44 0%, transparent 65%)`,
            borderRadius: 'var(--radius)',
            pointerEvents: 'none',
            zIndex: -1,
            filter: 'blur(25px)',
            opacity: 0,
          }}
        />
        <div
          ref={containerRef}
          style={{
            transformStyle: 'preserve-3d',
            willChange: 'transform, opacity',
            borderRadius: 'var(--radius)',
            opacity: isActive ? 1 : 0.3,
            transform: isActive ? 'scale(1)' : 'scale(0.95)',
          }}
        >
          <GlassPanel cursor={cursor} depth={0.5}>
            <div style={{ padding: insight.isPrimary ? '36px 44px' : '28px 36px' }}>
              <p style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: 'var(--text-tertiary)',
                margin: '0 0 14px',
              }}>
                {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 20,
                marginBottom: 28,
              }}>
                <div>
                  <h2 style={{
                    fontSize: insight.isPrimary ? 26 : 20,
                    fontWeight: 700,
                    color: 'var(--text)',
                    margin: 0,
                  }}>
                    {insight.title}
                  </h2>
                  {insight.subtitle && (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
                      {insight.subtitle}
                    </p>
                  )}
                </div>

                {insight.metric && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      fontSize: insight.isPrimary ? 42 : 32,
                      fontWeight: 700,
                      color: 'var(--primary)',
                      margin: 0,
                      lineHeight: 1,
                    }}>
                      {insight.metric}
                    </p>
                    {insight.metricLabel && (
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
                        {insight.metricLabel}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div 
                ref={chartRef} 
                style={{ 
                  height: insight.isPrimary ? 320 : 260,
                  opacity: chartReady ? 1 : 0,
                  transition: 'opacity 0.5s ease',
                }} 
              />
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID CARD
// ═══════════════════════════════════════════════════════════════════════════

function GridCard({ insight, cursor, index }: {
  insight: InsightData;
  cursor: CursorState;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const hasAnimated = useRef(false);

  // Aurora reveal animation with ScrollTrigger
  useEffect(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;

    const color = AURORA_COLORS[index % AURORA_COLORS.length];

    // Initial state
    gsap.set(card, { opacity: 0, y: 60, scale: 0.92, rotateX: 10 });
    gsap.set(glow, { opacity: 0, scale: 0.7 });

    const trigger = ScrollTrigger.create({
      trigger: card,
      start: 'top 88%',
      end: 'top 20%',
      onEnter: () => {
        if (hasAnimated.current) return;
        hasAnimated.current = true;

        const delay = index * 0.1;

        // Aurora glow burst
        gsap.timeline()
          .to(glow, {
            opacity: 0.7,
            scale: 1.2,
            duration: 0.5,
            delay,
            ease: 'power2.out',
          })
          .to(glow, {
            opacity: 0,
            scale: 1,
            duration: 0.7,
            ease: 'power2.inOut',
          });

        // Card reveal with 3D effect
        gsap.to(card, {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.8,
          delay,
          ease: 'power3.out',
        });

        // Border shimmer
        gsap.fromTo(card,
          { boxShadow: `0 0 0px 0px ${color}00` },
          {
            boxShadow: `0 0 35px 10px ${color}55`,
            duration: 0.5,
            delay: delay + 0.25,
            ease: 'power2.out',
            yoyo: true,
            repeat: 1,
            onComplete: () => gsap.set(card, { clearProps: 'boxShadow' }),
          }
        );
      },
      onEnterBack: () => {
        if (!hasAnimated.current) {
          hasAnimated.current = true;
          gsap.to(card, {
            opacity: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            duration: 0.5,
            ease: 'power2.out',
          });
        }
      },
      onLeaveBack: () => {
        hasAnimated.current = false;
        gsap.to(card, {
          opacity: 0,
          y: 60,
          scale: 0.92,
          rotateX: 10,
          duration: 0.4,
          ease: 'power2.in',
        });
      },
    });

    return () => trigger.kill();
  }, [index]);

  // Chart initialization — mount immediately
  useEffect(() => {
    if (!chartRef.current) return;
    const instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    chartInstance.current = instance;
    instance.setOption({
      ...insight.chartOptions,
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 800,
    } as echarts.EChartsOption);
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(chartRef.current);
    return () => {
      ro.disconnect();
      instance.dispose();
      chartInstance.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowColor = AURORA_COLORS[index % AURORA_COLORS.length];

  return (
    <div
      style={{
        position: 'relative',
        perspective: '1200px',
        gridColumn: insight.isPrimary ? '1 / -1' : undefined,
      }}
    >
      {/* Aurora glow layer */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: -25,
          background: `radial-gradient(ellipse at 50% 30%, ${glowColor}44 0%, transparent 65%)`,
          borderRadius: 'var(--radius)',
          pointerEvents: 'none',
          zIndex: -1,
          filter: 'blur(20px)',
        }}
      />
      <div
        ref={cardRef}
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform, opacity',
          borderRadius: 'var(--radius)',
        }}
      >
        <GlassPanel cursor={cursor} depth={0.4} style={{ height: '100%' }}>
          <div style={{ padding: '22px 26px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 14,
              marginBottom: 18,
            }}>
              <div>
                <p style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  margin: 0,
                }}>
                  {insight.title}
                </p>
                {insight.subtitle && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
                    {insight.subtitle}
                  </p>
                )}
              </div>
              {insight.metric && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text)',
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {insight.metric}
                  </p>
                  {insight.metricLabel && (
                    <p style={{ fontSize: 9, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
                      {insight.metricLabel}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div ref={chartRef} style={{ height: insight.isPrimary ? 260 : 190 }} />
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
