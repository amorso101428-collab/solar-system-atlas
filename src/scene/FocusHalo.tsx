import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtlasStore } from '../state/atlasStore'
import { worldNow } from '../utils/clock'
import { getWorld } from '../utils/world'
import { PLANET_BY_ID } from '../data/planets'
import type { PlanetDef, SystemId } from '../data/types'

/**
 * 聚焦标识（v8.3）。
 *
 * 只保留 **Target Bracket**：四个不闭合的短角，屏幕空间恒定大小、很细、低对比度，
 * 进入聚焦时做一次 250ms 的展开，之后完全静止。
 *
 * v8.3 删掉了原来那圈 **Orbital Halo**（把目标自己的轨道整条画成椭圆）。
 * 它在聚焦时会横跨半个屏幕，比对象本身还抢眼——用户的原话是"外圈还有个巨大的环，
 * 我不要那个环"。沿这圈轨道跑动的短轨迹也一起去掉。
 */
export function FocusHalo() {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)
  const groupRef = useRef<THREE.Group>(null)

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#e0a86a',
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    []
  )

  const bracketMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#e0b98a',
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    []
  )

  /** 四个角，每角两条短线：中心完全留空，天体本身必须完整可见 */
  const bracketGeometry = useMemo(() => {
    const arm = 0.32
    const gap = 0.6
    const points: number[] = []
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        points.push(sx * gap, sy * gap, 0, sx * (gap + arm), sy * gap, 0)
        points.push(sx * gap, sy * gap, 0, sx * gap, sy * (gap + arm), 0)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [])

  const bracket = useMemo(
    () => new THREE.LineSegments(bracketGeometry, bracketMaterial),
    [bracketGeometry, bracketMaterial]
  )

  const focusEnteredAt = useRef(-1)

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const { focusKind, focusId, cameraState } = useAtlasStore.getState()
    const world = getWorld(worldNow())
    const focused = cameraState === 'FOCUS' || cameraState === 'FLYING_IN'
    // 三圈大尺度结构不用括号标识：它们不是一个"目标点"
    const goal = focused && focusKind !== 'ATLAS' && focusKind !== 'REGION' ? 0.85 : 0
    if (goal > 0 && lineMaterial.opacity < 0.02) focusEnteredAt.current = state.clock.elapsedTime
    lineMaterial.opacity += (goal - lineMaterial.opacity) * 0.085
    bracketMaterial.opacity = lineMaterial.opacity * 0.6
    const active = lineMaterial.opacity > 0.012
    bracket.visible = active
    group.visible = active
    if (!active || !focusId) return

    let position: THREE.Vector3 | null = null
    let orbitQuaternion: THREE.Quaternion | null = null
    let orbitRadius = 0
    let orbitSquash = 1
    let orbitTilt = 0

    if (focusKind === 'OBJECT') {
      const anchor = world.objects.get(focusId)
      if (anchor) {
        position = anchor.position
        const disk = anchor.diskId ? world.systems.get(anchor.diskId) : null
        const orbit = disk?.orbits.find((entry) => entry.id === focusId)
        if (orbit) {
          orbitQuaternion = orbit.quaternion
          orbitRadius = orbit.radius
          orbitSquash = orbit.squash
          orbitTilt = orbit.tilt
        }
      }
    } else if (focusKind === 'MOON') {
      const moon = world.moons.get(focusId)
      if (moon) {
        position = moon.position
        const disk = world.systems.get(moon.diskId)
        const orbit = disk?.orbits.find((entry) => entry.id === focusId)
        if (orbit) {
          orbitQuaternion = orbit.quaternion
          orbitRadius = orbit.radius
          orbitSquash = orbit.squash
          orbitTilt = orbit.tilt
        }
      }
    } else {
      const planet: PlanetDef | undefined = PLANET_BY_ID.get(focusId as SystemId)
      const anchor = world.planets.get(focusId as SystemId)
      if (planet && anchor) {
        position = anchor.position
        orbitQuaternion = new THREE.Quaternion()
        orbitRadius = planet.displayDistance
        orbitSquash = 1 - planet.orbitEcc
        orbitTilt = 0
      }
    }

    if (!position) {
      group.visible = false
      return
    }

    group.position.copy(position)

    // Target Bracket：屏幕空间恒定大小；进入时一次 0.65 → 1.0 的展开
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    const unit = (viewHeight / Math.max(size.height, 1)) * 27
    const grow =
      focusEnteredAt.current < 0
        ? 1
        : THREE.MathUtils.clamp(
            (state.clock.elapsedTime - focusEnteredAt.current) / 0.25,
            0.65,
            1
          )
    bracket.scale.setScalar(unit * grow)
    bracket.quaternion.copy(camera.quaternion)

    // v8.3：轨道环与沿环跑动的轨迹都删了，这里只剩下角标的位置更新。
  })

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={bracket} />
    </group>
  )
}
