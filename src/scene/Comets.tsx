import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COMETS, type CometDef } from '../data/comets'
import { cometOrbitPoints } from '../astronomy/cometOrbit'
import { useAtlasStore } from '../state/atlasStore'

/**
 * 彗星（v6 §4）。
 *
 * 彗星在这张图谱里**只用平面 UI 表示**：
 * 核、尾迹方向线、箭头全部是 DOM 层里的 `.comet-marker`
 * （由 OverlayBridge 每帧按投影坐标更新，见 labelLayer.updateCometMarker）。
 *
 * 3D 场景里只留那条高偏心率的**真实轨道线**——历史版本用 coneGeometry 画彗尾，
 * 在正交侧视图里就是一枚硬边圆锥，跟"弥散的尾巴"完全不是一回事。
 */
const orbitMaterial = new THREE.LineBasicMaterial({
  color: '#7f9ab4',
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
})

function CometOrbitLine({ comet }: { comet: CometDef }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(cometOrbitPoints(comet))
    const object = new THREE.Line(geometry, orbitMaterial)
    object.name = `comet-orbit:${comet.id}`
    return object
  }, [comet])
  return <primitive object={line} />
}

export function Comets() {
  const visible = useAtlasStore((state) => !state.hideAllOrbits)
  const groupRef = useRef<THREE.Group>(null)
  useFrame(() => {
    if (groupRef.current) groupRef.current.visible = visible
  })
  return (
    <group ref={groupRef} name="comets">
      {COMETS.map((comet) => (
        <CometOrbitLine key={comet.id} comet={comet} />
      ))}
    </group>
  )
}
