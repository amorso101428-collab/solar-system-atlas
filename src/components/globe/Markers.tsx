import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { lonLatToVec3 } from "../../lib/geo";
import { DIVE_SITES } from "../../data/divesites";
import { useAtlas } from "../../state/store";

/** Eastern-boundary upwelling zones — a required beat in GEOGRAPHY mode. */
export const UPWELLING = [
  { id: "peru", lon: -79, lat: -12, label: "PERU / HUMBOLDT" },
  { id: "benguela", lon: 13, lat: -26, label: "BENGUELA" },
  { id: "california", lon: -124, lat: 35, label: "CALIFORNIA" },
  { id: "canary", lon: -18, lat: 24, label: "CANARY" },
  { id: "somali", lon: 51, lat: 8, label: "SOMALI" },
  { id: "bengal", lon: 88, lat: 18, label: "BENGAL" },
];

function Pulse({ position, color, base, active, onClick, title }: {
  position: [number, number, number]; color: string; base: number;
  active: boolean; onClick?: () => void; title?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = useAtlas.getState().reducedMotion ? 0 : state.clock.elapsedTime;
    const k = base * (active ? 1 : 0.55);
    if (ref.current) ref.current.scale.setScalar(k * (1 + 0.18 * Math.sin(t * 2.4)));
    if (ring.current) {
      const p = (t * 0.55) % 1;
      ring.current.scale.setScalar(k * (1 + p * 3.4));
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * (active ? 0.5 : 0.22);
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref} onClick={onClick ? (e) => { if (e.delta > 4) return; e.stopPropagation(); onClick(); } : undefined} onPointerOver={(e) => { e.stopPropagation(); }}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.95 : 0.7} />
      </mesh>
      <mesh ref={ring} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.9, 1.1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function UpwellingMarkers({ radius }: { radius: number }) {
  const mode = useAtlas((s) => s.mode);
  const lessonId = useAtlas((s) => s.lessonId);
  const active = mode === "GEOGRAPHY" && (lessonId === "upwelling" || lessonId === "gyre");
  if (!active) return null;
  return (
    <group>
      {UPWELLING.map((u) => {
        const p = lonLatToVec3(u.lon, u.lat, radius * 1.012);
        return <Pulse key={u.id} position={p} color="#30a6b8" base={0.022} active title={u.label} />;
      })}
    </group>
  );
}

export function DiveMarkers({ radius }: { radius: number }) {
  const show = useAtlas((s) => s.layers.divesites);
  const mode = useAtlas((s) => s.mode);
  const select = useAtlas((s) => s.select);
  const selected = useAtlas((s) => s.selection);
  const setHover = useAtlas((s) => s.setHover);
  const on = show;
  const pos = useMemo(() => DIVE_SITES.map((s) => ({ s, p: lonLatToVec3(s.lon, s.lat, radius * 1.014) })), [radius]);
  if (!on) return null;
  return (
    <group>
      {pos.map(({ s, p }) => (
        <Pulse key={s.id} position={p} color="#c58a55" base={0.018}
          active={selected.kind === "dive" && selected.id === s.id}
          onClick={() => select({ kind: "dive", id: s.id })} title={s.name_en} />
      ))}
    </group>
  );
}
