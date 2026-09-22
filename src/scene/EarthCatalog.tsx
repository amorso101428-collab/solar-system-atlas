import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtlasStore } from '../state/atlasStore'
import { getWorld } from '../utils/world'
import { PLANET_BY_ID } from '../data/planets'
import { worldNow } from '../utils/clock'

/**
 * build-catalog.mjs 生成轨道半径时用的地球半径基准（占位值，比图谱里的真实尺寸小）。
 * 这里换算回图谱里地球的显示半径，真实在轨目录才会正好套在地球外面，
 * 而不是缩成一小团埋在地球里面。
 */
const CATALOG_EARTH_RADIUS = 0.27
const EARTH_DISPLAY_RADIUS = PLANET_BY_ID.get('earth')?.radius ?? 1.25
const CATALOG_RADIUS_SCALE = EARTH_DISPLAY_RADIUS / CATALOG_EARTH_RADIUS

interface CatalogPayload {
  generatedAt: string
  sourceName: string
  scaleNote: string
  count: number
  orbitCounts: Record<string, number>
  stride: number
  data: number[]
}

export interface CatalogStats {
  count: number
  generatedAt: string
  sourceName: string
  scaleNote: string
  orbitCounts: Record<string, number>
}

let cachedStats: CatalogStats | null = null
export function getCatalogStats(): CatalogStats | null {
  return cachedStats
}

const VERT = /* glsl */ `
attribute vec3 aOrbitA;   // 半长轴（图谱单位）, 偏心率, 倾角
attribute vec3 aOrbitB;   // 升交点赤经, 近地点幅角, 平近点角
attribute vec2 aOrbitC;   // 平均角速度 rad/s, 轨道类别

uniform float uTime;
uniform float uTimeScale;
uniform vec3 uEarthCenter;
uniform float uPixelRatio;
uniform float uOpacity;
/** 轨道半径换算系数（目录里的 0.27 地球半径 → 图谱里的真实显示半径） */
uniform float uRadiusScale;
/** 点大小随缩放变化：正交相机下不能用距离衰减 */
uniform float uPointScale;
/** 轨道类别蒙版：x=LEO, y=MEO, z=GEO。目录面板里筛某类时，其余类别压到很暗 */
uniform vec3 uClassMask;
/** 系统盘基向量：真实在轨目录也躺在那张正对镜头的盘上 */
uniform mat3 uDisk;

varying float vClass;
varying float vAlpha;

void main() {
  float a = aOrbitA.x;
  float e = aOrbitA.y;
  float inc = aOrbitA.z;
  float raan = aOrbitB.x;
  float argp = aOrbitB.y;
  float ma = aOrbitB.z;
  float n = aOrbitC.x;
  float cls = aOrbitC.y;

  // 平近点角随时间推进：一帧只做一次三角运算，16000 个对象也毫无压力
  float M = ma + n * uTime * uTimeScale;

  // 椭圆轨道（真近点角用平近点角近似，视觉上足够）
  float r = a * uRadiusScale * (1.0 - e * e) / (1.0 + e * cos(M));
  vec3 orbital = vec3(cos(M) * r, sin(M) * r, 0.0);

  // 标准 3-1-3 姿态变换：近地点幅角 → 倾角 → 升交点赤经
  float ca = cos(argp), sa = sin(argp);
  orbital = vec3(ca * orbital.x - sa * orbital.y, sa * orbital.x + ca * orbital.y, orbital.z);

  float ci = cos(inc), si = sin(inc);
  orbital = vec3(orbital.x, ci * orbital.y - si * orbital.z, si * orbital.y + ci * orbital.z);

  float cr = cos(raan), sr = sin(raan);
  orbital = vec3(cr * orbital.x - sr * orbital.y, sr * orbital.x + cr * orbital.y, orbital.z);

  // 把轨道面转到系统盘上：盘正对镜头，于是地球轨道上的拥挤是"看得见"的
  vec3 world = uDisk * orbital + uEarthCenter;
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = cls < 0.5 ? 1.0 : (cls < 1.5 ? 1.35 : 1.8);
  gl_PointSize = clamp(size * uPixelRatio * uPointScale, 1.0, 6.0 * uPixelRatio);

  vClass = cls;
  float mask = cls < 0.5 ? uClassMask.x : (cls < 1.5 ? uClassMask.y : uClassMask.z);
  vAlpha = uOpacity * (cls < 0.5 ? 0.42 : 0.68) * mix(0.12, 1.0, mask);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying float vClass;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float alpha = smoothstep(0.5, 0.15, d) * vAlpha;
  if (alpha < 0.01) discard;
  // 一律走中性银白 → 淡琥珀：这是工程图上的注释点，不是一圈蓝点
  vec3 col = vClass < 0.5
    ? vec3(0.74, 0.76, 0.78)
    : (vClass < 1.5 ? vec3(0.84, 0.80, 0.70) : vec3(0.90, 0.72, 0.50));
  gl_FragColor = vec4(col, alpha);
}
`

/**
 * 真实在轨目录图层：CelesTrak 全量 TLE 解析出的平均轨道要素，
 * 位置在顶点着色器里实时推进，因此"人类在地球轨道上的存在"是动态的。
 */
export function EarthCatalog() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const [payload, setPayload] = useState<CatalogPayload | null>(null)
  // 默认关闭：目录是可选图层，不能一进来就先亮一下再淡出
  const visibleRef = useRef(0)
  const diskMatrix = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    let cancelled = false
    fetch('/data/earth-catalog.json')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('catalog 404'))))
      .then((json: CatalogPayload) => {
        if (cancelled) return
        cachedStats = {
          count: json.count,
          generatedAt: json.generatedAt,
          sourceName: json.sourceName,
          scaleNote: json.scaleNote,
          orbitCounts: json.orbitCounts,
        }
        setPayload(json)
      })
      .catch(() => {
        // 没有目录文件时静默跳过，图谱本身仍然完整
      })
    return () => {
      cancelled = true
    }
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uTimeScale: { value: 26 }, // 一分钟一秒：看得见运动，又不至于糊成一片
          uEarthCenter: { value: new THREE.Vector3() },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0.9 },
          uRadiusScale: { value: CATALOG_RADIUS_SCALE },
          uPointScale: { value: 1 },
          uClassMask: { value: new THREE.Vector3(1, 1, 1) },
          uDisk: { value: new THREE.Matrix3() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

  const geometry = useMemo(() => {
    if (!payload) return null
    const stride = payload.stride
    const count = payload.count
    const a = new Float32Array(count * 3)
    const b = new Float32Array(count * 3)
    const c = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const o = i * stride
      a[i * 3 + 0] = payload.data[o + 0]!
      a[i * 3 + 1] = payload.data[o + 1]!
      a[i * 3 + 2] = payload.data[o + 2]!
      b[i * 3 + 0] = payload.data[o + 3]!
      b[i * 3 + 1] = payload.data[o + 4]!
      b[i * 3 + 2] = payload.data[o + 5]!
      c[i * 2 + 0] = payload.data[o + 6]!
      c[i * 2 + 1] = payload.data[o + 7]!
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('aOrbitA', new THREE.BufferAttribute(a, 3))
    geo.setAttribute('aOrbitB', new THREE.BufferAttribute(b, 3))
    geo.setAttribute('aOrbitC', new THREE.BufferAttribute(c, 2))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1)
    return geo
  }, [payload])

  useFrame((state) => {
    if (!geometry) return
    const catalogVisible = useAtlasStore.getState().catalogVisible
    visibleRef.current += ((catalogVisible ? 1 : 0) - visibleRef.current) * 0.06
    const world = getWorld(worldNow())
    const earth = world.planets.get('earth')
    if (!earth) return
    material.uniforms.uEarthCenter.value.copy(earth.position)
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
    material.uniforms.uOpacity.value = visibleRef.current * 0.5
    // 目录面板里选了某一类轨道时，其余类别压暗但仍在——"筛选"而不是"删掉"
    const catalogClass = useAtlasStore.getState().catalogClass
    material.uniforms.uClassMask.value.set(
      catalogClass === 'ALL' || catalogClass === 'LEO' ? 1 : 0,
      catalogClass === 'ALL' || catalogClass === 'MEO' ? 1 : 0,
      catalogClass === 'ALL' || catalogClass === 'GEO' ? 1 : 0
    )
    diskMatrix.makeRotationFromQuaternion(world.quaternion)
    material.uniforms.uDisk.value.setFromMatrix4(diskMatrix)
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    material.uniforms.uPointScale.value = THREE.MathUtils.clamp(30 / Math.max(viewHeight, 1), 0.85, 2.6)
  })

  if (!geometry) return null

  return (
    <points name="earth-catalog" geometry={geometry} material={material} frustumCulled={false} />
  )
}
