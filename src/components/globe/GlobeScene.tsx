import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import Coastlines from "./Coastlines";
import ParticleStars from "./ParticleStars";
import {MIN_CAMERA_DISTANCE,MAX_CAMERA_DISTANCE,clampCameraDistance} from "../../lib/cameraLimits";
import Earth from "./Earth";
import SurfaceTiles from "./SurfaceTiles";
import WeatherLayer from "./WeatherLayer";
import {useWeather} from "../../lib/weather";
import { Atmosphere } from "./Atmosphere";
import { useLanguage } from "../../i18n";
import { Html } from "@react-three/drei";
import { OCEANS } from "../../data/oceans";
import CurrentParticles from "./CurrentParticles";
import GpuCurrentParticles from "./GpuCurrentParticles";
import { isWater, encodeFieldTexture, encodeWarmthTexture, type CurrentField } from "../../lib/currentField";
import WindBelts from "./WindBelts";
import { DiveMarkers, UpwellingMarkers } from "./Markers";
import { pickCurrent, pickOcean, sphereHitToLonLat } from "../../lib/pick";
import { lonLatToVec3 } from "../../lib/geo";
import { useAtlas } from "../../state/store";

export const RADIUS = 1;

function Graticule({ radius, on }: { radius: number; on: boolean }) {
  const uniforms = useMemo(() => ({ strength: { value: on ? 1 : 0 } }), []);
  useEffect(() => { uniforms.strength.value = on ? 1 : 0; }, [on, uniforms]);
  const vert = `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`;
  const frag = `precision highp float; uniform float strength; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main(){
    float dx = abs(fract(vUv.x*36.0 + 0.5) - 0.5);
    float dy = abs(fract(vUv.y*18.0 + 0.5) - 0.5);
    float w = 0.010;
    float line = max(1.0 - smoothstep(0.0, w, dx), 1.0 - smoothstep(0.0, w, dy));
    vec3 V = normalize(cameraPosition - vP);
    float fres = pow(1.0 - abs(dot(normalize(vN), V)), 1.6);
    float a = line * fres * 0.62 * strength;
    gl_FragColor = vec4(vec3(0.55, 0.78, 0.90) * a, a);
  }`;
  return (
    <mesh scale={1.0015}>
      <sphereGeometry args={[radius, 128, 96]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function ZoomWatcher({ onScale, onDescend }: { onScale: (s: string) => void; onDescend: () => void }) {
  const { camera } = useThree();
  const last = useRef("");
  const armed = useRef(true);
  useFrame(() => {
    const d = camera.position.length();
    let s = "GLOBAL";
    if (d < 2.6) s = "OCEAN";
    if (d < 1.7) s = "REGION";
    if (d < 1.32) s = "LOCAL";
    if (d < 1.01) s = "SURFACE";
    if (s !== last.current) { last.current = s; onScale(s); }

  });
  return null;
}

/** Keep the whole planet in frame whatever the aspect ratio (phones included). */
function ResponsiveFraming({ controls }: { controls: React.MutableRefObject<any> }) {
  const { camera, size } = useThree();
  const initialized=useRef(false);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;
    const aspect = size.width / Math.max(1, size.height);
    const halfV = (cam.fov * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const need = 1.10 / Math.sin(Math.min(halfV, halfH));
    if (controls.current) {
      controls.current.minDistance = MIN_CAMERA_DISTANCE;
      controls.current.maxDistance = MAX_CAMERA_DISTANCE;
    }
    const d = camera.position.length();
    const want = initialized.current ? (d > 2.8 ? need : d) : need;
    initialized.current=true;
    if (Math.abs(d - want) > 0.02) camera.position.multiplyScalar(want / d);
  }, [size.width, size.height, camera, controls]);
  return null;
}

function CameraPrecision(){const {camera}=useThree();useFrame(()=>{camera.position.setLength(clampCameraDistance(camera.position.length()));const c=camera as THREE.PerspectiveCamera,next=Math.max(.0000003,Math.min(.1,(c.position.length()-1)*.025));if(Math.abs(next-c.near)>c.near*.05){c.near=next;c.updateProjectionMatrix();}});return null;}

function CameraActions(){
 const {camera,size}=useThree();const action=useAtlas(s=>s.cameraAction),want=useRef<number|null>(null);
 useEffect(()=>{if(!action)return;const d=want.current??camera.position.length();
  const v=(camera as THREE.PerspectiveCamera).fov*Math.PI/360, h=Math.atan(Math.tan(v)*size.width/Math.max(1,size.height));
  want.current=action.kind==="home"?1.10/Math.sin(Math.min(v,h)):action.kind==="in"?1+Math.max(MIN_CAMERA_DISTANCE-1,(d-1)*.42):clampCameraDistance(1+(d-1)*2.4);
 },[action?.key]);
 useFrame((_,dt)=>{if(want.current===null)return;const d=camera.position.length(),next=THREE.MathUtils.lerp(d,want.current,useAtlas.getState().reducedMotion?1:1-Math.exp(-dt*8));camera.position.setLength(clampCameraDistance(next));if(Math.abs(next-want.current)<.000001)want.current=null;});return null;
}

function CameraFocus({ controls }: { controls: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const focus = useAtlas((s) => s.focus);
  const target = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    if (!focus) return;
    const dist = Math.max(1.5, camera.position.length());
    const [x, y, z] = lonLatToVec3(focus.lon, focus.lat, dist);
    target.current = new THREE.Vector3(x, y, z);
    if (controls.current) controls.current.autoRotate = false;
    const t = setTimeout(() => { if (controls.current) controls.current.autoRotate = false; }, 2600);
    return () => clearTimeout(t);
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    if (!target.current) return;
    // Rotate on the sphere: Cartesian lerp takes a chord through Earth and zooms in.
    const distance=camera.position.length();
    const direction=camera.position.clone().normalize();
    const rotation=new THREE.Quaternion().setFromUnitVectors(direction,target.current.clone().normalize());
    const turn=new THREE.Quaternion().slerp(rotation,useAtlas.getState().reducedMotion ? 1 : Math.min(1,dt*3.4));
    camera.position.copy(direction.applyQuaternion(turn).multiplyScalar(distance));
    target.current.setLength(distance);
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(target.current) < 0.008) target.current = null;
  });
  return null;
}

function Scene({ field, count, onDescend, onScale }: {
  field: CurrentField; count: number; onDescend: () => void; onScale: (s: string) => void;
}) {
  const setHover = useAtlas((s) => s.setHover);
  const select = useAtlas((s) => s.select);
  const layers = useAtlas((s) => s.layers);
  const quality = useAtlas((s) => s.quality);
  const gpSize = quality === "HIGH" ? 42 : 32;
  const showStars = layers.stars !== false;
  const mode = useAtlas((s) => s.mode);
  const rate = useAtlas((s) => s.time.playing?s.time.rate:0);
  const controls = useRef<any>(null);
  const reducedMotion = useAtlas((s) => s.reducedMotion);
  const { t, name } = useLanguage();
  const { gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const down = () => { if (controls.current) controls.current.autoRotate = false; };
    let resumeTimer:ReturnType<typeof setTimeout>;
    const up = () => {clearTimeout(resumeTimer);resumeTimer=setTimeout(() => { if (controls.current) controls.current.autoRotate = false; }, 3400);};
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => { clearTimeout(resumeTimer);el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); };
  }, [gl]);

  const currentTexture = useMemo(() => {
    const data = encodeFieldTexture(field);
    const t = new THREE.DataTexture(data, field.width, field.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [field]);

  const warmTexture = useMemo(() => {
    const data = encodeWarmthTexture(field);
    const t = new THREE.DataTexture(data, field.width, field.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [field]);

  useEffect(() => () => { currentTexture.dispose(); warmTexture.dispose(); }, [currentTexture, warmTexture]);

  const onMove = useCallback((e: any) => {
    e.stopPropagation();
    const [lon, lat] = sphereHitToLonLat(e.point, RADIUS);
    const c = (useAtlas.getState().layers.currents || useAtlas.getState().layers.field || useAtlas.getState().layers.warmcold) &&isWater(field,lon,lat) ? pickCurrent(lon, lat) : null;
    if (c) { setHover({ label: t("洋流", "Current"), sub: name(c), x: e.clientX, y: e.clientY }); return; }
    const o = isWater(field,lon,lat)?pickOcean(lon, lat):null;
    setHover(o ? { label: t("海洋", "Ocean"), sub: name(o), x: e.clientX, y: e.clientY } : null);
  }, [setHover, t, name,field]);

  const onLeave = useCallback(() => setHover(null), [setHover]);

  const focusOn = useAtlas((s) => s.focusOn);
  const onClick = useCallback((e: any) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    const [lon, lat] = sphereHitToLonLat(e.point, RADIUS);
    if(useAtlas.getState().panel==="weather"){useWeather.getState().inspect(lon,lat);return;}
    const c = (useAtlas.getState().layers.currents || useAtlas.getState().layers.field || useAtlas.getState().layers.warmcold) &&isWater(field,lon,lat) ? pickCurrent(lon, lat) : null;
    if (c) { select({ kind: "current", id: c.id }); focusOn(lon, lat); return; }
    const o = isWater(field,lon,lat)?pickOcean(lon, lat):null;
    if (o) { select({ kind: "ocean", id: o.id }); focusOn(lon, lat); }else useAtlas.getState().setPanel("earth");
  }, [select, focusOn,field]);

  return (
    <>
      {showStars && <ParticleStars />}
      <Earth radius={RADIUS} currentMap={currentTexture} warmMap={warmTexture}
        showField={layers.field} geoMode={layers.warmcold}
        showAirglow={layers.airglow} showClouds={layers.clouds}
        showSeaRelief={layers.relief} reducedMotion={reducedMotion}
        onPointerMove={onMove} onPointerOut={onLeave} onClick={onClick} />
      {layers.land!==false&&layers.ocean!==false&&<SurfaceTiles/>}
      {layers.atmosphere && <Atmosphere radius={RADIUS} steps={quality === "HIGH" ? 18 : quality === "MEDIUM" ? 12 : 8} />}
      <Graticule radius={RADIUS} on={layers.graticule} />
      {layers.boundaries&&<Coastlines/>}
      {layers.windbelts&&<WindBelts radius={RADIUS} />}
      {(layers.wind||layers.rain)&&<WeatherLayer/>}
      {layers.labels && OCEANS.map(o => <Html key={o.id} position={lonLatToVec3(o.lon,o.lat,1.008)} occlude center distanceFactor={4}><span className="globe-label">{name(o)}</span></Html>)}
      {layers.currents && (quality === "LOW"
        ? <CurrentParticles field={field} radius={RADIUS} count={count} show={layers.currents} rate={reducedMotion ? 0 : rate} />
        : <GpuCurrentParticles field={field} radius={RADIUS} size={gpSize} show={layers.currents} rate={reducedMotion ? 0 : rate} />)}
      <UpwellingMarkers radius={RADIUS} />
      <DiveMarkers radius={RADIUS} />

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        rotateSpeed={0.55}
        zoomSpeed={1.25}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={MAX_CAMERA_DISTANCE}
        autoRotate={false}
        autoRotateSpeed={0.16}
      />
      <ZoomWatcher onScale={onScale} onDescend={onDescend} />
      <CameraFocus controls={controls} />
      <CameraActions/>
      <CameraPrecision/>
      <ResponsiveFraming controls={controls} />
    </>
  );
}

export default function GlobeScene({ field, quality, onDescend, onScale }: {
  field: CurrentField; quality: "HIGH" | "MEDIUM" | "LOW"; onDescend: () => void; onScale: (s: string) => void;
}) {
  const {t}=useLanguage();
  const count = quality === "HIGH" ? 1800 : quality === "MEDIUM" ? 1200 : 650;
  return (
    <Canvas aria-label={t("可旋转缩放的地球；也可从资料库选择对象。","Interactive globe. You can also select features in the library.")}
      dpr={[1, quality === "HIGH" ? 1.9 : 1.35]}
      camera={{ position: lonLatToVec3(28, -8, 4.4), fov: 34, near: 0.000002, far: 120 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color("#020203"));
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.35;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Suspense fallback={null}>
        <Scene field={field} count={count} onDescend={onDescend} onScale={onScale} />
      </Suspense>
    </Canvas>
  );
}
