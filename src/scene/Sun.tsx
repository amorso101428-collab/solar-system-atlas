import { useExperience } from '../state/experience'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import {
  createChromosphereMaterial,
  createCoronaMaterial,
  createGlowTexture,
  createProminenceMaterial,
  createSunMaterial,
} from './materials'
import { SUN_RADIUS } from '../utils/layout'
import { useTexture } from './useTexture'
import { useAtlasStore } from '../state/atlasStore'
import { useQualitySettings } from '../performance/useQuality'

/**
 * 太阳（方案书 §2 / §15）。
 *
 * 分层：光球层（真实日面照片）→ 色球层 → 日冕 → 日珥 → 镜头眩光。
 *
 * 这一版删掉了常态的"太阳风粒子喷射"：真实的太阳风不是肉眼可见的粒子流，
 * 主界面只该看到光、热、日冕与低强度活动（方案书 §2.1）。
 * 全部图层深度测试打开，行星转到太阳前面时会真的挡住它们。
 */

/**
 * 沿太阳边缘的一段等离子体弧（日珥 / 耀斑）。
 *
 * v6 §2：每颗日珥由 **3 股**细丝组成（strand 0/1/2），共用同一个根部与跨度、
 * 只把高度和相位轻微错开——于是它读起来是一团"等离子体环"，
 * 而不是"太阳边上画了两条弧线"。旧版一颗日珥只有一根线，在缩小之后就是一根白丝。
 *
 * 弧面必须是**竖直的**：沿着球面法线 × 世界上方向张开的平面。
 * 旧版把日珥画在黄道面里，而镜头几乎沿黄道面看过去——那些环全被压成
 * 从太阳边缘射出去的直线，看起来就像几根光刺。
 */
function prominenceCurve(index: number, strand = 0): THREE.CatmullRomCurve3 {
  const rand = (n: number) => Math.abs(Math.sin((index + 1) * (n + 1) * 12.9898) * 43758.5453) % 1
  const lat = (rand(0.19) - 0.5) * 1.75 + strand * 0.006
  const lon = index * 2.399963 + 0.35
  const normal = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  ).normalize()
  // 竖直切向：球面法线去掉世界上方向分量，就是"往上"的切向
  const tangent = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y)
  if (tangent.lengthSq() < 1e-4) tangent.set(0, 0, 1)
  tangent.normalize()

  const spread = 0.065 + rand(0.71) * 0.09 + strand * 0.002
  /**
   * 日珥只露出一点点（v8 §22）。
   *
   * 旧版弧顶能到 0.52 个太阳半径、18 组，全览时是一圈毛刺，
   * 缩到最远还会因为亚像素几何而闪烁。现在只留 3 个活动区，
   * 高度 0.03–0.075 个太阳半径 —— 贴着临边露出一点结构，仅此而已。
   */
  // v8.1：0.03–0.075 太小了（推近也几乎看不见），改成 0.07–0.17 个太阳半径：
  // 仍然只露一点点，但在"太阳详情"里能看清弧线的形状。
  const height = SUN_RADIUS * (0.09 + rand(2.31) * 0.13) * (1 + strand * 0.055)
  const base = SUN_RADIUS * 0.99
  const foot = (sign: number) =>
    new THREE.Vector3()
      .addScaledVector(normal, Math.cos(spread) * base)
      .addScaledVector(tangent, Math.sin(spread) * base * sign)
  const top = new THREE.Vector3().addScaledVector(normal, base + height)
  const shoulderA = foot(1).lerp(top, .55).addScaledVector(tangent, SUN_RADIUS * .018 * Math.sin(index + strand))
  const shoulderB = foot(-1).lerp(top, .62).addScaledVector(tangent, SUN_RADIUS * .013 * Math.cos(index + strand))
  return new THREE.CatmullRomCurve3([foot(1), shoulderA, top, shoulderB, foot(-1)], false, 'catmullrom', 0.5)
}

function Prominences({ count = 10, intensity = 1 }: { count?: number; intensity?: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)

  const items = useMemo(() => {
    const list: Array<{
      line: THREE.Mesh
      material: THREE.ShaderMaterial
      speed: number
      baseIntensity: number
    }> = []
    for (let i = 0; i < count; i++) {
      // 3 股细丝 = 1 颗日珥：中股最亮，两股稍暗稍低，叠出"等离子体"的厚度
      for (let strand = 0; strand < 7; strand++) {
        const curve = prominenceCurve(i, strand)
        const geometry = new THREE.TubeGeometry(curve, 48, SUN_RADIUS * (strand === 3 ? 0.004 : 0.0018), 5, false)
        const uv = geometry.getAttribute('uv')
        const progress = new Float32Array(uv.count)
        for (let j=0;j<uv.count;j++) progress[j]=uv.getX(j)
        geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress,1))
        const material = createProminenceMaterial(i / count, 0.15 + ((i + strand) % 3) * 0.28)
        const baseIntensity = (strand === 1 ? 1.1 : 0.6) * (1 + (i % 3) * 0.18)
        material.uniforms.uIntensity.value = baseIntensity
        list.push({
          line: new THREE.Mesh(geometry, material),
          material,
          speed: 0.03 + (i % 3) * 0.012,
          baseIntensity,
        })
      }
    }
    return list
  }, [count])

  useEffect(() => () => items.forEach(item => {item.line.geometry.dispose();item.material.dispose()}), [items])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    /**
     * 太阳在屏幕上变小的时候，逐条日珥会退化成亚像素亮线——那是全览时
     * "太阳闪烁"的主要来源之一（v8 §19）。这里按太阳的屏幕半径把它们淡出，
     * 而不是调整曝光：远处的太阳本来就该只是一个亮点。
     */
    const ortho = state.camera as THREE.OrthographicCamera
    const viewHeight = (ortho.top - ortho.bottom) / (ortho.zoom || 1)
    const sunScreenRadius = (SUN_RADIUS / Math.max(viewHeight, 1e-3)) * state.size.height
    const detailFade = THREE.MathUtils.smoothstep(sunScreenRadius, 7, 26)
    items.forEach((item) => {
      item.material.uniforms.uTime.value = t
      // 远景淡出，避免亚像素亮线闪动（v8 §19 / §22）
      item.material.uniforms.uIntensity.value = item.baseIntensity * detailFade * intensity
    })
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.005
      groupRef.current.rotation.x = Math.sin(t * 0.02) * 0.06
      groupRef.current.visible = detailFade > 0.02
    }
  })

  return (
    <group ref={groupRef} scale={1.012}>
      {items.map((item, index) => (
        <primitive key={index} object={item.line} />
      ))}
    </group>
  )
}

/**
 * 太阳活动层：只在"太阳风暴 / 空间天气"专题里出现（方案书 §2.4）。
 * 常态主界面不再有持续喷射的粒子——那是特效，不是物理。
 */
function SolarActivity({ count = 260 }: { count?: number }) {
  const groupRef = useRef<THREE.Points>(null)
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffd8a8',
        size: 0.16,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    let seed = 20260921
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1
      const phi = rand() * Math.PI * 2
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      const r = SUN_RADIUS * (1.18 + rand() * 1.5)
      positions[i * 3 + 0] = s * Math.cos(phi) * r
      positions[i * 3 + 1] = u * r
      positions[i * 3 + 2] = s * Math.sin(phi) * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [count])

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.012
  })

  return <points ref={groupRef} geometry={geometry} material={material} frustumCulled={false} />
}

/** 光晕 + 光芒：屏幕上永远朝向镜头，且会被行星遮挡 */
function SunGlow({halpha}:{halpha:boolean}) {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const tightRef = useRef<THREE.Sprite>(null)
  const wideRef = useRef<THREE.Sprite>(null)
  const tightTexture = useMemo(
    // 暖白的光晕：色球层的橙只留在球体临边那一圈，不扩散到整片光晕（v6 §1）
    () => createGlowTexture('rgba(255,252,246,0.98)', 'rgba(255,228,188,0.5)'),
    []
  )
  const wideTexture = useMemo(
    () => createGlowTexture('rgba(255,232,204,0.32)', 'rgba(255,210,170,0.14)'),
    []
  )
  useEffect(()=>()=>{tightTexture.dispose();wideTexture.dispose()},[tightTexture,wideTexture])

  useFrame((state) => {
    // 光晕放在太阳"里面"：太阳本体（不透明的光球层）会挡住光晕的中央部分，
    // 只留下贴着临边的一圈辉光——这才是日冕的样子。行星转到前面时同样会挡住它。
    const base = new THREE.Vector3(0, 0, 0)
    // 光晕的大小跟着可见高度走：像真实的镜头光斑，而不是随距离缩放的贴图
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    // v8 §19：缩到全览时不能让光晕跟着视高无限长大（那会在小日面周围糊出一大片）
    const scale = THREE.MathUtils.clamp(viewHeight * 0.34, SUN_RADIUS * 3.2, SUN_RADIUS * 14)

    if (tightRef.current) {
      tightRef.current.position.copy(base)
      tightRef.current.scale.setScalar(halpha ? SUN_RADIUS*2.6 : scale * 0.58)
    }
    if (wideRef.current) {
      wideRef.current.position.copy(base)
      wideRef.current.scale.setScalar(halpha ? SUN_RADIUS*4.0 : scale * 1.0)
    }
  })

  return (
    <group>
      <sprite ref={wideRef} renderOrder={4}>
        <spriteMaterial
          map={wideTexture}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          color={halpha?'#ffcd86':'#ffffff'}
          opacity={halpha?0.12:0.10}
        />
      </sprite>
      <sprite ref={tightRef} renderOrder={5}>
        <spriteMaterial
          map={tightTexture}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          color={halpha?'#ffe1ae':'#ffffff'}
          opacity={halpha?0.26:0.30}
        />
      </sprite>
    </group>
  )
}

/**
 * 日冕的**体积积分**（v9 §2）。
 *
 * 旧版把日冕画在一张平面上，问题全部来自这个前提：镜头一转，平面侧过来就变成
 * "薄薄一片光"；平面的边界和图案的角向扰动会在屏幕上留下硬边与拐弯的光条。
 * 那是"一张画"的样子，不是光的样子。
 *
 * 现在按体积算：朝向相机的贴片只是一个**积分窗口**，逐像素求的是视线穿过日冕的
 * 累积亮度。对幂律密度 ρ ∝ r^-p，沿视线的积分只取决于视线的最近距离 b（冲击参数）：
 * I(b) ∝ b^-(p-1)。于是画面里天然只会出现"从日心放射出去的直线"——
 * 没有平面边界，也不会在侧视时塌成一片。
 *
 * 方位结构取自最近点所在的**三维方向**（太阳赤道坐标下的经度 / 纬度）：
 * 赤道附近拉出长流带（头盔流），极区是短羽流，内冕始终是一圈平滑亮环。
 * 亮带是固定经度上的等值带，投影出来是直线；镜头绕着走时它们跟着世界转，
 * 不贴着屏幕——和日全食照片里的日冕是同一种读法。
 */
const CORONA_VERTEX = `varying vec3 vWorld;
  void main(){vec4 wp=modelMatrix*vec4(position,1.);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`

const CORONA_FRAGMENT = `precision highp float;
  varying vec3 vWorld;
  uniform vec3 uCameraPos;uniform vec3 uViewDir;
  uniform float uPerspective;uniform float uSunRadius;
  uniform float uTime;uniform float uDetail;uniform float uHalpha;
  void main(){
    // 视线：正交相机是一束平行光，透视相机从相机位置出发
    vec3 d=uViewDir;vec3 p=vWorld;
    if(uPerspective>.5){d=normalize(vWorld-uCameraPos);p=uCameraPos;}
    vec3 perp=p-d*dot(p,d);
    float b=max(length(perp),1e-4);
    vec3 n=perp/b;                        // 视线最近点的方向（世界坐标）
    float rn=b/uSunRadius;                // 以太阳半径为单位
    if(rn<1.0)discard;                    // 日面之内：光球层自己就是光源
    // 太阳赤道坐标（自转轴倾角 7.25°，这里按世界 Y 处理）
    float el=asin(clamp(n.y,-1.0,1.0));
    float az=atan(n.z,n.x)+uTime*.010;    // 只做整体相位漂移，不弯曲射线
    float s1=.5+.5*sin(az*7.0+.7);
    float s2=.5+.5*sin(az*13.0-1.3);
    float s3=.5+.5*sin(az*23.0+2.1);
    float s4=.5+.5*sin(az*41.0-2.6);
    float s5=.5+.5*sin(az*57.0+1.9);
    /**
     * 赤道流带（用户 2026-09-25："竖光割裂"）。
     *
     * 旧版另有一项"极区羽流"（|el| ≈ 72° 处加权）。方位角条纹在极区会收敛，
     * 于是那一条被渲染成几道**平行、硬边的竖直光刃**，看着像被切开的光板。
     * 现在去掉羽流，只留赤道流带，并把纬度范围放宽到 ±60°：
     * 流线因此在一个连续的扇面里分布，而不是在极点上挤成一束。
     */
    float belt=exp(-pow(el*0.95,2.0));
    float breathe=.9+.1*sin(uTime*.07+az*2.0);         // 缓慢起伏，幅度很小
    /**
     * 高次幂 = 更细更亮的流带核心；四组不相关的频率叠出不规则的间距与粗细。
     * taper 让流带**越远越细**：贴着临边是宽的根部，往外收成细羽——
     * 真实日冕的头盔流就是这个形状，等宽的"光条"一眼就能看出是画出来的。
     */
    // 收细的幅度也收一档：旧版指数最高到 27，边缘会硬得发"切"
    float taper=1.0+1.1*smoothstep(1.0,2.6,rn);
    float stripes=.40*pow(s1,3.0*taper)+.26*pow(s2,4.0*taper)+.16*pow(s3,6.0*taper)
                 +.14*pow(s1*s2,4.0*taper)+.12*pow(s4,9.0*taper)*uDetail
                 +.10*pow(s5,12.0*taper)*uDetail;
    /**
     * 赤道流带上始终留一点底光（.32）：流带的存在不取决于镜头正好落在哪个相位，
     * 否则某个角度会突然"一条光都没有"。底光上的结构性亮带再叠出长短不一的翼。
     */
    float streamer=belt*(.32+.68*stripes)*breathe;
    /**
     * 内冕（紧、亮、随距离陡降） + 外冕底光 + 流带。
     * 内冕必须收得快：面积大、亮度又不低的平滑项会在整屏糊出一层奶白，
     * 那不是日冕，是雾。真正的结构由细而高对比的流带承担。
     */
    float inner=.70*pow(rn,-6.5);
    float outer=.110*pow(rn,-1.9);
    float gain=uDetail*smoothstep(1.02,1.4,rn);
    float density=inner*(1.0+.25*streamer*gain)+outer*(.22+3.6*streamer*gain);
    float fade=exp(-pow(rn/4.2,2.6));                  // 平滑收边：没有几何边界可看
    vec3 nearColor=mix(vec3(1.0,.95,.87),vec3(1.0,.80,.53),uHalpha);
    vec3 color=mix(nearColor,vec3(.94,.95,1.0),smoothstep(1.0,2.4,rn));
    gl_FragColor=vec4(color,density*fade);
  }`

/**
 * 日冕的体积层。
 *
 * 贴片始终正对镜头，但它只是**积分窗口**：画面内容是逐像素对三维日冕积分的结果，
 * 而不是贴上去的一张图。所以镜头绕行时，看到的是同一团等离子体被从不同方向看过去——
 * 赤道流带会转过日面、极区羽流换位，但永远不会塌成薄片，也不会跟着屏幕不动。
 * 细结构只在太阳足够大时出现（uDetail），远景留平滑的内冕与底光。
 */
function CoronaVolume() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCameraPos: { value: new THREE.Vector3() },
          uViewDir: { value: new THREE.Vector3(0, 0, -1) },
          uPerspective: { value: 0 },
          uSunRadius: { value: SUN_RADIUS },
          uTime: { value: 0 },
          uDetail: { value: 1 },
          uHalpha: { value: 1 },
        },
        vertexShader: CORONA_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    []
  )
  useEffect(() => () => material.dispose(), [material])
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera
    // 积分窗口正对镜头：这是体积渲染的标准做法，内容仍然由世界坐标决定
    if (mesh.current) mesh.current.quaternion.copy(camera.quaternion)
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    const radiusPx = (SUN_RADIUS / Math.max(viewHeight, 0.001)) * state.size.height
    material.uniforms.uTime.value = reducedMotion ? 0 : state.clock.elapsedTime
    material.uniforms.uDetail.value = THREE.MathUtils.smoothstep(radiusPx, 6, 46)
    material.uniforms.uHalpha.value = useExperience.getState().sunSpectrum === 'halpha' ? 1 : 0
    camera.getWorldPosition(material.uniforms.uCameraPos.value)
    camera.getWorldDirection(material.uniforms.uViewDir.value)
    material.uniforms.uPerspective.value =
      (camera as unknown as { isPerspectiveCamera?: boolean }).isPerspectiveCamera ? 1 : 0
  })

  return (
    <mesh ref={mesh} material={material} renderOrder={3}>
      <planeGeometry args={[SUN_RADIUS * 10, SUN_RADIUS * 10]} />
    </mesh>
  )
}

/** 图谱的原点。太阳是唯一光源，其他天体的光照方向都由它推出。 */
export function Sun() {
  const spectrum = useExperience(state=>state.sunSpectrum)
  const isHalpha = spectrum === 'halpha'
  const context = useExperience(state=>state.context)
  const surface = useMemo(() => createSunMaterial(), [])
  const chromosphere = useMemo(() => createChromosphereMaterial(), [])
  const corona = useMemo(() => createCoronaMaterial(), [])
  // 真实日面：NASA SDO HMI 白光照片。没有它才退回程序化米粒组织。
  const photosphere = useTexture('planets/sun_photosphere-2k.jpg')
  const halpha = useTexture('planets/sun_halpha-2k.jpg')
  // 等距圆柱投影的日面贴图：SDO 的全圆面照片直接贴球会"少一大块"，
  // 必须用 2:1 的柱面图（Solar System Scope，CC BY 4.0）
  const sunMap = useTexture('planets/sun_equirect-2k.jpg')
  const spaceWeather = useAtlasStore((state) => state.spaceWeatherOpen)
  const focusKind = useAtlasStore((state) => state.focusKind)
  const focusId = useAtlasStore((state) => state.focusId)
  // 主界面只留细微的日冕结构；聚焦太阳或打开空间天气时才让日珥 / 活动区明显起来
  const sunFocused = focusKind === 'PLANET' && focusId === 'sun'
  const isolatedBody = !context && ((focusKind === 'PLANET' && focusId !== 'sun') || focusKind === 'MOON')
  const activity = isHalpha ? (sunFocused || spaceWeather ? 2.6 : .75) : (sunFocused || spaceWeather ? 3.6 : 1)
  /**
   * V1.1 §12 第 8 步：日冕细节是阶梯里的独立一级。
   * 桌面恒为 1（与 V1 完全一致）；降级时先收日冕流线，最后才碰日面。
   */
  const quality = useQualitySettings()

  useEffect(() => {
    /**
     * v8.1：贴图优先用**光球层等距圆柱投影**（sun_photosphere-2k.jpg）。
     *
     * 旧版优先用 sun_equirect-2k.jpg —— 那是一张被横向拉伸糊化的 EUV 图，
     * 贴到球面上就是一片模糊的橙色涂抹，既没有米粒组织也没有黑子，
     * 也读不出球体感。换成光球层贴图之后，日面才有真实结构；
     * 色温交给材质里的 uColorA/B/C 与日冕层去表达。
     */
    surface.setMap(photosphere ?? sunMap)
    surface.material.uniforms.uHalphaMap.value = halpha
  }, [photosphere, sunMap, surface, halpha])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    surface.material.uniforms.uTime.value = t
    surface.material.uniforms.uHalpha.value = halpha && useExperience.getState().sunSpectrum === 'halpha' ? 1 : 0
    chromosphere.uniforms.uTime.value = t
    corona.uniforms.uTime.value = t
    /**
     * 日面细节随屏幕尺寸淡出（v8 §19）。
     *
     * 缩到全览时太阳的可见半径只有 8–9px，色球层的噪声、日冕的流线、
     * 逐条日珥都会变成亚像素亮线，逐帧闪动——这就是"全览时太阳闪烁"。
     * 物理上也说得通：远处的太阳本来就只是一个亮点。
     */
    const ortho = state.camera as THREE.OrthographicCamera
    const viewHeight = (ortho.top - ortho.bottom) / (ortho.zoom || 1)
    const sunScreenRadius = (SUN_RADIUS / Math.max(viewHeight, 1e-3)) * state.size.height
    const detailFade =
      THREE.MathUtils.smoothstep(sunScreenRadius, 7, 26) * quality.coronaDetail
    chromosphere.uniforms.uIntensity.value =
      (0.5 + 0.5 * (activity / 3.6)) * detailFade
    corona.uniforms.uIntensity.value = detailFade * 0.22
    surface.material.uniforms.uDetail.value = THREE.MathUtils.smoothstep(sunScreenRadius, 8, 65)
    corona.uniforms.uHalpha.value = isHalpha ? 1 : 0
  })

  return (
    <group name="sun" visible={!isolatedBody}>
      <mesh name="sun-core">
        <sphereGeometry args={[SUN_RADIUS, 96, 64]} />
        <primitive object={surface.material} attach="material" />
      </mesh>
      <mesh scale={1.015}>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
        <primitive object={chromosphere} attach="material" />
      </mesh>
      <mesh scale={isHalpha?1.22:1.55}>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
        <primitive object={corona} attach="material" />
      </mesh>
      <Prominences intensity={activity} />
      {spaceWeather ? <SolarActivity /> : null}
      <CoronaVolume />

    </group>
  )
}
