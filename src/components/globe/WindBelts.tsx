import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAtlas } from "../../state/store";

const vert = `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`;

/** Planetary wind belts + monsoon reversal, drawn as drifting streaks. */
const frag = `
precision highp float;
uniform float time; uniform float strength; uniform float monsoon; uniform float reveal;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y); }

void main(){
  float lat = (vUv.y - 0.5) * 180.0;
  float lon = (vUv.x - 0.5) * 360.0;
  float a = abs(lat);
  float sgn = sign(lat);

  vec2 dir; vec3 tint; float belt;
  if (a < 30.0)      { dir = vec2(-1.0, -sgn*0.40); tint = vec3(0.80,0.56,0.33); belt = 0.0; }
  else if (a < 60.0) { dir = vec2( 1.0,  sgn*0.46); tint = vec3(0.20,0.66,0.73); belt = 1.0; }
  else               { dir = vec2(-1.0, -sgn*0.30); tint = vec3(0.46,0.63,0.79); belt = 2.0; }

  // progressive reveal for the "why gyres form" lesson
  float on = 1.0;
  if (reveal < 3.5) {
    on = belt < 0.5 ? step(0.5, reveal) : (belt < 1.5 ? step(1.5, reveal) : step(2.5, reveal));
  }

  // North Indian Ocean monsoon reversal
  float box = step(abs(lon - 72.0), 34.0) * step(abs(lat - 13.0), 16.0);
  float m = 0.0;
  if (monsoon > 0.5 && box > 0.5) {
    if (monsoon < 1.5)      { dir = vec2(0.72, 0.69); tint = vec3(0.88,0.68,0.38); m = 1.0; }
    else if (monsoon < 2.5) { dir = vec2(-0.72,-0.69); tint = vec3(0.34,0.74,0.82); m = 1.0; }
    else {
      float phase = mod(time * 0.32, 2.0);
      if (phase < 1.0) { dir = vec2(0.72, 0.69);  tint = vec3(0.88,0.68,0.38); }
      else             { dir = vec2(-0.72,-0.69); tint = vec3(0.34,0.74,0.82); }
      m = 1.0;
    }
  }

  vec2 pp = vec2(vUv.x * 2.0, vUv.y);
  vec2 d = normalize(dir);
  vec2 perp = vec2(-d.y, d.x);
  float along = dot(pp, d) * 52.0 - time * 0.62;
  float cross = dot(pp, perp);
  float band = smoothstep(0.55, 0.99, fract(along));
  float chev = smoothstep(0.42, 0.0, abs(fract(cross * 6.0) - 0.5));
  float streak = band * (0.42 + 0.58 * chev);
  float latFade = smoothstep(2.0, 11.0, a) * (1.0 - smoothstep(80.0, 89.0, a));
  float amp = streak * latFade * on * (0.42 + 0.85 * m);
  amp *= strength * (0.55 + 0.35 * noise(pp * 9.0 + time * 0.05));
  float alpha = amp * 0.95;
  gl_FragColor = vec4(tint * alpha * 2.0, alpha);
}`;

export default function WindBelts({ radius }: { radius: number }) {
  const monsoon = useAtlas((s) => s.monsoon);
  const mode = useAtlas((s) => s.mode);
  const show = useAtlas((s) => s.layers.windbelts);
  const lessonId = useAtlas((s) => s.lessonId);
  const lessonStep = useAtlas((s) => s.lessonStep);

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    strength: { value: 0 },
    monsoon: { value: 0 },
    reveal: { value: 4 },
  }), []);

  const mnum = monsoon === "SUMMER" ? 1 : monsoon === "WINTER" ? 2 : monsoon === "COMPARE" ? 3 : 0;

  useFrame((_, dt) => {
    uniforms.time.value += useAtlas.getState().reducedMotion ? 0 : dt;
    const want = show ? 1 : 0;
    uniforms.strength.value += (want - uniforms.strength.value) * Math.min(1, dt * 4);
    uniforms.monsoon.value = mode === "GEOGRAPHY" ? mnum : 0;
    uniforms.reveal.value = mode === "GEOGRAPHY" && lessonId === "gyre" ? lessonStep : 4;
  });

  return (
    <mesh scale={1.0006} raycast={()=>null}>
      <sphereGeometry args={[radius, 128, 96]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
