'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  RoundedBox, 
  Text, 
  OrbitControls,
  Environment,
  Float,
} from '@react-three/drei';
import { 
  EffectComposer, 
  Bloom, 
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';

// ─── Types ─────────────────────────────────────────────────

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface HolographicBarChartProps {
  data: BarData[];
  title?: string;
  height?: number;
  theme?: 'aurora' | 'neon' | 'cyber' | 'sunset';
  showWireframe?: boolean;
  animated?: boolean;
}

// ─── Color Themes ──────────────────────────────────────────

const THEMES = {
  aurora: [
    '#8B5CF6', // Violet
    '#6366F1', // Indigo
    '#3B82F6', // Blue
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
  ],
  neon: [
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FF0080', // Pink
    '#00FF80', // Green
    '#8000FF', // Purple
    '#FFFF00', // Yellow
  ],
  cyber: [
    '#00F5FF', // Cyan
    '#FF00A0', // Pink
    '#00FF88', // Green
    '#FFD700', // Gold
    '#FF4500', // Orange
    '#9400D3', // Violet
  ],
  sunset: [
    '#FF6B6B', // Coral
    '#FF8E53', // Orange
    '#FFC93C', // Yellow
    '#FF5E78', // Pink
    '#C44569', // Rose
    '#F8B500', // Gold
  ],
};

// ─── Emissive Bar Component ────────────────────────────────

interface EmissiveBarProps {
  position: [number, number, number];
  height: number;
  maxHeight: number;
  color: string;
  label: string;
  index: number;
  showWireframe: boolean;
  animated: boolean;
}

function EmissiveBar({ 
  position, 
  height, 
  maxHeight, 
  color, 
  label, 
  index,
  showWireframe,
  animated,
}: EmissiveBarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // Animate bar height on mount
  const targetHeight = height;
  const currentHeight = useRef(0);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Smooth height animation
    currentHeight.current = THREE.MathUtils.lerp(
      currentHeight.current, 
      targetHeight, 
      delta * 2
    );
    
    const h = currentHeight.current;
    meshRef.current.scale.y = h / maxHeight;
    meshRef.current.position.y = (h / 2);
    
    if (wireframeRef.current) {
      wireframeRef.current.scale.y = h / maxHeight;
      wireframeRef.current.position.y = (h / 2);
    }
    
    if (glowRef.current) {
      glowRef.current.scale.y = h / maxHeight;
      glowRef.current.position.y = (h / 2);
    }
    
    // Subtle floating animation
    if (animated && meshRef.current) {
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * 2 + index) * 0.002;
    }
  });

  const barWidth = 0.6;
  const barDepth = 0.6;

  return (
    <group position={position}>
      {/* Main emissive bar */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[barWidth, maxHeight, barDepth]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      
      {/* Inner glow layer */}
      <mesh ref={glowRef} position={[0, 0, 0]}>
        <boxGeometry args={[barWidth * 0.9, maxHeight, barDepth * 0.9]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Wireframe outline */}
      {showWireframe && (
        <mesh ref={wireframeRef} position={[0, 0, 0]}>
          <boxGeometry args={[barWidth + 0.02, maxHeight, barDepth + 0.02]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
      
      {/* Edge glow lines */}
      <lineSegments position={[0, height / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(barWidth, height, barDepth)]} />
        <lineBasicMaterial color={color} transparent opacity={0.8} linewidth={2} />
      </lineSegments>
      
      {/* Label */}
      <Text
        position={[0, -0.4, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        font="/fonts/inter-medium.woff"
      >
        {label}
      </Text>
      
      {/* Value label */}
      <Text
        position={[0, height + 0.2, 0]}
        fontSize={0.12}
        color={color}
        anchorX="center"
        anchorY="bottom"
      >
        {Math.round(height * 100)}
      </Text>
    </group>
  );
}

// ─── Grid Floor ────────────────────────────────────────────

function HolographicGrid() {
  return (
    <group position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <gridHelper 
        args={[10, 20, '#1a1a2e', '#16163a']} 
        rotation={[Math.PI / 2, 0, 0]}
      />
      {/* Glow plane under grid */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial 
          color="#0a0a1a" 
          transparent 
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

// ─── Main 3D Scene ─────────────────────────────────────────

interface SceneProps {
  data: BarData[];
  theme: keyof typeof THEMES;
  showWireframe: boolean;
  animated: boolean;
}

function Scene({ data, theme, showWireframe, animated }: SceneProps) {
  const colors = THEMES[theme];
  const maxValue = Math.max(...data.map(d => d.value));
  const normalizedData = data.map(d => ({
    ...d,
    normalizedValue: (d.value / maxValue) * 3, // Max height of 3 units
  }));
  
  const spacing = 1.2;
  const startX = -((data.length - 1) * spacing) / 2;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#ffffff" />
      <pointLight position={[-5, 3, -5]} intensity={0.3} color="#8B5CF6" />
      <pointLight position={[0, 5, 0]} intensity={0.4} color="#06B6D4" />
      
      {/* Grid */}
      <HolographicGrid />
      
      {/* Bars */}
      {normalizedData.map((item, index) => (
        <EmissiveBar
          key={item.label}
          position={[startX + index * spacing, 0, 0]}
          height={item.normalizedValue}
          maxHeight={3}
          color={item.color || colors[index % colors.length]}
          label={item.label}
          index={index}
          showWireframe={showWireframe}
          animated={animated}
        />
      ))}
      
      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={4}
        maxDistance={12}
        autoRotate={animated}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function HolographicBarChart({
  data,
  title,
  height = 400,
  theme = 'aurora',
  showWireframe = true,
  animated = true,
}: HolographicBarChartProps) {
  
  return (
    <div style={{
      background: 'linear-gradient(180deg, #0a0a1a 0%, #0f0f23 50%, #0a0a1a 100%)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      boxShadow: '0 0 40px rgba(139, 92, 246, 0.1), inset 0 0 60px rgba(0, 0, 0, 0.5)',
    }}>
      {title && (
        <div style={{
          padding: '1rem 1.5rem 0',
          color: '#ffffff',
          fontSize: '0.95rem',
          fontWeight: 600,
          textShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
        }}>
          {title}
        </div>
      )}
      <div style={{ height, width: '100%' }}>
        <Canvas
          camera={{ position: [0, 3, 6], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <color attach="background" args={['#0a0a1a']} />
          
          <Scene 
            data={data} 
            theme={theme} 
            showWireframe={showWireframe}
            animated={animated}
          />
          
          {/* Post-processing effects */}
          <EffectComposer>
            <Bloom
              intensity={1.5}
              luminanceThreshold={0.1}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <ChromaticAberration
              offset={[0.0005, 0.0005]}
              radialModulation
              modulationOffset={0.5}
            />
            <Vignette
              offset={0.3}
              darkness={0.6}
            />
          </EffectComposer>
        </Canvas>
      </div>
    </div>
  );
}

// ─── Demo Component ────────────────────────────────────────

export function HolographicDemo() {
  const sampleData: BarData[] = [
    { label: 'Motos', value: 120 },
    { label: 'Celulares', value: 200 },
    { label: 'Tablets', value: 80 },
    { label: 'Audio', value: 150 },
    { label: 'TV', value: 90 },
    { label: 'Consolas', value: 110 },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '2rem',
      padding: '2rem',
      background: '#050510',
      minHeight: '100vh',
    }}>
      <h2 style={{ 
        color: '#ffffff', 
        fontSize: '1.5rem', 
        fontWeight: 700,
        textShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
      }}>
        Holographic 3D Charts - Three.js + Bloom
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <HolographicBarChart 
          data={sampleData} 
          title="Aurora Theme" 
          theme="aurora"
          height={350}
        />
        <HolographicBarChart 
          data={sampleData} 
          title="Neon Theme" 
          theme="neon"
          height={350}
        />
        <HolographicBarChart 
          data={sampleData} 
          title="Cyber Theme" 
          theme="cyber"
          height={350}
        />
        <HolographicBarChart 
          data={sampleData} 
          title="Sunset Theme" 
          theme="sunset"
          height={350}
        />
      </div>
    </div>
  );
}
