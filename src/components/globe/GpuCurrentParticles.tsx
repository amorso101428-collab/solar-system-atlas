import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { CurrentField } from "../../lib/currentField";

/**
 * Fully GPU current-field particles.
 *
 *  pass 1  simulate — a fullscreen shader advects N particles through the
 *          velocity texture and ping-pongs the result through two RGBA8
 *          render targets (lon/lat packed as 16-bit each, so no float-texture
 *          extensions are required).
 *  pass 2  draw — one LineSegments draw call, 2N vertices. The vertex shader
 *          reads the state texture by gl_VertexID-equivalent index and emits a
 *          velocity-aligned streak per particle.
 *
 * No per-frame JavaScript touches particle positions.
 */

const SIM_VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SIM_FRAG = `
precision highp float;
uniform sampler2D stateTex;
uniform sampler2D fieldTex;
uniform float dt;
uniform float seed;
uniform float initMode;
uniform float advect;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
const float P = 65025.0;   // 255*255

void main(){
  float lon, lat;
  if (initMode > 0.5) {
    lon = hash(vUv * 127.1 + seed) * 360.0 - 180.0;
    lat = (hash(vUv * 311.7 + seed * 1.7) - 0.5) * 164.0;
  } else {
    vec4 s = texture2D(stateTex, vUv);
    lon = (s.r * 255.0 * 255.0 + s.g * 255.0) / P * 360.0 - 180.0;
    lat = (s.b * 255.0 * 255.0 + s.a * 255.0) / P * 180.0 - 90.0;

    vec4 cf = texture2D(fieldTex, vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0));
    vec2 vel = (cf.rg * 2.0 - 1.0) * 2.0;
    float cosLat = max(0.18, cos(radians(lat)));
    lon += vel.x * advect * dt / cosLat;
    lat += vel.y * advect * dt;

    // land / out-of-range -> respawn somewhere random; it settles in a frame or two
    float bad = step(cf.a, 0.5) + step(84.0, abs(lat));
    if (bad > 0.5) {
      lon = hash(vUv * 127.1 + seed) * 360.0 - 180.0;
      lat = (hash(vUv * 311.7 + seed * 1.7) - 0.5) * 164.0;
    }
  }
  if (lon > 180.0) lon -= 360.0;
  if (lon < -180.0) lon += 360.0;
  lat = clamp(lat, -89.0, 89.0);

  float u = (lon + 180.0) / 360.0;
  float v = (lat + 90.0) / 180.0;
  float uhi = floor(u * 255.0), ulo = floor(fract(u * 255.0) * 255.0);
  float vhi = floor(v * 255.0), vlo = floor(fract(v * 255.0) * 255.0);
  gl_FragColor = vec4(uhi / 255.0, ulo / 255.0, vhi / 255.0, vlo / 255.0);
}`;

const DRAW_VERT = `
precision highp float;
attribute float aRef;
attribute float aEnd;
uniform sampler2D stateTex;
uniform sampler2D fieldTex;
uniform float texSize;
uniform float radius;
varying vec3 vColor;varying float vValid;
const float P = 65025.0;

vec3 llToVec3(float lon, float lat, float r){
  float u = (lon + 180.0) / 360.0;
  float phi = u * 6.28318530718;
  float theta = (90.0 - lat) * 0.01745329252;
  float st = sin(theta);
  return vec3(-r * cos(phi) * st, r * cos(theta), r * sin(phi) * st);
}

void main(){
  vec2 uv = (vec2(mod(aRef, texSize), floor(aRef / texSize)) + 0.5) / texSize;
  vec4 s = texture2D(stateTex, uv);
  float lon = (s.r * 255.0 * 255.0 + s.g * 255.0) / P * 360.0 - 180.0;
  float lat = (s.b * 255.0 * 255.0 + s.a * 255.0) / P * 180.0 - 90.0;

  vec4 cf = texture2D(fieldTex, vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0));
  vec2 vel = (cf.rg * 2.0 - 1.0) * 2.0;
  float sp = min(length(vel), 1.0);
  vec2 dir = vel / max(length(vel), 1e-5);
  float len = .3 + 1.8 * sp;
  float cosLat = max(0.18, cos(radians(lat)));
  vec2 tail = vec2(lon - dir.x * len / cosLat, lat - dir.y * len);
  vec2 ll = mix(tail, vec2(lon, lat), aEnd);
  float tailWater=texture2D(fieldTex,vec2(fract((tail.x+180.)/360.),(tail.y+90.)/180.)).a;
  vValid=step(.99,cf.a)*step(.99,tailWater);

  vec3 p = llToVec3(ll.x, ll.y, radius * 1.00022);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

  vec3 cLow = vec3(0.05, 0.34, 0.44);
  vec3 cMid = vec3(0.25, 0.78, 0.86);
  vec3 cHi  = vec3(0.85, 0.58, 0.34);
  vec3 c = sp < 0.5 ? mix(cLow, cMid, sp * 2.0) : mix(cMid, cHi, (sp - 0.5) * 2.0);
  // stronger low-speed falloff: only real currents should read as bright
  float dim = mix(0.02 + 0.98 * pow(sp, 2.1), 1.0, aEnd);
  vColor = c * dim;
}`;

const DRAW_FRAG = `precision highp float; varying vec3 vColor;varying float vValid; uniform float opacity;
void main(){ if(vValid<.5)discard;gl_FragColor = vec4(vColor,opacity); }`;

export default function GpuCurrentParticles({ field, radius, size, show, rate = 1 }: {
  field: CurrentField; radius: number; size: number; show: boolean; rate?: number;
}) {
  const { gl } = useThree();
  const n = size * size;

  const fieldTex = useMemo(() => {
    const data = new Uint8Array(field.width * field.height * 4);
    for (let k = 0; k < field.width * field.height; k++) {
      const p = k * 4;
      data[p] = Math.max(0, Math.min(255, (field.u[k] / 2 + 0.5) * 255));
      data[p + 1] = Math.max(0, Math.min(255, (field.v[k] / 2 + 0.5) * 255));
      data[p + 2] = Math.max(0, Math.min(255, (field.speed[k] / 1.5) * 255));
      data[p + 3] = field.ocean[k] ? 255 : 0;
    }
    const t = new THREE.DataTexture(data, field.width, field.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [field]);

  const targets = useMemo(() => {
    const opts: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    return [new THREE.WebGLRenderTarget(size, size, opts), new THREE.WebGLRenderTarget(size, size, opts)];
  }, [size]);

  useEffect(() => () => { targets.forEach((t) => t.dispose()); fieldTex.dispose(); }, [targets, fieldTex]);

  const sim = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        stateTex: { value: targets[0].texture },
        fieldTex: { value: fieldTex },
        dt: { value: 0 },
        seed: { value: 1.37 },
        initMode: { value: 1 },
        advect: { value: 1.7 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }, [targets, fieldTex]);

  const simScene = useMemo(() => {
    const s = new THREE.Scene();
    s.add(sim);
    return s;
  }, [sim]);
  const simCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  useEffect(() => () => { simScene.remove(sim); sim.geometry.dispose(); (sim.material as THREE.Material).dispose(); }, [simScene, sim]);

  const drawGeo = useMemo(() => {
    const ref = new Float32Array(n * 2);
    const end = new Float32Array(n * 2);
    const pos = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      ref[i * 2] = i; ref[i * 2 + 1] = i;
      end[i * 2] = 0; end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRef", new THREE.BufferAttribute(ref, 1));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    return g;
  }, [n]);

  const drawMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: DRAW_VERT,
    fragmentShader: DRAW_FRAG,
    uniforms: {
      stateTex: { value: targets[0].texture },
      fieldTex: { value: fieldTex },
      texSize: { value: size },
      radius: { value: radius },
      opacity: { value: 0.65 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [targets, fieldTex, size, radius]);

  useEffect(() => () => { drawGeo.dispose(); drawMat.dispose(); }, [drawGeo, drawMat]);

  const state = useRef({ read: 0, write: 1, initialized: false });
  const linesRef = useRef<THREE.LineSegments>(null);

  useFrame((_, dtRaw) => {
    const st = state.current;
    const u = (sim.material as THREE.ShaderMaterial).uniforms;
    u.stateTex.value = targets[st.read].texture;
    u.dt.value = Math.min(dtRaw, 0.05) * rate;
    u.initMode.value = st.initialized ? 0 : 1;
    u.seed.value += 0.017;

    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(targets[st.write]);
    gl.render(simScene, simCam);
    gl.setRenderTarget(prevTarget);

    const t = st.read; st.read = st.write; st.write = t;
    st.initialized = true;
    drawMat.uniforms.stateTex.value = targets[st.read].texture;
  });

  return (
    <lineSegments ref={linesRef} geometry={drawGeo} material={drawMat} frustumCulled={false} visible={show} />
  );
}
