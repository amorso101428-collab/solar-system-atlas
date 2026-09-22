import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PLANETS } from '../data/planets'
import type { MoonDef, PlanetDef, SystemId } from '../data/types'
import { attachSurfaceMaps, createPlanetMaterial, createRingMaterial } from './materials'
import {
  damp,
  focusBackgroundDim,
  minorSatelliteVisibility,
  satelliteVisibility,
} from '../utils/reveal'
import { buildOrbitGeometry, createOrbitMaterial } from './orbitLine'
import { smoothYear, worldNow } from '../utils/clock'
import { getWorld } from '../utils/world'
import { useAtlasStore } from '../state/atlasStore'
import { useTexture } from './useTexture'
import { planeQuaternion } from '../utils/orbitPose'
import { axisQuaternion, daysSinceJ2000, spinAngle, tidalLockSpin } from '../astronomy/orientation'
import { DISK_RADIUS } from '../utils/layout'
import { planetDim } from '../utils/glStats'

/**
 * 轨道语义（v5 §7）。
 *
 *   天然卫星   —— **细黄实线**，低透明度，无缺口、无 glow。
 *   人造航天器 —— **细实线 + 小缺口**（约 10°），缺口正好承载那颗卫星的标记与名称。
 *   远景大轨道 —— 更低的存在感。
 *
 * 上一版"人造=虚线、天然=实线"的语义反过来用错了对象，这里改回来。
 * 线一律更细更淡：轨道是辅助，不是主角。
 */
export const objectOrbitMaterial = createOrbitMaterial('#8fa3ad', 0.2)
objectOrbitMaterial.uniforms.uGapSpan.value = 0.028
objectOrbitMaterial.uniforms.uGapEnabled.value = 1

/** 主要天然卫星（月球 / 伽利略卫星 / 土卫六 / 海卫一）的轨道 */
export const moonOrbitMaterial = createOrbitMaterial('#d9c583', 0.22)
/** 外围小卫星：只有在推近到能看清时才慢慢浮现 */
export const minorMoonOrbitMaterial = createOrbitMaterial('#c9b877', 0.1)

/** 半径大于这个值（≈ 月球 / 伽利略卫星 / 土卫六 / 海卫一）才算"主要卫星" */
export const MAJOR_MOON_RADIUS = 0.25

/** 小行星带任务那一圈半径 40+ 的大轨道：只作为背景参考，不能抢主体 */
export const distantOrbitMaterial = createOrbitMaterial('#6a6659', 0.1)

/** 选中轨道：只把那一圈整体提亮，不再有"跑动的能量头" */
const emphasisMaterial = new THREE.LineBasicMaterial({
  color: '#d59a5e',
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
})

/** 所有会出现在图上的系统盘（含太阳、月球、小行星带） */
const DISK_IDS: SystemId[] = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'belt',
]

const MOONS: MoonDef[] = PLANETS.flatMap((planet) => planet.moons)
/** 卫星 → 母行星（用它算"这个系统在屏幕上有多大"） */
const MOON_PARENT = new Map<string, string>(
  PLANETS.flatMap((planet) => planet.moons.map((moon) => [moon.id, planet.id]))
)

/**
 * 单位圆的顶点数据。每圈轨道会拿它复制出一份自己的几何体（要带自己的开口相位），
 * 但原始数据只算一次；摆位依旧靠 scale / quaternion，展开时不会重建 geometry。
 */
function unitCirclePositions(segments = 160): Float32Array {
  const points = new Float32Array(segments * 3)
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    points[i * 3 + 0] = Math.cos(theta)
    points[i * 3 + 1] = Math.sin(theta)
    points[i * 3 + 2] = 0
  }
  return points
}

const scratchTilt = new THREE.Quaternion()
const axisZ = new THREE.Vector3(0, 0, 1)

/**
 * 每条轨道的目标透明度（不含 LOD 渐隐系数）。
 * 传进来的 detail / artificialScale / moonScale 由 Planets 每帧算好，
 * SystemDiskLayer 的 useFrame 只读它——两层不各自维护一份 LOD 公式。
 */
function orbitOpacity(
  kind: 'moon' | 'object',
  majorMoon: boolean,
  radius: number,
  orbital: boolean,
  detail: number,
  artificialScale: number,
  moonScale: number
): number {
  if (radius > 30) return orbital ? 0.2 : 0.1
  if (kind === 'moon') {
    return majorMoon
      ? (orbital ? 0.46 : 0.3) * (0.5 + 0.5 * detail) * moonScale
      : (orbital ? 0.22 : 0.1) * detail * moonScale
  }
  return (orbital ? 0.4 : 0.2) * detail * artificialScale
}

/**
 * 一个天体系统的轨道盘。
 * 每一圈轨道有自己的四元数（ATLAS 正对镜头 → REAL 真实倾角），
 * 所以右键转动视角时，这些轨道会按各自的相位差"散开"成真实的 3D 姿态。
 *
 * v6 §5：每条轨道有**自己的材质副本**，于是 LOD 可以逐条渐变——
 * 缩放时不再"啪"地冒出来 / 消失，而是每个轨道盘按自己的节奏淡入淡出。
 */
function SystemDiskLayer({ systemId }: { systemId: SystemId }) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.Line[]>([])
  const fadesRef = useRef<Float32Array>(new Float32Array(0))
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)
  const hoveredId = useAtlasStore((state) => state.hoveredId)
  const selectedObjectId = useAtlasStore((state) => state.selectedObjectId)
  const template = useMemo(() => unitCirclePositions(), [])

  const lines = useMemo(() => {
    const disk = getWorld(0).systems.get(systemId)
    const created = (disk?.orbits ?? []).map((orbit) => {
      // 每圈轨道一份几何体：开口的相位/速度是逐轨道的，但材质仍然共用
      const source =
        orbit.radius > 30
          ? distantOrbitMaterial
          : orbit.kind === 'moon'
            ? orbit.majorMoon
              ? moonOrbitMaterial
              : minorMoonOrbitMaterial
            : objectOrbitMaterial
      // 材质副本：uOpacity 逐条独立，才能做渐显 / 渐隐
      const material = source.clone()
      material.uniforms.uOpacity.value = 0
      const line = new THREE.Line(buildOrbitGeometry(template, orbit.gapPhase, orbit.gapSpeed), material)
      line.userData.orbitId = orbit.id
      return line
    })
    linesRef.current = created
    fadesRef.current = new Float32Array(created.length)
    return created
  }, [systemId, template])

  const emphasis = useMemo(() => {
    const line = new THREE.Line(new THREE.BufferGeometry(), emphasisMaterial)
    line.visible = false
    return line
  }, [])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const t = worldNow()
    const world = getWorld(t)
    const disk = world.systems.get(systemId)
    if (!disk) return
    group.position.copy(disk.center)
    /**
     * 硬性 LOD：这个行星盘在屏幕上还剩多少像素。
     * 缩到总览时，几十圈航天器轨道会挤在几个像素里、互相叠加成一块亮斑
     * （看起来跟太阳一样亮）——所以低于阈值就直接不画（v5 §6 / §27）。
     */
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    const diskScreen = (disk.radius / Math.max(viewHeight, 1e-3)) * size.height * 0.5
    /**
     * 连续的可见度（v8 §20）。
     *
     * 旧版这里有三个不同阈值：轨道线 70 / 小卫星 84 / 卫星点 26 / 标签又一个公式，
     * 于是"轨道出来了、点还没出来"，而且到点就跳。现在只留两个连续函数
     * （主可见度 + 更晚出现的小卫星层），轨道线、卫星点、标签全部乘同一组值。
     */
    const satVis = satelliteVisibility(diskScreen)
    const minorVis = minorSatelliteVisibility(diskScreen)
    const detail = satVis
    const {
      viewLayer,
      hideArtificial,
      hideMoons,
      hideAllOrbits,
      otherOrbitOpacity,
      focusKind,
      focusId,
    } = useAtlasStore.getState()
    /**
     * v9.2：**聚焦这颗行星时，它自己的卫星轨道要退到背景。**
     *
     * 之前聚焦地球时，几十圈人造卫星轨道全在满亮度上，屏幕上是一张密集的网，
     * 观众根本读不到行星本身。现在自己人打折到 0.22，只作为"这里有轨道"的上下文。
     */
    const selfFocused =
      (focusKind === 'PLANET' && focusId === systemId) ||
      (focusKind === 'MOON' && focusId != null && MOON_PARENT.get(focusId) === systemId)
    const selfDim = selfFocused ? 0.22 : 1
    const orbital = viewLayer === 'ORBITAL'
    const artificialFocus = focusKind === 'OBJECT' && focusId ? 1 : 0
    const artificialScale =
      hideArtificial || hideAllOrbits
        ? 0
        : (artificialFocus ? 0.5 * otherOrbitOpacity : 1) * selfDim
    // 自然卫星被关掉时，它们的同心圆也一起退场（v6 §13 的三个开关之一）
    const moonScale = hideAllOrbits || hideMoons ? 0 : selfDim
    // 渐变步长：约 0.35 秒走完，缩放时不再"啪"地出现 / 消失
    const step = THREE.MathUtils.clamp(delta, 1 / 240, 0.05)
    const damp = 1 - Math.pow(0.004, step)

    for (let i = 0; i < disk.orbits.length && i < linesRef.current.length; i++) {
      const orbit = disk.orbits[i]!
      const line = linesRef.current[i]!
      const target =
        orbit.kind === 'moon'
          ? orbit.majorMoon
            ? satVis
            : satVis * minorVis
          : // 人造卫星：轨道线与圆点用**同一个** satVis（v8.2 同步出现/消失）
            satVis
      const fades = fadesRef.current
      fades[i] = (fades[i] ?? 0) + (target - (fades[i] ?? 0)) * damp
      const fade = fades[i]!
      line.visible = fade > 0.012
      const material = line.material as THREE.ShaderMaterial
      material.uniforms.uTime.value = t
      material.uniforms.uOpacity.value =
        orbitOpacity(orbit.kind, orbit.majorMoon, orbit.radius, orbital, detail, artificialScale, moonScale) * fade
      line.scale.set(orbit.radius, orbit.radius * orbit.squash, 1)
      scratchTilt.setFromAxisAngle(axisZ, orbit.tilt)
      line.quaternion.copy(orbit.quaternion).multiply(scratchTilt)
    }

    /**
     * v8.1：删掉"选中/悬停时把整条轨道点亮"的那一圈。
     *
     * 它本来是想表达"你选中了这条轨道"，但实际效果是：点一个航天器，
     * 画面里立刻多出一个跨越半屏的大环，比对象本身还抢眼。
     * 现在选中态由对象节点自己（更亮的 glyph + 标签）表达，不再画整圈。
     */
    emphasis.visible = false
  })

  return (
    <group ref={groupRef}>
      {lines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
      <primitive object={emphasis} />
    </group>
  )
}

/**
 * 卫星锚点（方案书 §12 / §13）。
 *
 * 每颗天然卫星在它的轨道开口里有一个屏幕空间恒定大小的高亮点：
 * 远看就是"轨道开口里的那颗点 + 名字"，推近之后球体把它盖住，
 * 于是同一套 UI 在两种尺度上都读得通。
 */
function MoonAnchors() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)
  /** 每颗卫星自己的可见度（带阻尼），逐帧写进 aAlpha */
  const moonAlphaRef = useRef<Float32Array>(new Float32Array(0))
  const geometry = useMemo(() => {
    const count = MOONS.length
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const alphas = new Float32Array(count)
    MOONS.forEach((moon, index) => {
      // 大卫星的点稍大一点，但差别要小，否则又变成一堆彩色气泡
      sizes[index] = moon.radius >= 0.12 ? 4.6 : moon.radius >= 0.07 ? 3.9 : 3.2
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    return geo
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute float aAlpha;
          uniform float uPixelRatio;
          uniform float uOpacity;
          varying float vAlpha;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPixelRatio;
            vAlpha = uOpacity * aAlpha;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying float vAlpha;
          void main(){
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float core = smoothstep(0.42, 0.0, d);
            float halo = smoothstep(1.0, 0.0, d) * 0.3;
            float a = (core + halo) * vAlpha;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(1.0, 0.96, 0.90) * a, a);
          }
        `,
        uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0.5 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

	useFrame((_, delta) => {
	    const world = getWorld(worldNow())
	    const positions = geometry.attributes.position as THREE.BufferAttribute
	    const array = positions.array as Float32Array
	    const alphaAttr = geometry.attributes.aAlpha as THREE.BufferAttribute
	    const alphas = alphaAttr.array as Float32Array
	    if (moonAlphaRef.current.length !== MOONS.length) {
	      moonAlphaRef.current = new Float32Array(MOONS.length)
	    }
	    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
	    const step = THREE.MathUtils.clamp(delta, 1 / 240, 0.05)
	    MOONS.forEach((moon, index) => {
	      const anchor = world.moons.get(moon.id)
	      if (!anchor) return
	      array[index * 3 + 0] = anchor.position.x
	      array[index * 3 + 1] = anchor.position.y
	      array[index * 3 + 2] = anchor.position.z
	      /**
	       * 每颗卫星按**自己母星系统**在屏幕上的大小淡入（v8 §20）。
	       * 旧版用的是固定的 6 单位盘半径 + 单一阈值，于是"轨道出来了、点还没出来"，
	       * 而且到点就跳。现在和轨道线共用同一组连续可见度，再各自做阻尼。
	       */
	      const parentId = MOON_PARENT.get(moon.id) ?? ''
	      const diskRadius = DISK_RADIUS[parentId] ?? 6
	      const diskScreen = (diskRadius / Math.max(viewHeight, 0.001)) * size.height * 0.5
	      const target =
	        satelliteVisibility(diskScreen) *
	        (moon.radius >= 0.09 ? 1 : minorSatelliteVisibility(diskScreen))
	      moonAlphaRef.current[index] = damp(moonAlphaRef.current[index] ?? 0, target, 4.5, step)
	      alphas[index] = moonAlphaRef.current[index] ?? 0
	    })
	    positions.needsUpdate = true
	    alphaAttr.needsUpdate = true
	    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
	    // 总览里这些小点要非常克制：它们是"这里有颗卫星"的提示，不是光源
	    material.uniforms.uOpacity.value = 0.22
	  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/** 行星本体：真实贴图 + 以太阳为唯一光源的着色器 */
function PlanetBody({ planet }: { planet: PlanetDef }) {
  const handle = useMemo(
    () =>
      createPlanetMaterial({
        id: planet.id,
        surface: planet.surface,
        color: planet.color,
        atmosphere: planet.atmosphere,
      }),
    [planet]
  )

  const albedo = useTexture(planet.texture)
  const night = useTexture(planet.id === 'earth' ? 'planets/earth_nightmap-2k.jpg' : null)
  const clouds = useTexture(planet.id === 'earth' ? 'planets/earth_clouds_nasa-2k.jpg' : null)

  useEffect(() => {
    attachSurfaceMaps(handle, albedo, night, clouds)
  }, [handle, albedo, night, clouds])

  const groupRef = useRef<THREE.Group>(null)
  const tiltRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  // 自转轴：固定为真实的轴倾角方向，与土星环的真实姿态严格一致
  // 自转轴：由 IAU 极轴（RA/Dec）算出来，不再是"随手给一个倾角"（v5 §15）
  const axisFrame = useMemo(() => axisQuaternion(planet.orientation), [planet])

  useFrame((state, delta) => {
    const t = worldNow()
    const world = getWorld(t)
    const anchor = world.planets.get(planet.id)
    const group = groupRef.current
    if (!group || !anchor) return
    group.position.copy(anchor.position)
    const step = THREE.MathUtils.clamp(delta, 1 / 240, 0.05)
    /**
     * v8 §26：聚焦某颗行星时，其余行星压暗到 0.20（阻尼过渡）。
     * 焦点行星保持 1.0 —— 于是"周围一切退到背景、只剩它"这件事
     * 是靠层级而不是靠整屏变黑做到的。
     */
    const focus = useAtlasStore.getState()
    const focusIsBody = focus.focusKind === 'PLANET' || focus.focusKind === 'MOON'
    const focusedId =
      focus.focusKind === 'PLANET' ? focus.focusId : focus.focusKind === 'MOON' ? 'moon' : null
    const focusDim = focusBackgroundDim(focus.focusKind)
    let wantDim = 1
    if (focusIsBody && focusedId && focusedId !== planet.id) {
      wantDim = focusDim.planets
      /**
       * v9.2：**挡住聚焦天体的那颗，压得更狠。**
       *
       * 正交相机下"离镜头更近"就是"沿视线方向更靠前"：
       * 用位置向量在视线方向上的投影比较即可。聚焦火星时，正巧转到它前面的
       * 木星会把它整个盖住——现在那颗会被压到 0.05，不会再抢镜。
       */
      const focusedAnchor = world.planets.get(focusedId as never)
      if (focusedAnchor) {
        const viewDir = state.camera.position.clone().normalize()
        const selfDepth = anchor.position.dot(viewDir)
        const focusDepth = focusedAnchor.position.dot(viewDir)
        if (selfDepth > focusDepth) wantDim = Math.min(wantDim, 0.05)
      }
    }
    const bodyMaterial = handle.material
    bodyMaterial.uniforms.uDim.value = damp(bodyMaterial.uniforms.uDim.value as number, wantDim, 5, step)
    // 自检：把当前的压暗系数暴露出去（?debug=1 下的 __atlasCamera().dims）
    planetDim.set(planet.id, bodyMaterial.uniforms.uDim.value as number)
    // 自转角来自 IAU 模型：W = W0 + rate × (距 J2000 的天数)，
    // 时间轴换年份时自转相位也跟着变，而不是随便转
    if (meshRef.current) {
      meshRef.current.rotation.y = spinAngle(
        planet.orientation,
        daysSinceJ2000(smoothYear())
      )
    }
    handle.material.uniforms.uTime.value = t
  })

  return (
    <group ref={groupRef}>
      <group ref={tiltRef} quaternion={axisFrame}>
        <mesh ref={meshRef} name={`planet:${planet.id}`}>
          <sphereGeometry args={[planet.radius, 96, 64]} />
          <primitive object={handle.material} attach="material" />
        </mesh>
      </group>
      {planet.rings ? <RingSystem planet={planet} /> : null}
    </group>
  )
}

/**
 * 行星环（方案书 §8：土星环必须永远在）。
 *
 * 上一版环彻底消失的原因不在几何、不在层级，而在着色器：
 * 片元里用了 `modelMatrix`（three 只在顶点着色器声明它），program 编译失败，
 * 于是环被静默丢弃。现在行星中心走 uniform，并且环面随系统盘从"正对镜头的
 * 图谱姿态"过渡到行星赤道面，同时保留卡西尼缝与环上的行星影子。
 */
function RingSystem({ planet }: { planet: PlanetDef }) {
  const ring = planet.rings!
  const material = useMemo(() => createRingMaterial(ring, planet.radius), [ring, planet.radius])
  const texture = useTexture(planet.ringTexture ?? null)
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    material.uniforms.uRingMap.value = texture
    material.uniforms.uHasRingMap.value = texture ? 1 : 0
    material.needsUpdate = true
  }, [material, texture])

  useFrame((_, delta) => {
    const world = getWorld(worldNow())
    const disk = world.systems.get(planet.id)
    if (groupRef.current && disk) groupRef.current.quaternion.copy(disk.quaternion)
    const anchor = world.planets.get(planet.id)
    if (anchor) material.uniforms.uPlanetCenter.value.copy(anchor.position)
    material.uniforms.uTime.value = worldNow()
    // v8 §26：环与本体一起压暗，否则聚焦别的行星时土星环会孤零零地亮着
    const focus = useAtlasStore.getState()
    const focusDim = focusBackgroundDim(focus.focusKind)
    const wantDim = focus.focusKind === 'ATLAS' || focus.focusId === planet.id ? 1 : focusDim.planets
    const step = THREE.MathUtils.clamp(delta, 1 / 240, 0.05)
    material.uniforms.uDim.value = damp(material.uniforms.uDim.value as number, wantDim, 5, step)
    // 环永远是"覆在行星上方的一层"：不写深度，但在行星之后绘制
    if (meshRef.current) meshRef.current.renderOrder = 2
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} frustumCulled={false}>
        <ringGeometry args={[planet.radius * ring.inner, planet.radius * ring.outer, 256, 12]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}

/**
 * 卫星本体：有真实全球图就用它（木卫、土卫、海卫一…），否则用程序化表面。
 * 正交相机下小卫星会掉到亚像素，所以给一个屏幕空间下限——
 * 总览里它们是能看见的小球，推近之后才是带贴图的实体。
 */
function MoonBody({ moon }: { moon: MoonDef }) {
  const handle = useMemo(
    () =>
      createPlanetMaterial({ id: moon.id, surface: moon.surface, color: moon.color }),
    [moon]
  )
  const map = useTexture(moon.texture ?? null)
  const ref = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)
  const axisFrame = useMemo(
    () => (moon.orientation ? axisQuaternion(moon.orientation) : null),
    [moon]
  )
  const spinner = useRef(new THREE.Vector3())

  useEffect(() => {
    handle.setMap(map ?? null)
  }, [handle, map])

  useFrame((_, delta) => {
    const t = worldNow()
    const world = getWorld(t)
    const anchor = world.moons.get(moon.id)
    if (!ref.current || !anchor) return
    ref.current.position.copy(anchor.position)
    // v8 §26：聚焦某颗月球时，其余月球与行星一起压暗
    const focus = useAtlasStore.getState()
    const focusDim = focusBackgroundDim(focus.focusKind)
    const focused = focus.focusKind === 'MOON' && focus.focusId === moon.id
    const wantDim = focused ? 1 : focusDim.planets
    const step = THREE.MathUtils.clamp(delta, 1 / 240, 0.05)
    handle.material.uniforms.uDim.value = damp(
      handle.material.uniforms.uDim.value as number,
      focus.focusKind === 'ATLAS' ? 1 : wantDim,
      5,
      step
    )
    if (meshRef.current && moon.orientation) {
      // 潮汐锁定的卫星：本初子午线永远朝向母体（月球不再"月背对着地球"）
      const parent = world.planets.get(anchor.planetId)
      meshRef.current.rotation.y =
        moon.tidalLocked && parent
          ? tidalLockSpin(moon.orientation, anchor.position, parent.position, spinner.current)
          : spinAngle(moon.orientation, daysSinceJ2000(smoothYear()))
    } else if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.05 + moon.orbitRadius
    }
    handle.material.uniforms.uTime.value = t
    // 屏幕空间下限：至少 2.2px 半径，缩到总览也看得见
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    const minWorld = (2.2 / Math.max(size.height, 1)) * viewHeight
    ref.current.scale.setScalar(Math.max(1, minWorld / moon.radius))
  })

  return (
    <group ref={ref} name={`moon:${moon.id}`}>
      <group quaternion={axisFrame ?? undefined}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[moon.radius, 48, 32]} />
          <primitive object={handle.material} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

export function Planets() {
  const hideMoons = useAtlasStore((state) => state.hideMoons)
  return (
    <group name="planets">
      {PLANETS.map((planet) => (
        <PlanetBody key={planet.id} planet={planet} />
      ))}
      {/* 自然卫星及其标记：整组一个 visible，省得重建材质（v6 §13） */}
      <group visible={!hideMoons}>
        {MOONS.map((moon) => (
          <MoonBody key={moon.id} moon={moon} />
        ))}
        <MoonAnchors />
      </group>
      {DISK_IDS.map((systemId) => (
        <SystemDiskLayer key={systemId} systemId={systemId} />
      ))}
    </group>
  )
}
