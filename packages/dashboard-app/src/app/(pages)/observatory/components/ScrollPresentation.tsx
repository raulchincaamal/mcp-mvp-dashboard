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
            <HeaderSlide 
              query={query} 
              insightCount={insights.length} 
              isActive={currentSlide === 0} 
            />
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
            <EndSlide 
              cursor={cursor} 
              onReset={onReset} 
              isActive={currentSlide === totalSlides - 1} 
            />
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

// ═══════════════════════════════════════════════════════════════════════════
// HEADER SLIDE - Animated intro
// ═══════════════════════════════════════════════════════════════════════════

function HeaderSlide({ query, insightCount, isActive }: { 
  query: string | null; 
  insightCount: number; 
  isActive: boolean;
}) {
  const labelRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;

    const tl = gsap.timeline();
    
    tl.fromTo(labelRef.current,
      { opacity: 0, y: 20, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }
    );
    tl.fromTo(titleRef.current,
      { opacity: 0, y: 40, rotateX: 15 },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.3'
    );
    tl.fromTo(countRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' },
      '-=0.4'
    );
  }, [isActive]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 40,
      perspective: '1000px',
    }}>
      <p ref={labelRef} style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--primary)',
        margin: '0 0 12px',
        opacity: 0,
      }}>
        Executive Intelligence
      </p>
      <h1 ref={titleRef} style={{
        fontSize: 38,
        fontWeight: 700,
        color: 'var(--text)',
        margin: 0,
        textAlign: 'center',
        letterSpacing: '-0.02em',
        maxWidth: 650,
        opacity: 0,
        transformStyle: 'preserve-3d',
      }}>
        {query}
      </h1>
      <p ref={countRef} style={{
        fontSize: 15,
        color: 'var(--text-tertiary)',
        margin: '14px 0 0',
        opacity: 0,
      }}>
        {insightCount} insights generated
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// END SLIDE - Animated outro
// ═══════════════════════════════════════════════════════════════════════════

function EndSlide({ cursor, onReset, isActive }: { 
  cursor: CursorState; 
  onReset: () => void; 
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isActive || hasAnimated.current || !containerRef.current) return;
    hasAnimated.current = true;

    const children = containerRef.current.children;
    gsap.fromTo(children,
      { opacity: 0, y: 30, scale: 0.95 },
      { 
        opacity: 1, 
        y: 0, 
        scale: 1, 
        duration: 0.6, 
        stagger: 0.12, 
        ease: 'back.out(1.3)',
      }
    );
  }, [isActive]);

  return (
    <div 
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 40,
        gap: 20,
      }}
    >
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        opacity: 0,
      }}>
        Analysis Complete
      </p>
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--text)',
        margin: 0,
        opacity: 0,
      }}>
        Ready for your next question
      </h2>
      <div style={{ opacity: 0 }}>
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
    </div>
  );
}

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

// Animation patterns for variety
const SLIDE_ANIMATIONS = [
  { x: 0, y: 60, rotateX: 12, rotateY: 0 },      // bottom
  { x: -80, y: 20, rotateX: 0, rotateY: -8 },   // left
  { x: 80, y: 20, rotateX: 0, rotateY: 8 },     // right
  { x: 0, y: -50, rotateX: -10, rotateY: 0 },   // top
  { x: -60, y: 40, rotateX: 6, rotateY: -6 },   // diagonal-left
  { x: 60, y: 40, rotateX: 6, rotateY: 6 },     // diagonal-right
];

function InsightSlide({ insight, cursor, index, total, isActive }: {
  insight: InsightData;
  cursor: CursorState;
  index: number;
  total: number;
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const prevActive = useRef(false);

  // Dynamic animation based on index
  const anim = SLIDE_ANIMATIONS[index % SLIDE_ANIMATIONS.length];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isActive && !prevActive.current) {
      // Entering with varied animation
      gsap.fromTo(container,
        { 
          opacity: 0, 
          scale: 0.92, 
          x: anim.x, 
          y: anim.y, 
          rotateX: anim.rotateX, 
          rotateY: anim.rotateY,
        },
        { 
          opacity: 1, 
          scale: 1, 
          x: 0, 
          y: 0, 
          rotateX: 0, 
          rotateY: 0, 
          duration: 0.8, 
          ease: 'power3.out',
        }
      );
    } else if (!isActive && prevActive.current) {
      // Leaving
      gsap.to(container, {
        opacity: 0.2,
        scale: 0.94,
        duration: 0.4,
        ease: 'power2.in',
      });
    }

    prevActive.current = isActive;
  }, [isActive, anim]);

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
        <div
          ref={containerRef}
          style={{
            transformStyle: 'preserve-3d',
            willChange: 'transform, opacity',
            borderRadius: 'var(--radius)',
            opacity: isActive ? 1 : 0.2,
          }}
        >
          <GlassPanel cursor={cursor} depth={0.4} glowOnHover={false}>
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

// Grid animation patterns - more dynamic variety
const GRID_ANIMATIONS = [
  { x: 0, y: 80, rotate: 0, scale: 0.85 },        // bottom pop
  { x: -100, y: 30, rotate: -3, scale: 0.9 },    // slide left
  { x: 100, y: 30, rotate: 3, scale: 0.9 },      // slide right
  { x: 0, y: 0, rotate: 0, scale: 0.6 },         // zoom in
  { x: -60, y: 60, rotate: -2, scale: 0.88 },    // diagonal left
  { x: 60, y: 60, rotate: 2, scale: 0.88 },      // diagonal right
  { x: 0, y: -60, rotate: 0, scale: 0.9 },       // drop down
  { x: 0, y: 40, rotate: 0, scale: 1.1 },        // shrink in
];

const EASINGS = [
  'power3.out',
  'back.out(1.4)',
  'elastic.out(1, 0.5)',
  'power4.out',
];

function GridCard({ insight, cursor, index }: {
  insight: InsightData;
  cursor: CursorState;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const hasAnimated = useRef(false);

  // Pick animation based on index for variety
  const anim = GRID_ANIMATIONS[index % GRID_ANIMATIONS.length];
  const easing = EASINGS[index % EASINGS.length];

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Initial state with varied starting position
    gsap.set(card, { 
      opacity: 0, 
      x: anim.x, 
      y: anim.y, 
      scale: anim.scale, 
      rotate: anim.rotate,
    });

    const trigger = ScrollTrigger.create({
      trigger: card,
      start: 'top 90%',
      end: 'top 30%',
      onEnter: () => {
        if (hasAnimated.current) return;
        hasAnimated.current = true;

        // Staggered delay based on position
        const row = Math.floor(index / 2);
        const col = index % 2;
        const delay = row * 0.12 + col * 0.06;

        gsap.to(card, {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
          duration: 0.7 + Math.random() * 0.2,
          delay,
          ease: easing,
        });
      },
      onEnterBack: () => {
        if (!hasAnimated.current) {
          hasAnimated.current = true;
          gsap.to(card, {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            duration: 0.5,
            ease: 'power2.out',
          });
        }
      },
      onLeaveBack: () => {
        hasAnimated.current = false;
        gsap.to(card, {
          opacity: 0,
          x: anim.x * 0.5,
          y: anim.y * 0.5,
          scale: anim.scale,
          rotate: anim.rotate * 0.5,
          duration: 0.35,
          ease: 'power2.in',
        });
      },
    });

    return () => trigger.kill();
  }, [index, anim, easing]);

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

  return (
    <div
      style={{
        position: 'relative',
        perspective: '1200px',
        gridColumn: insight.isPrimary ? '1 / -1' : undefined,
      }}
    >
      <div
        ref={cardRef}
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform, opacity',
          borderRadius: 'var(--radius)',
        }}
      >
        <GlassPanel cursor={cursor} depth={0.3} glowOnHover={false} style={{ height: '100%' }}>
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
