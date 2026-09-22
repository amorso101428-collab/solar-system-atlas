import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PLANETS } from '../data/planets'
import { useAtlasStore } from '../state/atlasStore'

/**
 * 黄道面坐标网格（方案书 §17）。
 *
 * 太阳是原点，黄道面是主平面：
 *   · 十字主轴稍亮（+X / +Z，以及它们的负半轴）
 *   · 每颗行星的轨道半径处一圈极淡的环，环上标着它真实的 AU 数
 *   · 每 30° 一根辐射线，只作为读数参考
 *
 * 亮度铁律：grid < orbit < selected object。
 * 网格永远不能让画面变成 CAD 工程图——默认关闭，打开后也是最淡的一层。
 */
export function EclipticGrid() {
  const visible = useAtlasStore((state) => state.gridVisible)
  const groupRef = useMemo(() => new THREE.Group(), [])

  const { rings, spokes, axes } = useMemo(() => {
    const maxRadius = 152
    const ringList: THREE.Line[] = []
    const spokeList: THREE.Line[] = []

    const ringMaterial = new THREE.LineBasicMaterial({
      color: '#7d8a99',
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    })
    const spokeMaterial = new THREE.LineBasicMaterial({
      color: '#6f7a88',
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
    })
    const axisMaterial = new THREE.LineBasicMaterial({
      color: '#98a6b5',
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    })
    const tickMaterial = new THREE.LineBasicMaterial({
      color: '#98a6b5',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    })

    // 每颗行星轨道半径处一圈（读数用），外加小行星带两侧
    const radii = [...PLANETS.map((planet) => planet.displayDistance), 44, 49.5, 125, 152]
    for (const radius of radii) {
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 240; i++) {
        const theta = (i / 240) * Math.PI * 2
        points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius))
      }
      ringList.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial))
    }

    // 每 30° 一根辐射线
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(theta) * maxRadius, 0, Math.sin(theta) * maxRadius),
      ]
      spokeList.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), spokeMaterial))
    }

    // 十字主轴：从太阳向两侧延伸，稍微亮一点，末端带一个刻度
    const axisPoints: THREE.Vector3[] = []
    const tickPoints: THREE.Vector3[] = []
    const arm = 158
    const tick = 1.6
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as Array<[number, number]>) {
      axisPoints.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(dx * arm, 0, dz * arm))
      // 末端十字刻度
      tickPoints.push(
        new THREE.Vector3(dx * arm, 0, dz * arm - tick),
        new THREE.Vector3(dx * arm, 0, dz * arm + tick)
      )
      tickPoints.push(
        new THREE.Vector3(dx * arm - tick, 0, dz * arm),
        new THREE.Vector3(dx * arm + tick, 0, dz * arm)
      )
    }
    const axis = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(axisPoints),
      axisMaterial
    )
    const axisTicks = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(tickPoints),
      tickMaterial
    )

    /**
     * 垂直方向的空间网格（v5 §12）：
     * 黄道面（XZ）是主平面，另外再补 XY / YZ 两个平面的淡参考环，
     * 以及在若干方位上的垂直连线——这样它才是一个"空间坐标系"，
     * 而不是只有一圈横向圆环。
     */
    const verticalMaterial = new THREE.LineBasicMaterial({
      color: '#7f8b99',
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
    })
    const verticals: THREE.Line[] = []
    const verticalRadius = 96
    for (const plane of ['xy', 'yz'] as const) {
      for (const radius of [30, 62, 96]) {
        const points: THREE.Vector3[] = []
        for (let i = 0; i <= 160; i++) {
          const theta = (i / 160) * Math.PI * 2
          const u = Math.cos(theta) * radius
          const v = Math.sin(theta) * radius
          points.push(
            plane === 'xy' ? new THREE.Vector3(u, v, 0) : new THREE.Vector3(0, u, v)
          )
        }
        verticals.push(
          new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), verticalMaterial)
        )
      }
    }
    // 垂直连线：把黄道网格的若干方位拉到 ±96 高度，给出 Z 方向的刻度感
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2
      const x = Math.cos(theta) * verticalRadius
      const z = Math.sin(theta) * verticalRadius
      const points = [new THREE.Vector3(x, -verticalRadius, z), new THREE.Vector3(x, verticalRadius, z)]
      verticals.push(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), verticalMaterial)
      )
    }

    return { rings: [...ringList, ...verticals], spokes: spokeList, axes: [axis, axisTicks] }
  }, [])

  useFrame(() => {
    // 网格不随时间变化：打开就是一张静止的参考系
    groupRef.visible = visible
  })

  return (
    <group ref={groupRef} name="ecliptic-grid" visible={false} renderOrder={-5}>
      {spokes.map((line, index) => (
        <primitive key={`s${index}`} object={line} />
      ))}
      {rings.map((line, index) => (
        <primitive key={`r${index}`} object={line} />
      ))}
      {axes.map((line, index) => (
        <primitive key={`a${index}`} object={line} />
      ))}
    </group>
  )
}
