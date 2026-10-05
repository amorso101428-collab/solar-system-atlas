/** Shared verbatim surface model from the supplied solar atlas. Sun position is explicit for the Earth-centered scene. */
export const NOISE = /* glsl */ `
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

export const SURFACE = /* glsl */ `
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

export const VERT = /* glsl */ `
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

export const FRAG = /* glsl */ `
precision highp float;

uniform vec3 uSunPosition;
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
    // Linear-light albedo, with optical cloud coverage and offset cloud shadows.
    if (uHasClouds > 0.5) {
      vec2 cuv = vec2(fract(vUv.x + uTime * 0.00012), vUv.y);

      float shadow = 1.0-exp(-texture2D(uClouds, cuv + vec2(0.0018, 0.0006)).r*2.2);
      base *= 1.0 - shadow * 0.12;

    }
    float sea = smoothstep(0.12,0.50,(base.b-base.r)/(base.b+base.r+0.005));
    float luminance = dot(base,vec3(0.2126,0.7152,0.0722));
    // Muted land and a finite ocean reflectance, rather than crushed navy pixels.
    base = mix(base,vec3(luminance)*vec3(1.02,1.0,.98),.32);
    base = mix(base,vec3(.026,.040,.065)+luminance*.12,sea*.86);
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
  vec3 L = normalize(uSunPosition-vWorldPos);
  int mode = int(uSurfaceMode + 0.5);

  vec3 albedo = uHasMap > 0.5 ? mappedSurface(N, vWorldPos, mode) : proceduralSurface(N, vWorldPos, mode);

  float ndl = dot(N, L);
  // 昼夜线要"硬"：夜面几乎是黑的，只留 3% 的环境底噪，
  // 之前那套 16% 环境光就是"暗面像玻璃一样透亮"的根源（方案书 §9）。
  // v6 §1：受光区再放开一点（-0.12 → 0.24），否则地球的可见面总是半明半暗，
  // "Blue Marble 那种明亮的蓝"根本出不来。
  float lambert = mode == 5 ? pow(max(ndl, 0.0), 0.72) : smoothstep(-0.12, 0.24, ndl);
  float ambient = mode == 5 ? 0.003 : 0.03;
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
    float glint = pow(max(dot(reflect(-L, N), V), 0.0), 110.0);
    float clearSky = uHasClouds > 0.5 ? exp(-texture2D(uClouds,vec2(fract(vUv.x+uTime*0.00012),vUv.y)).r*3.2) : 1.0;
    col += vec3(1.0, 0.97, 0.92) * glint * ocean * 0.15 * lambert * clearSky;
  }

  // 夜景灯光：有夜面贴图时用真实城市灯光，否则程序化点阵
  if (uNightLights > 0.001) {
    // 有真实夜灯贴图就用它，否则退回程序化点阵
    float lights = uHasMap > 0.5 ? texture2D(uNight, vUv).r : nightLights(N, ndl);
    col += vec3(1.0, 0.82, 0.55) * lights * uNightLights * (1.0 - smoothstep(-0.18, 0.02, ndl));
  }

  // 大气边缘光
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  // 只让受光侧的大气发光：夜面的大气辉光必须消失，否则又变回"透亮的暗面"
  if(mode==5){
    float path=pow(1.0-clamp(dot(N,V),0.0,1.0),2.2);
    float haze=(.085+.22*path)*smoothstep(-.05,.18,ndl);
    col=mix(col,vec3(.12,.17,.24)*lambert,haze);
  }else{
    col += uAtmoColor * rim * uAtmoStrength * (0.04 + 0.96 * lambert * lambert);
  }

  // v8 §26：聚焦某颗行星时，其余行星由 uDim 压暗（不是全屏变暗）
  gl_FragColor = vec4(col * uDim, 1.0);
  }
  `

