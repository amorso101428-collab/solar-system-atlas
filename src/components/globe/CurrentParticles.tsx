import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sampleUV, isWater, type CurrentField } from "../../lib/currentField";

const DEG = Math.PI / 180;

function speedColor(t: number, out: THREE.Color) {
  if (t < 0.5) out.setRGB(0.05 + t * 0.40, 0.34 + t * 0.80, 0.44 + t * 0.68);
  else { const k = (t - 0.5) * 2; out.setRGB(0.25 + k * 0.60, 0.74 - k * 0.12, 0.78 - k * 0.38); }
  return out;
}

/**
 * Surface drifters rendered as velocity-aligned streaks: the streak head is
 * advected through the field, the tail is placed upstream by a length that
 * scales with speed, so the field reads as flow rather than as dots.
 */
export default function CurrentParticles({ field, radius, count, show, rate = 1 }: {
  field: CurrentField; radius: number; count: number; show: boolean; rate?: number;
}) {
  const ref = useRef<THREE.LineSegments>(null);
  const col = useMemo(() => new THREE.Color(), []);

  const st = useMemo(() => {
    const lon = new Float32Array(count), lat = new Float32Array(count);
    const uu = new Float32Array(count), vv = new Float32Array(count);
    const spd = new Float32Array(count);
    // rejection-sample toward fast water so drifters cluster in the jets
    const seed = (): [number, number] => {
      let lo = 0, la = 0;
      for (let t = 0; t < 60; t++) {
        lo = Math.random() * 360 - 180; la = (Math.random() * 2 - 1) * 82;
        if (!isWater(field, lo, la)) continue;
        const [u, v] = sampleUV(field, lo, la);
        if (Math.random() < Math.max(0.05, Math.hypot(u, v))) return [lo, la];
      }
      return [lo, la];
    };
    for (let i = 0; i < count; i++) {
      const [lo, la] = seed();
      lon[i] = lo; lat[i] = la; spd[i] = 0.25;
    }
    return {
      lon, lat, uu, vv, spd,
      positions: new Float32Array(count * 6),
      colors: new Float32Array(count * 6),
    };
  }, [count, field]);

  useFrame((_, dtRaw) => {
    if (!show || !ref.current) return;
    const dt = Math.min(dtRaw, 0.05);
    const { lon, lat, uu, vv, spd, positions, colors } = st;
    const step = dt * rate;
    const ADVECT = 1.7;   // deg per (m/s) per second of screen time

    for (let i = 0; i < count; i++) {
      const lo = lon[i], la = lat[i];
      const [u, v] = sampleUV(field, lo, la);
      uu[i] = u; vv[i] = v;
      const s = Math.hypot(u, v);
      spd[i] = Math.min(1, s);
      const cosLat = Math.max(0.18, Math.cos(la * DEG));
      let nlo = lo + (u * ADVECT * step) / cosLat;
      let nla = la + (v * ADVECT * step);
      if (nlo > 180) nlo -= 360; else if (nlo < -180) nlo += 360;
      if (nla > 84 || nla < -84 || !isWater(field, nlo, nla)) {
        let rlo = 0, rla = 0, tr = 0;
        for (; tr < 60; tr++) {
          rlo = Math.random() * 360 - 180; rla = (Math.random() * 2 - 1) * 82;
          if (!isWater(field, rlo, rla)) continue;
          const [su, sv] = sampleUV(field, rlo, rla);
          if (Math.random() < Math.max(0.05, Math.hypot(su, sv))) break;
        }
        lon[i] = rlo; lat[i] = rla; uu[i] = 0; vv[i] = 0; spd[i] = 0.2;
        continue;
      }
      lon[i] = nlo; lat[i] = nla;
    }

    for (let i = 0; i < count; i++) {
      const pa = i * 6;
      const la = lat[i], lo = lon[i];
      const u = uu[i], v = vv[i];
      const s = Math.hypot(u, v) || 1e-6;
      const len = .3 + 1.8 * spd[i];
      const cosLat = Math.max(0.18, Math.cos(la * DEG));
      let tlo = lo - (u / s) * (len / cosLat);
      let tla = la - (v / s) * len;
      if (tlo > 180) tlo -= 360; else if (tlo < -180) tlo += 360;
      const rh = radius * 1.00022, rt = radius * 1.00022;
      const valid=isWater(field,lo,la)&&isWater(field,tlo,tla);
      const laT = tla * DEG, loT = (tlo+180) * DEG;
      const laH = la * DEG, loH = (lo+180) * DEG;
      positions[pa]     = -rt * Math.cos(loT) * Math.cos(laT);
      positions[pa + 1] =  rt * Math.sin(laT);
      positions[pa + 2] =  rt * Math.sin(loT) * Math.cos(laT);
      positions[pa + 3] = -rh * Math.cos(loH) * Math.cos(laH);
      positions[pa + 4] =  rh * Math.sin(laH);
      positions[pa + 5] =  rh * Math.sin(loH) * Math.cos(laH);
      speedColor(spd[i], col);if(!valid)col.setRGB(0,0,0);
      const dim = 0.06 + 0.94 * Math.pow(spd[i], 1.4);
      colors[pa] = col.r * dim; colors[pa + 1] = col.g * dim; colors[pa + 2] = col.b * dim;
      colors[pa + 3] = col.r; colors[pa + 4] = col.g; colors[pa + 5] = col.b;
    }
    const g = ref.current.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <lineSegments ref={ref} frustumCulled={false} visible={show}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[st.colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.60} depthWrite={false}
        blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}
