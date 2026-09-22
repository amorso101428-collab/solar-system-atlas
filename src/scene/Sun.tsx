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
  const lat = (rand(0.19) - 0.5) * 1.75 + strand * 0.02
  const lon = rand(0.53) * Math.PI * 2
  const normal = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  ).normalize()
  // 竖直切向：球面法线去掉世界上方向分量，就是"往上"的切向
  const tangent = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y)
  if (tangent.lengthSq() < 1e-4) tangent.set(0, 0, 1)
  tangent.normalize()

  const spread = 0.06 + rand(0.71) * 0.09
  /**
   * 日珥只露出一点点（v8 §22）。
   *
   * 旧版弧顶能到 0.52 个太阳半径、18 组，全览时是一圈毛刺，
   * 缩到最远还会因为亚像素几何而闪烁。现在只留 3 个活动区，
   * 高度 0.03–0.075 个太阳半径 —— 贴着临边露出一点结构，仅此而已。
   */
  // v8.1：0.03–0.075 太小了（推近也几乎看不见），改成 0.07–0.17 个太阳半径：
  // 仍然只露一点点，但在"太阳详情"里能看清弧线的形状。
  const height = SUN_RADIUS * (0.07 + rand(2.31) * 0.1) * (1 + strand * 0.12)
  const base = SUN_RADIUS * 0.99
  const foot = (sign: number) =>
    new THREE.Vector3()
      .addScaledVector(normal, Math.cos(spread) * base)
      .addScaledVector(tangent, Math.sin(spread) * base * sign)
  const top = new THREE.Vector3().addScaledVector(normal, base + height)
  return new THREE.CatmullRomCurve3([foot(1), top, foot(-1)], false, 'catmullrom', 0.5)
}

function Prominences({ count = 3, intensity = 1 }: { count?: number; intensity?: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)

  const items = useMemo(() => {
    const list: Array<{
      line: THREE.Line
      material: THREE.ShaderMaterial
      speed: number
      baseIntensity: number
    }> = []
    for (let i = 0; i < count; i++) {
      // 3 股细丝 = 1 颗日珥：中股最亮，两股稍暗稍低，叠出"等离子体"的厚度
      for (let strand = 0; strand < 3; strand++) {
        const curve = prominenceCurve(i, strand)
        const points = curve.getPoints(48)
        const positions = new Float32Array(points.length * 3)
        const progress = new Float32Array(points.length)
        points.forEach((point, index) => {
          positions[index * 3 + 0] = point.x
          positions[index * 3 + 1] = point.y
          positions[index * 3 + 2] = point.z
          progress[index] = index / (points.length - 1)
        })
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))
        const material = createProminenceMaterial(i / count, 0.15 + ((i + strand) % 3) * 0.28)
        const baseIntensity = (strand === 1 ? 1.1 : 0.6) * (1 + (i % 3) * 0.18) * intensity
        material.uniforms.uIntensity.value = baseIntensity
        list.push({
          line: new THREE.Line(geometry, material),
          material,
          speed: 0.03 + (i % 3) * 0.012,
          baseIntensity,
        })
      }
    }
    return list
  }, [count])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    /**
     * 太阳在屏幕上变小的时候，逐条日珥会退化成亚像素亮线——那是全览时
     * "太阳闪烁"的主要来源之一（v8 §19）。这里按太阳的屏幕半径把它们淡出，
     * 而不是调整曝光：远处的太阳本来就该只是一个亮点。
     */
    const ortho = state.camera as THREE.OrthographicCamera
    const viewHeight = (ortho.top - ortho.bottom) / (ortho.zoom || 1)
    const sunScreenRadius = (SUN_RADIUS / Math.max(viewHeight, 1e-3)) * state.size.height * 0.5
    const detailFade = THREE.MathUtils.smoothstep(sunScreenRadius, 7, 26)
    items.forEach((item) => {
      item.material.uniforms.uTime.value = t
      // 远景淡出，避免亚像素亮线闪动（v8 §19 / §22）
      item.material.uniforms.uIntensity.value = item.baseIntensity * detailFade
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
function SunGlow() {
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

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const dir = camera.position.clone().normalize()
    // 光晕放在太阳"里面"：太阳本体（不透明的光球层）会挡住光晕的中央部分，
    // 只留下贴着临边的一圈辉光——这才是日冕的样子。行星转到前面时同样会挡住它。
    const base = new THREE.Vector3(0, 0, 0)
    // 光晕的大小跟着可见高度走：像真实的镜头光斑，而不是随距离缩放的贴图
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    // v8 §19：缩到全览时不能让光晕跟着视高无限长大（那会在小日面周围糊出一大片）
    const scale = THREE.MathUtils.clamp(viewHeight * 0.34, SUN_RADIUS * 3.2, SUN_RADIUS * 14)

    if (tightRef.current) {
      tightRef.current.position.copy(base)
      tightRef.current.scale.setScalar(scale * 0.62)
    }
    if (wideRef.current) {
      wideRef.current.position.copy(base)
      wideRef.current.scale.setScalar(scale * 1.15)
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
          opacity={0.2}
        />
      </sprite>
      <sprite ref={tightRef} renderOrder={5}>
        <spriteMaterial
          map={tightTexture}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          opacity={0.46}
        />
      </sprite>
    </group>
  )
}

/** 图谱的原点。太阳是唯一光源，其他天体的光照方向都由它推出。 */
export function Sun() {
  const surface = useMemo(() => createSunMaterial(), [])
  const chromosphere = useMemo(() => createChromosphereMaterial(), [])
  const corona = useMemo(() => createCoronaMaterial(), [])
  // 真实日面：NASA SDO HMI 白光照片。没有它才退回程序化米粒组织。
  const photosphere = useTexture('planets/sun_photosphere-2k.jpg')
  // 等距圆柱投影的日面贴图：SDO 的全圆面照片直接贴球会"少一大块"，
  // 必须用 2:1 的柱面图（Solar System Scope，CC BY 4.0）
  const sunMap = useTexture('planets/sun_equirect-2k.jpg')
  const spaceWeather = useAtlasStore((state) => state.spaceWeatherOpen)
  const focusKind = useAtlasStore((state) => state.focusKind)
  const focusId = useAtlasStore((state) => state.focusId)
  // 主界面只留细微的日冕结构；聚焦太阳或打开空间天气时才让日珥 / 活动区明显起来
  const sunFocused = focusKind === 'PLANET' && focusId === 'sun'
  const activity = sunFocused || spaceWeather ? 3.6 : 1
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
  }, [photosphere, sunMap, surface])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    surface.material.uniforms.uTime.value = t
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
    const sunScreenRadius = (SUN_RADIUS / Math.max(viewHeight, 1e-3)) * state.size.height * 0.5
    const detailFade =
      THREE.MathUtils.smoothstep(sunScreenRadius, 7, 26) * quality.coronaDetail
    chromosphere.uniforms.uIntensity.value =
      (0.5 + 0.5 * (activity / 3.6)) * detailFade
    corona.uniforms.uIntensity.value = detailFade
  })

  return (
    <group name="sun">
      <mesh name="sun-core">
        <sphereGeometry args={[SUN_RADIUS, 96, 64]} />
        <primitive object={surface.material} attach="material" />
      </mesh>
      <mesh scale={1.015}>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
        <primitive object={chromosphere} attach="material" />
      </mesh>
      <mesh scale={1.55}>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
        <primitive object={corona} attach="material" />
      </mesh>
      <Prominences intensity={activity} />
      {spaceWeather ? <SolarActivity /> : null}
      <SunGlow />
    </group>
  )
}
