import * as THREE from 'three'
import type { PlanetDef, RingDef, SurfaceMode } from '../data/types'

/**
 * 全部天体表面都由程序化着色器生成（除地球/火星用公共领域贴图）。
 * 光只有一个来源：位于原点的太阳。片元里用 normalize(-世界坐标) 得到光照方向。
 */

const NOISE = /* glsl */ `
float hash31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0.0,0.0,0.0)), hash31(i + vec3(1.0,0.0,0.0)), f.x),
        mix(hash31(i + vec3(0.0,1.0,0.0)), hash31(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0,0.0,1.0)), hash31(i + vec3(1.0,0.0,1.0)), f.x),
        mix(hash31(i + vec3(0.0,1.0,1.0)), hash31(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p){
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; }
  return s;
}
`

const SURFACE = /* glsl */ `
// 环形山：多尺度圆环结构，像科学插画里的撞击坑，而不是真实地形
float craterField(vec3 p){
  float acc = 0.0;
  float scale = 5.0;
  for (int i = 0; i < 4; i++){
    vec3 q = p * scale;
    vec3 cell = floor(q);
    vec3 f = fract(q) - 0.5;
    float h = hash31(cell);
    vec3 offset = vec3(hash31(cell + 1.7), hash31(cell + 3.1), hash31(cell + 5.9)) - 0.5;
    float d = length(f - offset * 0.55);
    float r = 0.15 + h * 0.24;
    acc += (smoothstep(0.03, 0.0, abs(d - r)) - 0.35 * smoothstep(r, 0.0, d)) * (h - 0.45) * (2.2 / scale);
    scale *= 2.15;
  }
  return acc;
}

// 气态行星纬向带纹：用纬度 + 扰动噪声驱动
float bandPattern(vec3 p, float freq, float warp, float t){
  float lat = p.y;
  float w = (fbm3(p * 2.6 + vec3(0.0, t * 0.012, 0.0)) - 0.5) * warp;
  return fbm3(vec3(lat * freq + w, 0.4, 0.7) * 1.6);
}

// 大风暴：一颗椭圆形的涡旋
float stormSpot(vec3 p, float lon, float lat){
  vec2 d = vec2((lon - 0.55) * 1.25, (lat + 0.22) * 2.4);
  return smoothstep(0.24, 0.0, length(d));
}
`

const VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform float uHasMap;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform float uHasClouds;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uSurfaceMode;
uniform vec3 uAtmoColor;
uniform float uAtmoStrength;
uniform float uNightLights;
uniform float uDim;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;

${NOISE}
${SURFACE}

/**
 * 真实贴图优先（NASA / Solar System Scope 的 2K 贴图）。
 * 木星的大红斑、土星的带纹、地球的云与海、水星的环形山都在贴图里，
 * 不需要也不应该再叠一层程序化纹理——那才是"假"的来源。
 */
vec3 mappedSurface(vec3 n, vec3 p, int mode){
  vec3 base = texture2D(uMap, vUv).rgb;
  if (mode == 5) {
    // 地球：独立云层（真实云图，缓慢西移）
    if (uHasClouds > 0.5) {
      vec2 cuv = vec2(fract(vUv.x + uTime * 0.0016), vUv.y);
      // 云要"看得见"：对比度拉开，云顶纯白，海面上的薄云也留得住（v6 §1）
      float raw = texture2D(uClouds, cuv).r;
      float c = smoothstep(0.08, 0.52, raw);
      base = mix(base, vec3(0.97, 0.985, 1.0), clamp(c * 1.05, 0.0, 1.0));
    }
    // Blue Marble 的"深蓝深绿高对比"要压住，但不能压成灰球：
    // 只做很轻的去饱和，然后把海洋压成真正的深海蓝、整体提亮（v6 §1）。
    float luma = dot(base, vec3(0.299, 0.587, 0.114));
    base = mix(base, vec3(luma), 0.08);
    float ocean = smoothstep(0.0, 0.10, base.b - base.r);
    base = mix(base, base * vec3(0.72, 0.92, 1.28), ocean * 0.75);
    base = min(base * 1.28 + vec3(0.02), vec3(1.0));
    return base;
  }
  if (mode == 6) {
    /**
     * 火星：真实颜色是赭红 / 棕红，不是纯红，把饱和度收一收。
     * **不再叠程序化的白色极冠**——旧版这里加了一圈 smoothstep(0.8, 0.97) 的白，
     * 结果球体上下各糊出一片"白雾"，压在贴图本来就有的极冠上面（v6 §1）。
     */
    float luma = dot(base, vec3(0.299, 0.587, 0.114));
    base = mix(base, vec3(luma) * vec3(1.06, 0.98, 0.92), 0.3);
    return base * vec3(1.02, 1.0, 0.99);
  }
  if (mode == 2) {
    // 有真实云顶贴图（金星 / 土卫六）时以贴图为准：只做很轻的提亮与去饱和。
    // 之前"金星是白球"就是因为这里把贴图整颗替换成了接近纯白的云色。
    float luma = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 tinted = base * vec3(1.04, 1.0, 0.93);
    return mix(mix(base, tinted, 0.7), vec3(luma) * vec3(1.02, 0.99, 0.94), 0.12);
  }
  if (mode == 4) {
    // 冰巨星：贴图本身就很淡，略微提亮
    return base * 1.08;
  }
  return base;
}

vec3 proceduralSurface(vec3 n, vec3 p, int mode){
  // 贴图缺失时的兜底：程序化生成
  if (mode == 1) {
    // 岩质 / 环形山
    float base = fbm3(n * 3.4);
    float craters = craterField(n);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.8, base));
    col *= 0.82 + craters * 0.6;
    return col;
  }
  if (mode == 2) {
    // 云层：翻卷的硫云
    float swirl = fbm3(n * 2.1 + vec3(0.0, uTime * 0.008, 0.0));
    float detail = fbm3(n * 6.0 - vec3(uTime * 0.004));
    vec3 col = mix(uColorA, uColorB, smoothstep(0.3, 0.75, swirl));
    col = mix(col, uColorC, smoothstep(0.55, 0.9, detail) * 0.5);
    return col;
  }
  if (mode == 3) {
    // 气态带纹
    float lon = atan(n.z, n.x) / 3.14159265;
    float latRaw = n.y;
    float b = bandPattern(n, 5.5, 0.55, uTime);
    float b2 = bandPattern(n, 13.0, 0.9, uTime * 1.4);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.28, 0.72, b));
    col = mix(col, uColorC, smoothstep(0.6, 0.95, b2) * 0.65);
    col = mix(col, uColorC, stormSpot(n, lon, latRaw) * 0.55);
    return col;
  }
  if (mode == 4) {
    // 冰巨星：柔和的纬向渐变 + 极淡的云
    float lat = n.y;
    float tint = smoothstep(-0.9, 0.9, lat + fbm3(n * 2.2) * 0.18);
    vec3 col = mix(uColorA, uColorB, tint);
    col = mix(col, uColorC, smoothstep(0.62, 0.95, fbm3(n * 4.5)) * 0.25);
    return col;
  }
  if (mode == 5) {
    // 地球：真实贴图 + 独立云层（缓慢旋转）
    if (uHasMap > 0.5) {
      vec3 base = texture2D(uMap, vUv).rgb;
      if (uHasClouds > 0.5) {
        vec2 cloudUv = vec2(fract(vUv.x + uTime * 0.0022), vUv.y);
        float clouds = texture2D(uClouds, cloudUv).r;
        base = mix(base, vec3(0.95, 0.97, 1.0), smoothstep(0.35, 0.85, clouds) * 0.7);
      }
      return base;
    }
    float land = fbm3(n * 2.2 + vec3(3.1));
    float coast = smoothstep(0.5, 0.56, land);
    vec3 ocean = mix(uColorB, uColorA, smoothstep(-0.2, 0.4, fbm3(n * 1.5)));
    vec3 ground = mix(vec3(0.24, 0.32, 0.18), vec3(0.45, 0.38, 0.24), fbm3(n * 4.0));
    vec3 col = mix(ocean, ground, coast);
    float ice = smoothstep(0.78, 0.95, abs(n.y));
    col = mix(col, vec3(0.92, 0.94, 0.96), ice * 0.9);
    float cloud = smoothstep(0.52, 0.72, fbm3(n * 3.2 + vec3(uTime * 0.012, 0.0, 0.0)));
    return mix(col, vec3(0.94, 0.96, 0.99), cloud * 0.55);
  }
  // 火星
  if (uHasMap > 0.5) {
    vec3 base = texture2D(uMap, vUv).rgb;
    base *= vec3(1.06, 0.95, 0.88);
    float polar = smoothstep(0.82, 0.97, abs(n.y));
    return mix(base, vec3(0.88, 0.9, 0.92), polar * 0.65);
  }
  float dust = fbm3(n * 2.6);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.8, dust));
  col = mix(col, uColorC, smoothstep(0.62, 0.95, craterField(n) + 0.5) * 0.35);
  float polar = smoothstep(0.84, 0.98, abs(n.y));
  return mix(col, vec3(0.85, 0.87, 0.9), polar * 0.55);
}

// 夜景灯光：只在昼夜线附近的陆地上出现
float nightLights(vec3 n, float lambert){
  float land = smoothstep(0.52, 0.58, fbm3(n * 2.2 + vec3(3.1)));
  float band = smoothstep(0.35, -0.05, lambert);
  float dots = step(0.78, fbm3(n * 46.0));
  return land * band * dots;
}

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(-vWorldPos);
  int mode = int(uSurfaceMode + 0.5);

  vec3 albedo = uHasMap > 0.5 ? mappedSurface(N, vWorldPos, mode) : proceduralSurface(N, vWorldPos, mode);

  float ndl = dot(N, L);
  // 昼夜线要"硬"：夜面几乎是黑的，只留 3% 的环境底噪，
  // 之前那套 16% 环境光就是"暗面像玻璃一样透亮"的根源（方案书 §9）。
  // v6 §1：受光区再放开一点（-0.12 → 0.24），否则地球的可见面总是半明半暗，
  // "Blue Marble 那种明亮的蓝"根本出不来。
  float lambert = smoothstep(-0.12, 0.24, ndl);
  float ambient = 0.03 + 0.05 * uNightLights;
  vec3 col = albedo * (ambient + (1.0 - ambient) * lambert);
  // 昼夜线附近极弱的一次散射：避免夜面死黑，但不再整颗星泛橘
  col += albedo * smoothstep(0.20, 0.0, abs(ndl)) * vec3(0.10, 0.075, 0.055) * 0.55;

  // 海面高光
  if (mode == 5 && uHasMap < 0.5) {
    float land = smoothstep(0.5, 0.56, fbm3(N * 2.2 + vec3(3.1)));
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 48.0) * (1.0 - land);
    col += vec3(1.0, 0.96, 0.9) * spec * 0.5 * lambert;
  }
  // 真实贴图的地球：海洋照样要有镜面反光，否则整颗球是"哑光塑料"
  if (mode == 5 && uHasMap > 0.5) {
    float ocean = smoothstep(0.0, 0.10, albedo.b - albedo.r);
    float glint = pow(max(dot(reflect(-L, N), V), 0.0), 42.0);
    col += vec3(1.0, 0.97, 0.92) * glint * ocean * 0.42 * lambert;
  }

  // 夜景灯光：有夜面贴图时用真实城市灯光，否则程序化点阵
  if (uNightLights > 0.001) {
    // 有真实夜灯贴图就用它，否则退回程序化点阵
    float lights = uHasMap > 0.5 ? texture2D(uNight, vUv).r : nightLights(N, ndl);
    col += vec3(1.0, 0.82, 0.55) * lights * uNightLights * smoothstep(0.32, -0.05, ndl);
  }

  // 大气边缘光
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  // 只让受光侧的大气发光：夜面的大气辉光必须消失，否则又变回"透亮的暗面"
  col += uAtmoColor * rim * uAtmoStrength * (0.04 + 0.96 * lambert * lambert);

  // v8 §26：聚焦某颗行星时，其余行星由 uDim 压暗（不是全屏变暗）
  gl_FragColor = vec4(col * uDim, 1.0);
  }
  `

const MODE_INDEX: Record<SurfaceMode, number> = {
  rocky: 1,
  cratered: 1,
  cloudy: 2,
  gas: 3,
  ice: 4,
  earth: 5,
  mars: 6,
  star: 0,
}

/** 行星和月球共用一套表面材质，所以只需要这几个字段 */
export type SurfaceSpec = Pick<PlanetDef, 'surface' | 'color'> & {
  id: string
  atmosphere?: PlanetDef['atmosphere']
}

export interface PlanetMaterialHandle {
  material: THREE.ShaderMaterial
  setMap: (texture: THREE.Texture | null) => void
}

export function createPlanetMaterial(def: SurfaceSpec): PlanetMaterialHandle {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: null as THREE.Texture | null },
      uHasMap: { value: 0 },
      uNight: { value: null as THREE.Texture | null },
      uClouds: { value: null as THREE.Texture | null },
      uHasClouds: { value: 0 },
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(def.color) },
      uColorB: { value: new THREE.Color(def.color).offsetHSL(0.02, -0.08, -0.16) },
      uColorC: { value: new THREE.Color(def.color).offsetHSL(-0.04, 0.06, 0.14) },
      uSurfaceMode: { value: MODE_INDEX[def.surface] ?? 1 },
      uAtmoColor: { value: new THREE.Color(def.atmosphere?.color ?? '#ffffff') },
      uAtmoStrength: { value: def.atmosphere?.strength ?? 0.15 },
      uNightLights: { value: def.id === 'earth' ? 0.26 : 0.0 },
      // v8 §26：聚焦时的背景压暗（1 = 不压暗）
      uDim: { value: 1 },
    },
  })

  // 针对具体行星做一点调色，让每颗星球有辨识度
  if (def.id === 'jupiter') {
    material.uniforms.uColorA.value.set('#8f5a3c')
    material.uniforms.uColorB.value.set('#e2c39b')
    material.uniforms.uColorC.value.set('#f2e2c8')
  }
  if (def.id === 'saturn') {
    material.uniforms.uColorA.value.set('#b9925e')
    material.uniforms.uColorB.value.set('#ecd8ab')
    material.uniforms.uColorC.value.set('#f6ecd4')
  }
  if (def.id === 'venus') {
    material.uniforms.uColorA.value.set('#c9a86a')
    material.uniforms.uColorB.value.set('#f0dcb4')
    material.uniforms.uColorC.value.set('#fbeed3')
  }
  if (def.id === 'neptune') {
    material.uniforms.uColorA.value.set('#2f5c94')
    material.uniforms.uColorB.value.set('#6f97c8')
    material.uniforms.uColorC.value.set('#bcd4ea')
  }
  if (def.id === 'uranus') {
    material.uniforms.uColorA.value.set('#6fb2bb')
    material.uniforms.uColorB.value.set('#a9dde1')
    material.uniforms.uColorC.value.set('#dff0f2')
  }

  return {
    material,
    setMap: (texture) => {
      material.uniforms.uMap.value = texture
      material.uniforms.uHasMap.value = texture ? 1 : 0
      material.needsUpdate = true
    },
  }
}

/** 贴图挂载：昼面贴图（所有行星）+ 夜灯 / 云层（地球） */
export function attachSurfaceMaps(
  handle: PlanetMaterialHandle,
  day: THREE.Texture | null,
  night: THREE.Texture | null,
  clouds: THREE.Texture | null
) {
  handle.setMap(day)
  handle.material.uniforms.uNight.value = night
  handle.material.uniforms.uClouds.value = clouds
  handle.material.uniforms.uHasClouds.value = clouds ? 1 : 0
  handle.material.needsUpdate = true
}

/* ------------------------------------------------------------------ 太阳 */

/**
 * 太阳（方案书 §12）：五层结构，全部程序化，颜色以"白中带暖"为准。
 *
 *   1 光球层  米粒组织 + 超米粒 + 黑子群 + 临边昏暗
 *   2 色球层  极薄的红色亮边
 *   3 日冕层  流线状外冕，慢速变化
 *   4 日珥    边缘的等离子体弧
 *   5 太阳风  向外扩散的极淡粒子场
 *
 * 明确不做的事：红色卡通球、饱和橙色、直接把强度拉爆的过曝。
 */

const SOLAR_HASH = /* glsl */ `
float hash1(float n){ return fract(sin(n) * 43758.5453123); }
`

export interface SunMaterialHandle {
  material: THREE.ShaderMaterial
  setMap: (texture: THREE.Texture | null) => void
}

/**
 * 光球层。有真实日面照片（NASA SDO HMI 白光 / 太阳表面）时以照片为主：
 * 只把照片当作 albedo，再叠一层米粒组织与临边昏暗做球体感；
 * 黑子不是随机黑点，而是把照片里本来就有的黑子轻微加深。
 * 没有照片才退回程序化米粒组织。
 */
export function createSunMaterial(): SunMaterialHandle {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform sampler2D uSunMap;
      uniform float uHasSunMap;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec2 vUv;
      ${NOISE}
      ${SOLAR_HASH}

      // 黑子群：8 个低对比度暗区，随时间缓慢漂移与消长
      float sunspots(vec3 N){
        float acc = 0.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i) + 0.5;
          float lat = (hash1(fi * 1.37) - 0.5) * 1.15;
          float lon = hash1(fi * 2.71) * 6.2831 + uTime * 0.006;
          vec3 dir = normalize(vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon)));
          float r = 0.16 + hash1(fi * 5.11) * 0.22;
          float ang = acos(clamp(dot(N, dir), -1.0, 1.0));
          float life = 0.65 + 0.35 * sin(uTime * 0.05 + fi * 2.3);
          // 半影 + 本影：本影更深、更小
          float penumbra = 1.0 - smoothstep(r * 0.55, r, ang);
          float umbra = 1.0 - smoothstep(r * 0.16, r * 0.42, ang);
          acc = max(acc, penumbra * 0.42 * life + umbra * 0.5 * life);
        }
        return clamp(acc, 0.0, 1.0);
      }

      void main(){
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float mu = clamp(dot(N, V), 0.0, 1.0);

        /**
         * 日面（v6 §1 重做）。
         *
         * 旧的错法有两种：把 EUV 彩色照片直接当颜色贴上去（像科幻 UI），
         * 或者用一条橙色斜坡把整颗球染成橙色（像一颗橘子）。
         * 真实的**光球层**是"暖白偏淡黄 + 高频米粒组织"，只有活动区更白、
         * 黑子更暗；橙色属于色球层，只在临边那一圈出现。
         */
        vec3 core;
        /**
         * 米粒组织（granulation）：日面质感的主要来源。
         * 关键是**对比度**——fbm 自身的输出太平，必须过一道 smoothstep 拉开，
         * 再用它去调制亮度；否则只会得到一颗光滑的奶白球（旧版就是这样）。
         */
        float granule = smoothstep(
          0.32,
          0.72,
          fbm3(vec3(N.x * 120.0, N.y * 66.0, uTime * 0.08))
        );
        float fineGranule = smoothstep(
          0.34,
          0.7,
          fbm3(vec3(N.x * 260.0, N.y * 150.0, uTime * 0.16))
        );
        float granules = granule * 0.68 + fineGranule * 0.32;
        float superGran = fbm3(N * 14.0 - vec3(uTime * 0.018));
        // 有真实日面照片时，用它的亮度补一层大尺度不均匀（活动区 / 谱斑）
        float photo = 0.5;
        if (uHasSunMap > 0.5) {
          vec2 uv = vec2(fract(vUv.x + uTime * 0.0006), vUv.y);
          photo = dot(texture2D(uSunMap, uv).rgb, vec3(0.299, 0.587, 0.114));
        }
        // 照片只占三成：它负责大尺度的不均匀，不能压过米粒组织
        float l = clamp(photo * 0.34 + granules * 0.5 + superGran * 0.16, 0.0, 1.0);
        // 暖白 → 亮斑偏纯白：不是橙色，也不是纯白
        vec3 coreWarm = mix(vec3(1.0, 0.90, 0.74), vec3(1.0, 0.975, 0.93), smoothstep(0.34, 0.86, l));
        core = coreWarm * (0.9 + 0.24 * l);
        // 米粒的明暗对比：±17%，这是"看得见的颗粒感"的下限
        core *= 0.83 + 0.34 * granules;
        // 谱斑 / 活动区：亮斑处更白更亮，交给 bloom 出光
        core += vec3(0.16, 0.13, 0.07) * smoothstep(0.84, 1.0, l);
        // 黑子：本影（深）+ 半影（浅）两层，来自 sunspots() 的现成结构
        float spot = sunspots(N);
        core = mix(core, vec3(0.3, 0.13, 0.05), spot);
        // 临边昏暗：光球层在边缘确实变暗（约 0.6~0.65）
        core *= mix(0.62, 1.0, pow(mu, 0.42));
        /**
         * 色球层：只在最外侧那一圈出现的一层暖橙。
         * 这是整颗太阳**唯一**允许出现橙色的位置——把色球层铺满整颗球
         * 就是"橘子"的来由。
         */
        float chromoRim = pow(1.0 - mu, 3.4);
        core = mix(core, core * vec3(1.25, 0.62, 0.3) + vec3(0.10, 0.03, 0.0), chromoRim * 0.7);
        /**
         * 只比 1 高一点点：这样**只有最亮的米粒峰与谱斑**越过 bloom 阈值，
         * 整颗球不会一起发光。旧版乘到 1.22，整片日面都在 bloom 里，
         * 细节被糊平，看起来就是"一颗发光的奶白球"。
         */
        core *= 1.02;

        gl_FragColor = vec4(core, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uSunMap: { value: null as THREE.Texture | null },
      uHasSunMap: { value: 0 },
    },
  })

  return {
    material,
    setMap: (texture) => {
      material.uniforms.uSunMap.value = texture
      material.uniforms.uHasSunMap.value = texture ? 1 : 0
      material.needsUpdate = true
    },
  }
}

/** 色球层：一层极薄的暖红亮边，只有贴着边缘才看得到 */
export function createChromosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      ${NOISE}
      void main(){
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
        // 色球层的针状体（spicules）：细密的径向扰动，让边缘不是一条光滑的线
        float spicules = fbm3(vec3(N.x * 42.0, N.y * 16.0, uTime * 0.12));
        float flicker = 0.7 + 0.3 * spicules;
        // 色球层的橙：深橙红（v6 §1），比旧版的"淡橙"更接近色球层照片
        vec3 col = mix(vec3(1.0, 0.5, 0.16), vec3(1.0, 0.22, 0.05), rim);
        float alpha = rim * 0.42 * flicker * uIntensity;
        gl_FragColor = vec4(col * alpha * 1.2, alpha);
      }
    `,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  })
}

/** 日冕：流线状的外层辉光，缓慢呼吸，负责"光芒四射但不刺眼" */
export function createCoronaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      ${NOISE}
      void main(){
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float mu = clamp(dot(N, V), 0.0, 1.0);
        /**
         * 日冕（v6 §1 重做）：可见光日冕是**日冕自由电子散射出来的极弱散射光**，
         * 不是从太阳射出去的一束束"光线"。所以这里只有三样东西：
         *   · 一条很陡的边缘衰减（fresnel）；
         *   · 几片**宽而不规则**的流线（streamers），外加更薄的冕洞扇区；
         *   · 接近白、只带一点暖调的颜色（散射光本身是无色的）。
       * 旧版那种"径向光线 + 橙色"的组合，就是"很假"的来源。
       */
        float fres = pow(1.0 - mu, 3.2);
        float streamerA = fbm3(vec3(N.x * 3.4, N.y * 1.15, N.z * 3.4) + vec3(uTime * 0.012));
        float streamerB = fbm3(vec3(N.x * 7.5, N.y * 2.6, N.z * 7.5) - vec3(uTime * 0.02));
        float streamer = streamerA * 0.68 + streamerB * 0.32;
        // 冕洞：流线明显更薄的扇区
        float holes = smoothstep(0.28, 0.6, streamer);
        float mask = (0.35 + 0.65 * holes) * (0.75 + 0.25 * streamerB);
        vec3 col = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.88, 0.74), fres * 0.4);
        float alpha = fres * mask * 0.075 * uIntensity;
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `,
    // v8 §19：uIntensity 让"太阳在屏幕上很小时"把日冕一起收掉，避免亚像素闪动
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  })
}

/** 日珥 / 耀斑弧：沿曲线流动的等离子体，加法混合 */
export function createProminenceMaterial(seed: number, hue: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aProgress;
      varying float vProgress;
      void main(){
        vProgress = aProgress;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      uniform float uHue;
      uniform float uIntensity;
      varying float vProgress;
      void main(){
        // 等离子体沿弧线流动，两端渐隐
        float flow = 0.55 + 0.45 * sin(vProgress * 18.0 - uTime * 0.5 + uSeed * 6.2831);
        float edge = sin(vProgress * 3.14159);
        float breath = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 0.07 + uSeed * 9.4));
        vec3 col = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.84, 0.52), uHue);
        float alpha = edge * flow * breath * uIntensity;
        gl_FragColor = vec4(col * alpha * 1.9, alpha);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uHue: { value: hue },
      uIntensity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

/** 太阳风：从太阳向外扩散的极淡粒子，暖白到淡琥珀 */
export function createSolarWindMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aOffset;
      attribute float aSpeed;
      attribute float aSize;
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vTint;
      varying float vAlpha;
      void main(){
        vec3 dir = normalize(position);
        float life = fract(aOffset + uTime * aSpeed);
        // 只在太阳外侧一段范围内可见
        float r = 1.35 + life * 2.6;
        vec3 p = dir * r;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio;
        vTint = aTint;
        vAlpha = sin(life * 3.14159) * 0.5;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vTint;
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vTint, a);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

/**
 * 镜头光芒：真实照片里太阳没有"十六根光刺"，只有镜头带来的极弱光斑与横向眩光。
 * 所以这里只留一团柔和的径向辉光 + 两道横向拉长的微弱眩光，强度压得很低。
 */
export function createRayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        // 柔和的径向衰减：不是硬边光盘，而是能看见层次的光晕
        float halo = pow(smoothstep(1.0, 0.0, r), 1.7) * 0.5;
        float inner = pow(smoothstep(0.42, 0.0, r), 2.0) * 0.35;
        // 两道横向眩光（anamorphic）：只有一点点，像真实镜头
        float streak = exp(-pow(abs(p.y) * 26.0, 1.7)) * smoothstep(0.95, 0.0, abs(p.x)) * 0.16;
        float breathe = 0.94 + 0.06 * sin(uTime * 0.35);
        float a = (halo + inner + streak) * breathe * uIntensity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * a, a);
      }
    `,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.3 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

/** 光晕贴图：径向渐变，给太阳核心与眩光用 */
export function createGlowTexture(inner: string, mid: string): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, inner)
  gradient.addColorStop(0.22, mid)
  gradient.addColorStop(0.55, 'rgba(255, 214, 170, 0.12)')
  gradient.addColorStop(1, 'rgba(255, 200, 150, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 日面贴图：中间是**硬边**的圆盘，只用很窄的一圈过渡 + 一层收紧的光晕。
 * 开场背景曾经的"糊成一团"就是只有径向渐变、没有边界的后果。
 */
export function createSunDiscTexture(): THREE.Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const r = size / 2
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r)
  gradient.addColorStop(0, 'rgba(255, 252, 246, 1)')
  gradient.addColorStop(0.44, 'rgba(255, 245, 230, 1)')
  gradient.addColorStop(0.5, 'rgba(255, 216, 172, 0.42)')
  gradient.addColorStop(0.62, 'rgba(255, 198, 148, 0.14)')
  gradient.addColorStop(0.82, 'rgba(255, 190, 140, 0.035)')
  gradient.addColorStop(1, 'rgba(255, 190, 140, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/* ------------------------------------------------------------- 行星环系统 */

/**
 * 行星环。
 * 两个必须守住的点：
 *   1) 环贴图按"到环心的距离"采样（RingGeometry 的 uv 不是极坐标）；
 *   2) 片元着色器里绝对不能用 modelMatrix —— three 只在顶点着色器声明它，
 *      写进片元会让整个 program 编译失败，环就彻底消失（这就是"土星没有星环"的真凶）。
 *      所以行星中心由 uPlanetCenter 传进来。
 */
export function createRingMaterial(ring: RingDef, planetRadius: number): THREE.ShaderMaterial {
  const inner = planetRadius * ring.inner
  const outer = planetRadius * ring.outer
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform float uInner;
      uniform float uOuter;
      varying float vRadial;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main(){
        float r = length(position.xy);
        vRadial = clamp((r - uInner) / max(uOuter - uInner, 0.0001), 0.0, 1.0);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uBands;
      uniform float uPlanetRadius;
      uniform vec3 uPlanetCenter;
      uniform float uDim;
      uniform sampler2D uRingMap;
      uniform float uHasRingMap;
      varying float vRadial;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      ${NOISE}
      void main(){
        float r = vRadial;
        vec3 col;
        float alpha;
        if (uHasRingMap > 0.5) {
          // 真实环贴图：alpha 就是环的光学厚度，天然带出卡西尼缝与各层环
          vec4 ringSample = texture2D(uRingMap, vec2(r, 0.5));
          col = ringSample.rgb * uColor * 2.6;
          alpha = uOpacity * ringSample.a;
        } else {
          float bands = 0.55 + 0.45 * sin(r * uBands * 6.2831);
          float fine = 0.75 + 0.25 * fbm3(vec3(r * 90.0, 0.0, 0.0));
          float gap = smoothstep(0.02, 0.0, abs(r - 0.62)) + smoothstep(0.012, 0.0, abs(r - 0.34));
          col = uColor;
          alpha = uOpacity * bands * fine * (1.0 - gap * 0.85);
        }
        alpha *= smoothstep(0.0, 0.03, r) * smoothstep(1.0, 0.97, r);

        // 光照：环面几乎与阳光平行，按物理算会全黑，所以以固定亮度为主 + 一点点方向变化
        vec3 toSun = normalize(-vWorldPos);
        vec3 N = normalize(vNormalW);
        float lit = 0.58 + 0.42 * abs(dot(N, toSun));

        // 行星本体在环上投下的影子（太阳在原点，影子落在背日侧）
        vec3 toPlanet = uPlanetCenter - vWorldPos;
        float along = dot(toPlanet, toSun);
        vec3 perp = toPlanet - toSun * along;
        float shadow = along > 0.0
          ? smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.18, length(perp))
          : 1.0;
        lit *= mix(0.22, 1.0, shadow);

        /**
         * v8.1：环被"压暗"时必须留住轮廓。
         *
         * 直接 alpha × uDim 会让土星环在聚焦别的行星时整圈消失成纯透明——
         * 用户看到的就是"土星环不见了"。亮度可以退到 0.2，
         * 但轮廓要有地板（0.55），这样它仍然读得出是环。
         */
        float ringDim = 0.55 + 0.45 * uDim;
        gl_FragColor = vec4(col * lit * uDim, alpha * ringDim);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(ring.color) },
      uOpacity: { value: ring.opacity },
      uBands: { value: ring.bands },
      uDim: { value: 1 },
      uInner: { value: inner },
      uOuter: { value: outer },
      uPlanetRadius: { value: planetRadius },
      uPlanetCenter: { value: new THREE.Vector3() },
      uRingMap: { value: null as THREE.Texture | null },
      uHasRingMap: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    // 行星在前时环必须被遮住（depthTest 打开），但环自身不写深度
    depthTest: true,
    side: THREE.DoubleSide,
  })
}

/* ---------------------------------------------------------------- 星场 */

export function createStarMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aScale;
      attribute vec3 aTint;
      uniform float uPixelRatio;
      // v8 §8：背景失焦。星点变大、变淡，于是读成"没对上焦的深空"，
      // 而前景的行星 / 轨道不受影响（它们不是这份材质画的）。
      uniform float uDefocus;
      varying vec3 vTint;
      varying float vAlpha;
      void main(){
        vTint = aTint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * uPixelRatio * uDefocus;
        vAlpha = (0.16 + 0.44 * aScale) / max(uDefocus * 0.72, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uBrightness;
      varying vec3 vTint;
      varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.1, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vTint * uBrightness, a * uBrightness);
      }
    `,
    uniforms: { uPixelRatio: { value: 1 }, uBrightness: { value: 1 }, uDefocus: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

/**
 * 星云 / 银河带：一整张穹顶贴在一个大球的内侧。
 * 用方向向量直接采样噪声，所以带子不会随镜头平移而滑动。
 */
export function createNebulaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE}

      float band(vec3 dir, vec3 axis, float width){
        float d = dot(dir, axis);
        return exp(-pow(d / width, 2.0));
      }

      void main(){
        vec3 dir = normalize(vDir);

        // 银河斜带：两层不同宽度的带子叠出"核球 + 银河盘"的层次
        vec3 axis = normalize(vec3(0.34, 0.70, -0.62));
        float wide = band(dir, axis, 0.30);
        float core = band(dir, axis, 0.105);

        // 尘埃：沿着带子拉长的噪声，把整条带子切成明暗相间的结构
        float dust = fbm3(dir * 5.5 + vec3(0.0, uTime * 0.002, 0.0));
        float fine = fbm3(dir * 17.0);
        float lane = smoothstep(0.28, 0.72, dust * 0.7 + fine * 0.3);

        // 极暗的星云团：冷色为主，只有一点点暖色
        float cloudA = smoothstep(0.55, 0.95, fbm3(dir * 2.4 + vec3(11.0)));
        float cloudB = smoothstep(0.60, 0.98, fbm3(dir * 3.1 - vec3(7.0)));

        vec3 col = vec3(0.0);
        col += vec3(0.030, 0.034, 0.049) * wide;
        col += vec3(0.047, 0.043, 0.038) * core;
        col += vec3(0.011, 0.014, 0.022) * (1.0 - lane) * wide;
        col += vec3(0.017, 0.020, 0.032) * cloudA;
        col += vec3(0.026, 0.015, 0.017) * cloudB * 0.6;

        // 一点极淡的暖色，让画面不至于冷成一张蓝纸
        col += vec3(0.017, 0.011, 0.007) * pow(max(dot(dir, normalize(vec3(-0.6, -0.25, 0.75))), 0.0), 3.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    // 放进不透明队列并靠 renderOrder 抢在最前面画：这样它永远是最远的一层，
    // 之后画的行星会正常盖住它（透明队列在深度关闭时会把整片天空糊到行星上）。
    transparent: false,
    blending: THREE.AdditiveBlending,
  })
}

/* ---------------------------------------------------- 人类造物节点（Points） */

export function createObjectNodeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aState;   // 0 普通 / 1 hover / 2 选中
      attribute float aWeight;  // 0..1 时间轴与筛选权重
      attribute float aReveal;  // 0..1 LOD：远景下退成背景密度
      attribute float aGlyph;   // 标记剪影种类
      uniform float uPixelRatio;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vState;
      varying float vGlyph;
      varying float vReveal;
      // 片元里不能读 gl_PointSize（顶点阶段才存在），必须用 varying 传下来
      varying float vPointSize;
      void main(){
        vState = aState;
        vGlyph = aGlyph;
        vReveal = aReveal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // 正交相机：标记必须是屏幕空间恒定大小，不能按视深度缩放
        float boost = aState > 1.5 ? 1.7 : (aState > 0.5 ? 1.34 : 1.0);
        float pulse = 1.0 + 0.05 * sin(uTime * 2.0 + position.x * 0.6);
        gl_PointSize = clamp(
          aSize * boost * pulse * uPixelRatio * mix(0.5, 1.0, aReveal),
          3.0 * uPixelRatio,
          40.0 * uPixelRatio
        );
        vPointSize = gl_PointSize;
        vColor = aColor;
        // 总览里同一片空域可能叠着几十个节点。透明度压低 + 改用普通混合
        // （不再叠加发光），否则地球附近会糊成一团刺眼的白光（v5 §6）。
        vAlpha = aWeight * mix(0.12, 0.62, aReveal);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vState;
      varying float vGlyph;
      varying float vReveal;
      varying float vPointSize;
      uniform float uDim;

      float sdBox(vec2 p, vec2 b){
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }
      float sdHexagon(vec2 p, float r){
        const vec2 k = vec2(-0.866025404, 0.5);
        p = abs(p);
        p -= 2.0 * min(dot(k, p), 0.0) * k;
        p -= vec2(clamp(p.x, -k.y * r, k.y * r), r);
        return length(p) * sign(p.y);
      }
      // 每种造物一个极简剪影：看得懂，但不是瞄准镜
      float glyphDistance(float g, vec2 c){
        if (g > 0.5 && g < 1.5) {              // 桁架空间站
          return min(sdBox(c, vec2(0.9, 0.09)), sdBox(c, vec2(0.09, 0.62)));
        }
        if (g > 1.5 && g < 2.5) {              // 望远镜镜筒
          return sdBox(c, vec2(0.72, 0.26));
        }
        if (g > 2.5 && g < 3.5) {              // 深空探测器：天线 + 舱体
          vec2 q = c - vec2(0.2, 0.28);
          return min(sdBox(c - vec2(-0.1, -0.34), vec2(0.34, 0.2)), length(q) - 0.5);
        }
        if (g > 3.5 && g < 4.5) {              // 六边主镜
          return sdHexagon(c, 0.72);
        }
        if (g > 4.5 && g < 5.5) {              // 太阳观测器：环 + 辐条
          float ring = abs(length(c) - 0.56) - 0.09;
          float spokes = abs(sin(atan(c.y, c.x) * 4.0)) * 0.5 - 0.06;
          return max(ring, -spokes - 0.0) + max(length(c) - 0.72, 0.0);
        }
        if (g > 5.5 && g < 6.5) {              // 巡视器 + 车轮
          float body = sdBox(c - vec2(0.0, 0.16), vec2(0.5, 0.2));
          float wheel = length(c - vec2(-0.34, -0.36)) - 0.17;
          return min(body, wheel);
        }
        if (g > 6.5) {                          // 返回舱：圆锥
          return max(max(abs(c.x) * 1.5 + c.y - 0.6, -c.y - 0.72), -1.2);
        }
        return length(c) - 0.52;                // 一般卫星：实心核
      }

      void main(){
        vec2 c = (gl_PointCoord - 0.5) * 2.0;
        float d = length(c);
        float width = 2.4 / max(vPointSize, 6.0);
        // LOD：远距离只是一个低饱和的小点（无 bloom、不闪烁），
        // 推近之后才显示"太阳能板 / 天线 / 镜筒"这些剪影（v5 §6）。
        float glyph = glyphDistance(vGlyph, c);
        float simpleDot = length(c) - 0.34;
        float shape = mix(simpleDot, glyph, smoothstep(0.3, 0.75, vReveal));

        float body = smoothstep(width, -width, shape);
        float glow = exp(-max(shape, 0.0) * 3.6) * 0.28;
        // 一圈极细的轨道刻度：像天文观测标记，不是按钮边框
        float ring = smoothstep(0.06, 0.0, abs(d - 0.86));

        float alpha = (body + glow * 0.9 + ring * 0.35) * vAlpha;
        if (alpha < 0.012) discard;

        vec3 col = mix(vColor, vec3(1.0, 0.98, 0.94), body * 0.55);
        col = mix(col, vec3(1.0), glow * 0.3);
        if (vState > 0.5) col = mix(col, vec3(1.0, 0.94, 0.82), 0.35);
        if (vState > 1.5) col = mix(col, vec3(1.0, 0.82, 0.52), 0.5);
        gl_FragColor = vec4(col, alpha * uDim);
      }
    `,
    uniforms: {
      uPixelRatio: { value: 1 },
      uTime: { value: 0 },
      uDim: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
}
