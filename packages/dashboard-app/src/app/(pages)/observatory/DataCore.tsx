'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ObservatoryState } from './state-machine';

interface DataCoreProps {
  state: ObservatoryState;
  className?: string;
}

const STATE_CONFIG: Record<ObservatoryState, { speed: number; spread: number; opacity: number; color: string }> = {
  IDLE:                      { speed: 0.18, spread: 1.0, opacity: 0.55, color: '#49a4d8' },
  QUERY_RECEIVED:            { speed: 0.55, spread: 1.2, opacity: 0.75, color: '#6ec6f0' },
  ANALYZING:                 { speed: 0.9,  spread: 1.4, opacity: 0.85, color: '#7dd4fc' },
  FETCHING_DATA:             { speed: 1.2,  spread: 1.6, opacity: 0.9,  color: '#38bdf8' },
  GENERATING_VISUALIZATIONS: { speed: 1.5,  spread: 1.8, opacity: 1.0,  color: '#0ea5e9' },
  REVEAL:                    { speed: 2.0,  spread: 2.2, opacity: 1.0,  color: '#e0f2fe' },
  PRESENTATION:              { speed: 0.25, spread: 0.8, opacity: 0.35, color: '#49a4d8' },
};

const PARTICLE_COUNT = 280;

export default function DataCore({ state, className = '' }: DataCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 3.5;

    // Particles
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities: THREE.Vector3[] = [];
    const origins: THREE.Vector3[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.6 + Math.random() * 1.2;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      origins.push(new THREE.Vector3(x, y, z));
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.002,
        (Math.random() - 0.5) * 0.002,
        (Math.random() - 0.5) * 0.002,
      ));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.028,
      color: new THREE.Color('#49a4d8'),
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Core glow sphere
    const coreGeo = new THREE.SphereGeometry(0.22, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#49a4d8'),
      transparent: true,
      opacity: 0.08,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Ring
    const ringGeo = new THREE.TorusGeometry(0.55, 0.004, 8, 120);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#49a4d8'), transparent: true, opacity: 0.25 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.003, 8, 120),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#49a4d8'), transparent: true, opacity: 0.12 }),
    );
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 6;
    scene.add(ring2);

    // Resize
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Animation loop
    let frame = 0;
    let animId: number;
    const pos = geometry.attributes.position as THREE.BufferAttribute;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      frame++;

      const cfg = STATE_CONFIG[stateRef.current];
      const targetColor = new THREE.Color(cfg.color);

      // Lerp color and opacity
      material.color.lerp(targetColor, 0.03);
      material.opacity += (cfg.opacity - material.opacity) * 0.04;
      coreMat.color.lerp(targetColor, 0.03);
      ringMat.color.lerp(targetColor, 0.03);

      // Rotate rings
      ring.rotation.z += 0.003 * cfg.speed;
      ring2.rotation.z -= 0.002 * cfg.speed;

      // Breathe core
      const breathe = 1 + Math.sin(frame * 0.018) * 0.06;
      core.scale.setScalar(breathe);

      // Move particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ox = origins[i].x;
        const oy = origins[i].y;
        const oz = origins[i].z;

        velocities[i].x += (Math.random() - 0.5) * 0.0004 * cfg.speed;
        velocities[i].y += (Math.random() - 0.5) * 0.0004 * cfg.speed;
        velocities[i].z += (Math.random() - 0.5) * 0.0004 * cfg.speed;
        velocities[i].multiplyScalar(0.97);

        let nx = pos.getX(i) + velocities[i].x;
        let ny = pos.getY(i) + velocities[i].y;
        let nz = pos.getZ(i) + velocities[i].z;

        // Spring back to origin scaled by spread
        nx += (ox * cfg.spread - nx) * 0.008;
        ny += (oy * cfg.spread - ny) * 0.008;
        nz += (oz * cfg.spread - nz) * 0.008;

        pos.setXYZ(i, nx, ny, nz);
      }
      pos.needsUpdate = true;

      // Slow global rotation
      particles.rotation.y += 0.0008 * cfg.speed;
      particles.rotation.x += 0.0003 * cfg.speed;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
