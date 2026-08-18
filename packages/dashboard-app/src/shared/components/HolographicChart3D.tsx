'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface HoloBarData {
  label: string;
  value: number;
}

export interface HolographicChart3DProps {
  data: HoloBarData[];
  title?: string;
  height?: number;
  gradient?: 'aurora' | 'neon' | 'fire' | 'ocean';
}

// ─── Palettes ──────────────────────────────────────────────

const PALETTES: Record<string, [string, string][]> = {
  aurora: [
    ['#c084fc', '#818cf8'],
    ['#67e8f9', '#60a5fa'],
    ['#f9a8d4', '#c084fc'],
    ['#6ee7b7', '#34d399'],
    ['#fcd34d', '#fb923c'],
    ['#fca5a5', '#f472b6'],
  ],
  neon: [
    ['#00ffff', '#0066ff'],
    ['#ff00ff', '#6600ff'],
    ['#00ff99', '#00aaff'],
    ['#ffff00', '#ff6600'],
    ['#ff0066', '#cc00ff'],
    ['#66ff00', '#00ffaa'],
  ],
  fire: [
    ['#fde68a', '#f97316'],
    ['#fbbf24', '#ef4444'],
    ['#fef08a', '#fbbf24'],
    ['#fca5a5', '#dc2626'],
    ['#fed7aa', '#f97316'],
    ['#fef9c3', '#fbbf24'],
  ],
  ocean: [
    ['#a5f3fc', '#38bdf8'],
    ['#7dd3fc', '#0ea5e9'],
    ['#bae6fd', '#06b6d4'],
    ['#e0f2fe', '#38bdf8'],
    ['#67e8f9', '#0284c7'],
    ['#cffafe', '#0e7490'],
  ],
};

// ─── Shaders ───────────────────────────────────────────────

const VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAG = `
  uniform vec3 uTop;
  uniform vec3 uBot;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float t = smoothstep(0.0, 1.0, vUv.y);
    vec3 col = mix(uBot, uTop, t);
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 4.0) * 0.4;
    col += uTop * fresnel;
    float alpha = mix(0.25, 0.7, t);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Camera: fixed + mouse tilt ────────────────────────────

const BASE_CAM = new THREE.Vector3(0, 4.5, 9);
const CAM_TARGET = new THREE.Vector3(0, 1.2, 0);

function CameraRig({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const tx = BASE_CAM.x + mouseRef.current.x * 1.6;
    const ty = BASE_CAM.y + mouseRef.current.y * 0.5;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, tx, delta * 2.5);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, ty, delta * 2.5);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, BASE_CAM.z, delta * 2.5);
    camera.lookAt(CAM_TARGET);
  });

  return null;
}

// ─── Bar ───────────────────────────────────────────────────

const BAR_W = 0.44;

function HoloBar({
  x, targetH, colorTop, colorBottom, index,
}: {
  x: number;
  targetH: number;
  colorTop: string;
  colorBottom: string;
  index: number;
}) {
  const backRef  = useRef<THREE.Mesh>(null);
  const frontRef = useRef<THREE.Mesh>(null);
  const edgeRef  = useRef<THREE.LineSegments>(null);
  const curH     = useRef(0.001);

  // Stable material — created once
  const mat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(colorTop) },
      uBot: { value: new THREE.Color(colorBottom) },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  }));

  // EdgesGeometry in ref — only 12 edges, no face diagonals
  const edgesGeo = useRef(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BAR_W * 1.02, targetH, BAR_W * 1.02))
  );

  useEffect(() => () => {
    mat.current.dispose();
    edgesGeo.current.dispose();
  }, []);

  useFrame((_, delta) => {
    curH.current = THREE.MathUtils.lerp(
      curH.current,
      targetH,
      Math.min(delta * (3.5 - index * 0.15), 1),
    );
    const h = curH.current;
    const ratio = h / targetH;

    const meshes = [backRef.current, frontRef.current];
    meshes.forEach(m => {
      if (!m) return;
      m.scale.y = ratio;
      m.position.y = h / 2;
    });

    if (edgeRef.current) {
      edgeRef.current.scale.y = ratio;
      edgeRef.current.position.y = h / 2;
    }
  });

  return (
    <group position={[x, 0, 0]}>
      {/* 1. Back faces — inner glass tint */}
      <mesh ref={backRef} position={[0, targetH / 2, 0]}>
        <boxGeometry args={[BAR_W, targetH, BAR_W]} />
        <meshBasicMaterial
          color={colorTop}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Front faces — gradient glass */}
      <mesh ref={frontRef} position={[0, targetH / 2, 0]}>
        <boxGeometry args={[BAR_W, targetH, BAR_W]} />
        <primitive object={mat.current} attach="material" />
      </mesh>

      {/* 3. Clean edges — EdgesGeometry, no diagonals */}
      <lineSegments ref={edgeRef} position={[0, targetH / 2, 0]}>
        <primitive object={edgesGeo.current} attach="geometry" />
        <lineBasicMaterial color={colorTop} transparent opacity={0.5} />
      </lineSegments>

      {/* 4. Ground glow dot */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 32]} />
        <meshBasicMaterial color={colorBottom} transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Grid ───────────────────────────────────────────────────

function HoloGrid({ size }: { size: number }) {
  return (
    <group>
      <gridHelper args={[size, size * 2, '#1e1b4b', '#0f0a2e']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#06040f" transparent opacity={0.99} />
      </mesh>
    </group>
  );
}

// ─── Scene ──────────────────────────────────────────────────

function Scene({
  data, palette, mouseRef,
}: {
  data: HoloBarData[];
  palette: [string, string][];
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const spacing  = 1.25;
  const startX   = -((data.length - 1) * spacing) / 2;
  const gridSize = Math.max(data.length * spacing + 4, 10);

  return (
    <>
      <ambientLight intensity={0.05} />
      <directionalLight position={[2, 8, 4]} intensity={0.1} color="#a5b4fc" />
      <HoloGrid size={gridSize} />
      {data.map((item, i) => {
        const h = Math.max((item.value / maxValue) * 3.2, 0.08);
        const [top, bot] = palette[i % palette.length];
        return (
          <HoloBar
            key={i}
            x={startX + i * spacing}
            targetH={h}
            colorTop={top}
            colorBottom={bot}
            index={i}
          />
        );
      })}
      <CameraRig mouseRef={mouseRef} />
    </>
  );
}

// ─── Main ───────────────────────────────────────────────────

export default function HolographicChart3D({
  data,
  title,
  height = 420,
  gradient = 'aurora',
}: HolographicChart3DProps) {
  const palette      = (PALETTES[gradient] ?? PALETTES.aurora) as [string, string][];
  const mouseRef     = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = {
      x:  ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      y: -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    };
  }, []);

  const onMouseLeave = useCallback(() => {
    mouseRef.current = { x: 0, y: 0 };
  }, []);

  if (!data || data.length === 0) return null;

  return (
    <div style={{
      position: 'relative',
      background: 'radial-gradient(ellipse at 50% 0%, #0f0b2d 0%, #06040f 60%)',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(139,92,246,0.18)',
      boxShadow: '0 0 0 1px rgba(99,102,241,0.08), inset 0 0 60px rgba(0,0,0,0.6)',
    }}>
      {title && (
        <div style={{
          padding: '1rem 1.25rem 0',
          color: 'rgba(226,232,240,0.85)',
          fontSize: '0.85rem',
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}>
          {title}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ height, position: 'relative', cursor: 'default' }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <Canvas
          camera={{ position: [0, 4.5, 9], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
        >
          <Scene data={data} palette={palette} mouseRef={mouseRef} />
        </Canvas>

        <div style={{
          position: 'absolute', bottom: 8, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none', padding: '0 8px',
        }}>
          {data.map((d, i) => (
            <div key={i} style={{
              width: `${100 / data.length}%`,
              textAlign: 'center',
              fontSize: '0.6rem',
              color: 'rgba(167,139,250,0.5)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 2px',
              letterSpacing: '0.03em',
            }}>
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
