import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export default function MarineSnow({ count = 900, radius = 1, depth = 3.2 }: { count?: number; radius?: number; depth?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = radius * (1.25 + Math.random() * depth);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      positions[i*3] = r * Math.sin(ph) * Math.cos(th);
      positions[i*3+1] = r * Math.cos(ph) * 0.7;
      positions[i*3+2] = r * Math.sin(ph) * Math.sin(th);
      speeds[i] = 0.006 + Math.random() * 0.02;
    }
    return { positions, speeds };
  }, [count, radius, depth]);

  useFrame((_, dt) => {
    const p = ref.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!p) return;
    const a = p.array as Float32Array;
    for (let i = 0; i < count; i++) {
      a[i*3+1] += speeds[i] * dt * 0.35;
      a[i*3] += Math.sin(performance.now() * 0.00013 + i) * dt * 0.004;
      if (a[i*3+1] > radius * (1.25 + depth)) a[i*3+1] = radius * 1.2;
    }
    p.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.012} color="#9fd8e6" transparent opacity={0.42}
        depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}
