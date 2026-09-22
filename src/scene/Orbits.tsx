import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PLANETS } from '../data/planets'
import {
  BELT_RANGE,
  KUIPER_RANGE,
  OORT_RANGE,
  computeLayout,
  orbitSample,
} from '../utils/layout'
import { measureLineMaterial, orbitLineMaterial } from './lineMaterials'
import { createOrbitMaterial } from './orbitLine'
import { worldNow } from '../utils/clock'
import { useAtlasStore } from '../state/atlasStore'
import { mapAuToVisual } from '../astronomy/visualScale'
import { focusBackgroundDim, orbitRevealFactor, revealRamp, sceneReveal } from '../utils/reveal'

/**
 * 行星轨道 + 深空轨迹 + 小行星带 / 柯伊伯带 / 奥尔特云（方案书 §14）。
 *
 * 三圈结构都有各自的"可读性"设计：
 *   小行星带 —— 密集粒子 + 中间有明显稀疏区 + 三道淡淡的引导弧
 *   柯伊伯带 —— 海王星外侧的宽阔低密度盘
 *   奥尔特云 —— 巨大稀疏球壳，只有在最远的尺度上才逐渐浮现
 */

const beltGuideMaterial = createOrbitMaterial('#93877a', 0.2)
const kuiperGuideMaterial = createOrbitMaterial('#6c7683', 0.26)
const oortGuideMaterial = createOrbitMaterial('#5d6a7a', 0.16)

/**
 * 小行星带的视觉权重（v7.1 §8）。
 *
 * 它**永远不该和当前主角抢画面**：默认只是背景结构，用户主动聚焦它时才提亮，
 * 聚焦行星 / 卫星 / 航天器时自动退到更后面。
 */
function asteroidVisualWeight(focusKind: string, focusId: string | null): number {
  if (focusKind === 'REGION' && focusId === 'asteroid') return 0.65
  if (focusKind === 'PLANET') return 0.1
  if (focusKind === 'MOON' || focusKind === 'OBJECT' || focusKind === 'COMET') return 0.05
  return 0.15
}

/**
 * 粒子尺寸（v7.1 §3）。
 *
 * **指数必须是负的**。旧版是 `viewHeight * 0.016`，等于"越缩小越大"——
 * 于是总览时小行星带变成一片 3.4px 的大颗粒，抢过行星和标签。
 * 现在是 `base * (h / REF)^-0.18`：
 *   远景 ≈ 0.8–1.3px（更小、更暗）
 *   近景 ≈ 1.6–2.2px（略大、可读）
 * 想让人看见结构就加**密度**，不是加**尺寸**（§7）。
 */
function beltParticleSize(viewHeight: number, base: number): number {
  const REFERENCE = 240
  const size = base * Math.pow(Math.max(viewHeight, 1) / REFERENCE, -0.18)
  return THREE.MathUtils.clamp(size, 0.8, 2.2)
}

/**
 * 小行星颗粒（v7.2 §6）：**越近越丰富**。
 *
 * 每颗粒子带一个 `aReveal` 阈值（0…1）和自己的尺寸系数，着色器里只做一件事：
 * 当前细节等级 `uDetail` 超过自己的阈值就出现，并在 0.1 的区间内淡入。
 * 于是镜头推近时不是"整批切进来"，而是一颗一颗逐渐浮现——
 * 远景是一层极淡的尘埃，近景是一地能数清的小行星。
 */
const BELT_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aReveal;
  attribute vec3 aTint;
  uniform float uPixelRatio;
  uniform float uBaseSize;
  uniform float uDetail;
  uniform float uOpacity;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float appear = smoothstep(aReveal - 0.1, aReveal + 0.02, uDetail);
    vAlpha = appear * uOpacity;
    vTint = aTint;
    gl_PointSize = max(0.9, uBaseSize * aSize) * uPixelRatio;
  }
`

const BELT_FRAG = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.004) discard;
    gl_FragColor = vec4(vTint, vAlpha);
  }
`

function createBeltMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BELT_VERT,
    fragmentShader: BELT_FRAG,
    uniforms: {
      uPixelRatio: { value: 1 },
      uBaseSize: { value: 1.45 },
      uDetail: { value: 1 },
      uOpacity: { value: 0.17 },
    },
    transparent: true,
    depthWrite: false,
  })
}

/**
 * 给一条粒子带补上"每颗粒子自己的尺寸 / 出现阈值 / 色调"（v8 §15）。
 * 用固定种子生成，保证每次打开都是同一批粒子。
 */
function applyParticleAttributes(
  geometry: THREE.BufferGeometry,
  tint: [number, number, number],
  seed: number
): void {
  const count = geometry.getAttribute('position').count
  const sizes = new Float32Array(count)
  const reveals = new Float32Array(count)
  const tints = new Float32Array(count * 3)
  let state = seed
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  for (let i = 0; i < count; i++) {
    sizes[i] = 0.72 + rand() * 0.62
    // 出现阈值：细节等级越过它才浮现，于是"拉近 = 逐颗变多"
    reveals[i] = Math.pow(rand(), 1.35)
    const warm = rand()
    tints[i * 3 + 0] = tint[0]! * (0.86 + warm * 0.28)
    tints[i * 3 + 1] = tint[1]! * (0.86 + warm * 0.24)
    tints[i * 3 + 2] = tint[2]! * (0.88 + (1 - warm) * 0.24)
  }
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aReveal', new THREE.BufferAttribute(reveals, 1))
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
}

/**
 * v8 §17 / §18：柯伊伯带与奥尔特云**不再有球壳网格**。
 *
 * 用户明确要求"粒子的散布呈菲涅尔球状"，也就是外圈密、内圈疏的粒子密度结构，
 * 而不是往场景里扔一个半透明球体。所以这两层现在都是粒子场
 * （见 layout 的 seededShell bias，以及这里的 applyParticleAttributes），
 * 复用同一套带出现阈值的粒子材质。
 */

function ringPoints(radius: number, squash: number, segments = 220): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius * squash))
  }
  return points
}

/**
 * 带体：小行星带的 L0 层（v7.1 §4 / §5）。
 *
 * 远景不该让用户先看到"一堆亮点"，而该先读到
 * `火星 ──[ 一条淡带 ]── 木星`。所以补一层极淡的环带：
 *
 *   · 边缘羽化，跨带身的密度起伏（程序噪声，不是贴图）
 *   · 3 处 Kirkwood 空隙：2.50 / 2.82 / 3.27 AU 的轨道共振把小行星清空了，
 *     这是真实天文结构，不是装饰噪声
 *   · 整层不发光、不参与 bloom，只是"更深的灰"
 */
const BELT_BAND_WIDTH = BELT_RANGE.outer - BELT_RANGE.inner
const beltBandMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uOpacity: { value: 0.09 },
    uColor: { value: new THREE.Color('#8d8371') },
    uInner: { value: BELT_RANGE.inner },
    uOuter: { value: BELT_RANGE.outer },
    uGapWidth: { value: BELT_BAND_WIDTH * 0.05 },
    uGapA: { value: mapAuToVisual(2.5) },
    uGapB: { value: mapAuToVisual(2.82) },
    uGapC: { value: mapAuToVisual(3.27) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vLocal;
    void main() {
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uOpacity;
    uniform vec3 uColor;
    uniform float uInner;
    uniform float uOuter;
    uniform float uGapWidth;
    uniform float uGapA;
    uniform float uGapB;
    uniform float uGapC;
    varying vec2 vLocal;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    /** 共振空隙：以某个视觉半径为中心的窄凹陷 */
    float gap(float radius, float center) {
      return clamp(abs(radius - center) / uGapWidth, 0.06, 1.0);
    }

    void main() {
      float radius = length(vLocal);
      if (radius < uInner || radius > uOuter) discard;
      float t = (radius - uInner) / max(uOuter - uInner, 0.0001);
      float angle = atan(vLocal.y, vLocal.x);
      float edge = smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.72, 1.0, t));
      float density =
        noise(vec2(angle * 2.4, t * 3.2)) * 0.65 + noise(vec2(angle * 7.5, t * 9.0)) * 0.35;
      float gaps = gap(radius, uGapA) * gap(radius, uGapB) * gap(radius, uGapC);
      float alpha = edge * (0.3 + 0.7 * density) * gaps * uOpacity;
      if (alpha <= 0.002) discard;
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
})

export function Orbits() {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const gl = useThree((state) => state.gl)
  const oortRef = useRef<THREE.Points>(null)
  const kuiperRef = useRef<THREE.Points>(null)
  const beltRef = useRef<THREE.Points>(null)
  const beltBandRef = useRef<THREE.Mesh>(null)

  const layout = useMemo(() => computeLayout(0), [])

  const orbitGroup = useMemo(() => {
    const group = new THREE.Group()
    for (const planet of PLANETS) {
      const geometry = new THREE.BufferGeometry().setFromPoints(orbitSample(planet, 220))
      group.add(new THREE.Line(geometry, orbitLineMaterial))
    }
    return group
  }, [])

  const trajectoryGroup = useMemo(() => {
    const group = new THREE.Group()
    for (const anchor of layout.objects) {
      if (!anchor.trajectory) continue
      const geometry = new THREE.BufferGeometry().setFromPoints(anchor.trajectory)
      group.add(new THREE.Line(geometry, measureLineMaterial))
    }
    return group
  }, [layout])

  /** 三种粒子带 + 各自的引导弧 */
  const beltGroup = useMemo(() => {
    const group = new THREE.Group()

    const asteroid = new THREE.BufferGeometry()
    asteroid.setAttribute('position', new THREE.BufferAttribute(layout.asteroidBelt, 3))
    /**
     * 每颗粒子自己的尺寸系数、色调与"出现阈值"（v7.2 §6）。
     * 用固定种子生成，保证每次打开看到的是同一批小行星——
     * 视觉可以随机，但不能每帧跳。
     */
    const beltCount = layout.asteroidBelt.length / 3
    const beltSizes = new Float32Array(beltCount)
    const beltReveals = new Float32Array(beltCount)
    const beltTints = new Float32Array(beltCount * 3)
    let beltSeed = 90210
    const beltRand = () => {
      beltSeed = (beltSeed * 1664525 + 1013904223) % 4294967296
      return beltSeed / 4294967296
    }
    for (let i = 0; i < beltCount; i++) {
      beltSizes[i] = 0.72 + beltRand() * 0.62
      // 少数粒子要到很近才出现：远景是一片尘，近景是一颗颗清楚的小行星
      beltReveals[i] = Math.pow(beltRand(), 1.35)
      const warm = beltRand()
      beltTints[i * 3 + 0] = 0.56 + warm * 0.16
      beltTints[i * 3 + 1] = 0.54 + warm * 0.12
      beltTints[i * 3 + 2] = 0.5 + (1 - warm) * 0.1
    }
    asteroid.setAttribute('aSize', new THREE.BufferAttribute(beltSizes, 1))
    asteroid.setAttribute('aReveal', new THREE.BufferAttribute(beltReveals, 1))
    asteroid.setAttribute('aTint', new THREE.BufferAttribute(beltTints, 3))
    const asteroidPoints = new THREE.Points(asteroid, createBeltMaterial())
    beltRef.current = asteroidPoints
    group.add(asteroidPoints)

    // L0 带体：先读成"一条带"，再读成"很多点"（v7.1 §4）
    const band = new THREE.Mesh(
      new THREE.RingGeometry(BELT_RANGE.inner, BELT_RANGE.outer, 256, 1),
      beltBandMaterial
    )
    band.rotation.x = -Math.PI / 2
    band.renderOrder = -1
    beltBandRef.current = band
    group.add(band)

    /**
     * 柯伊伯带（v8 §17）。
     *
     * 它是一条**粒子形成的带**：外缘稍密、边缘自然消散。
     * 不再用 MeshPhysicalMaterial / 球壳去"罩"一层。
     */
    const kuiper = new THREE.BufferGeometry()
    kuiper.setAttribute('position', new THREE.BufferAttribute(layout.kuiperBelt, 3))
    applyParticleAttributes(kuiper, [0.62, 0.72, 0.86], 31337)
    const kuiperPoints = new THREE.Points(kuiper, createBeltMaterial())
    kuiperPoints.visible = false
    group.add(kuiperPoints)
    kuiperRef.current = kuiperPoints

    /**
     * 奥尔特云（v8 §18）：**粒子密度壳**，不是菲涅尔球。
     *
     * 分布由 layout 的 seededShell(…, bias = 0.35) 生成：半径幂次偏低，
     * 于是外圈粒子明显多于内圈——"中心稀、外圈密"本身就是包裹感。
     * 这里再给每颗粒子一个出现阈值，缩到最远时先浮现外壳轮廓，
     * 继续推远/拉近时逐颗补满。
     */
    const oort = new THREE.BufferGeometry()
    oort.setAttribute('position', new THREE.BufferAttribute(layout.oortCloud, 3))
    applyParticleAttributes(oort, [0.58, 0.68, 0.84], 90210)
    const oortPoints = new THREE.Points(oort, createBeltMaterial())
    oortPoints.visible = false
    group.add(oortPoints)
    oortRef.current = oortPoints

    // 引导弧：一条均匀白环读不出结构，几道淡淡的弧就知道"这里有一整圈"
    const beltGuides = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const radius = BELT_RANGE.inner + ((BELT_RANGE.outer - BELT_RANGE.inner) * i) / 3
      beltGuides.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringPoints(radius, 0.995)),
          beltGuideMaterial
        )
      )
    }
    group.add(beltGuides)

    const kuiperGuides = new THREE.Group()
    for (const radius of [KUIPER_RANGE.inner, (KUIPER_RANGE.inner + KUIPER_RANGE.outer) / 2, KUIPER_RANGE.outer]) {
      kuiperGuides.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringPoints(radius, 0.995)),
          kuiperGuideMaterial
        )
      )
    }
    group.add(kuiperGuides)

    const oortGuides = new THREE.Group()
    for (const radius of [OORT_RANGE.inner, OORT_RANGE.outer]) {
      oortGuides.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringPoints(radius, 0.99)),
          oortGuideMaterial
        )
      )
    }
    group.add(oortGuides)
    oortGuides.name = 'oort-guides'

    return group
  }, [layout])

  useFrame((state) => {
    const t = worldNow()
    const { hidePlanetOrbits, hideAllOrbits } = useAtlasStore.getState()
    // v5 §21：视图菜单的三个开关必须真的改变渲染对象，而不是只改菜单状态
    orbitGroup.visible = !hidePlanetOrbits && !hideAllOrbits
    beltGroup.visible = !hideAllOrbits
    trajectoryGroup.visible = !hideAllOrbits
    if (hideAllOrbits) return

    beltGuideMaterial.uniforms.uTime.value = t
    kuiperGuideMaterial.uniforms.uTime.value = t
    oortGuideMaterial.uniforms.uTime.value = t

    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)

    /**
     * 开场 → 图谱的揭示（v7.2）。
     *
     * 主页背景就是这一套轨道：进场时它们**在原地变亮**，
     * 而不是先消失再出现。深度轨迹线同一时刻一起亮起来。
     */
    const revealF = orbitRevealFactor()
    /**
     * v8 §26：聚焦行星 / 月球时，其它轨道退到 0.08（但留 0.25 的地板，
     * 否则画面会失去"它在哪条轨道上"的空间关系）。
     */
    const dims = focusBackgroundDim(useAtlasStore.getState().focusKind)
    const orbitDim = Math.max(dims.orbits, 0.25)
    orbitLineMaterial.opacity = 0.16 * revealF * orbitDim
    measureLineMaterial.opacity = 0.22 * revealF * orbitDim

    /**
     * 小行星带（v7.2 §6）。
     *
     * 三个量各管一件事，互不顶替：
     *   weight  —— 谁在当主角：聚焦行星 / 卫星时它自动退到背景
     *   size    —— 远景更小、近景略大（**和旧版正好相反**）
     *   detail  —— **越近越丰富**：每颗粒子有自己的出现阈值，
     *             推近时一颗颗浮现，远景只留一层薄尘
     */
    const { focusKind, focusId } = useAtlasStore.getState()
    const selectedRegion = focusKind === 'REGION' ? focusId : null
    /**
     * 开场时小行星带压低（v7.2）。
     *
     * 主页是内太阳系的近景，1.82 倍拉近之后这条带会横穿标题。
     * 让它在开场只留三分之一、随着镜头拉远再升到正常权重，
     * 正好也是"进入图谱"这个动作的一部分。
     */
    const revealDim = 0.34 + 0.66 * revealRamp(0.15, 0.9)
    const weight = (asteroidVisualWeight(focusKind, focusId) / 0.15) * revealDim
    const asteroidPoints = beltRef.current
    if (asteroidPoints) {
      const material = asteroidPoints.material as THREE.ShaderMaterial
      // 细节等级：缩到最远 ≈0.05（只有最早出现的那批），推到最近 ≈1（全开）
      const detail = THREE.MathUtils.clamp((300 - viewHeight) / (300 - 26), 0, 1)
      material.uniforms.uDetail.value = detail
      material.uniforms.uBaseSize.value = beltParticleSize(viewHeight, 1.4)
      material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
      material.uniforms.uOpacity.value = THREE.MathUtils.clamp(
        0.15 * weight * (0.72 + 0.28 * detail),
        0.05,
        0.5
      )
    }
    if (beltBandRef.current) {
      beltBandMaterial.uniforms.uOpacity.value = THREE.MathUtils.clamp(0.08 * weight, 0.025, 0.12)
    }
    beltGuideMaterial.uniforms.uOpacity.value = selectedRegion === 'asteroid' ? 0.4 : 0.15

    const oortFade = THREE.MathUtils.clamp((viewHeight - 130) / 120, 0, 1)
    const oort = oortRef.current
    if (oort) {
      /**
       * 奥尔特云 = 粒子密度壳（v8 §18）。
       * 外圈粒子多、内圈少，靠密度形成"包住太阳系"的观感；
       * uDetail 由 oortFade 驱动，缩到最远时先浮现外壳、再逐颗补满。
       */
      const material = oort.material as THREE.ShaderMaterial
      const focusBoost = selectedRegion === 'oort' ? 1 : 0.8
      material.uniforms.uBaseSize.value = beltParticleSize(viewHeight, 1.35)
      material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
      material.uniforms.uDetail.value = THREE.MathUtils.clamp(0.3 + oortFade * 0.7, 0, 1)
      material.uniforms.uOpacity.value = oortFade * 0.34 * focusBoost * revealDim
      oort.visible = oortFade > 0.01 || selectedRegion === 'oort'
    }
    const guides = beltGroup.getObjectByName('oort-guides')
    if (guides) {
      guides.visible = oortFade > 0.05 || selectedRegion === 'oort'
      oortGuideMaterial.uniforms.uOpacity.value =
        Math.max(oortFade, selectedRegion === 'oort' ? 0.55 : 0) * 0.22
    }
    const kuiper = kuiperRef.current
    if (kuiper) {
      /**
       * 柯伊伯带同样是粒子场（v8 §17）：远景更暗、更小，
       * 但粒子数够多，缩到最远时读成"一圈很淡的盘"，不抢前景。
       */
      const material = kuiper.material as THREE.ShaderMaterial
      material.uniforms.uBaseSize.value = beltParticleSize(viewHeight, 1.4)
      material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
      material.uniforms.uDetail.value = THREE.MathUtils.clamp((viewHeight - 80) / 240, 0, 1)
      material.uniforms.uOpacity.value =
        (0.09 + THREE.MathUtils.clamp((viewHeight - 120) / 200, 0, 1) * 0.1) *
        (selectedRegion === 'kuiper' ? 1.8 : 1) *
        revealDim
      kuiper.visible = material.uniforms.uOpacity.value > 0.004 || selectedRegion === 'kuiper'
    }
  })

  return (
    <group name="orbits">
      <primitive object={orbitGroup} />
      <primitive object={beltGroup} />
      <primitive object={trajectoryGroup} />
    </group>
  )
}
