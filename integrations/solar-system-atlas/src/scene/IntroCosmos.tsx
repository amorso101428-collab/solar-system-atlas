import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { createStarMaterial } from './materials'
import { sceneReveal } from '../utils/reveal'

/**
 * 开场的那一层"近处尘埃"（v7.2）。
 *
 * 主页背景现在**就是图谱本身**：真太阳、真轨道、真行星都由 atlas-stage 渲染，
 * 相机只是停在同一构图的 1.82 倍近景上（见 CameraRig 的 introShot）。
 * 所以这一层不再画太阳、也不再画装饰性轨道弧——那些东西如果自成一派，
 * 进入图谱时就得"抹掉重画"，正是上一版看起来像换页的原因。
 *
 * 只剩下一件事：贴着镜头的极淡尘埃，让黑色有厚度。
 * 它在进入图谱的过程中随镜头退掉（1 - sceneReveal）。
 */
export function IntroCosmos({ visible }: { visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const dustRef = useRef<THREE.Points>(null)
  const gl = useThree((state) => state.gl)

  // 极淡的尘埃：固定在世界坐标里，只为了让黑色有厚度
  const dust = useMemo(() => {
    const count = 1100
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const tints = new Float32Array(count * 3)
    const color = new THREE.Color()
    let seed = 5150
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (rand() - 0.5) * 560
      positions[i * 3 + 1] = (rand() - 0.5) * 360
      positions[i * 3 + 2] = -200 - rand() * 320
      // 少量亮星，大部分是很暗的星尘
      scales[i] = rand() > 0.94 ? 1.8 + rand() * 1.6 : 0.5 + rand() * 0.9
      const warm = rand()
      color.setRGB(0.72 + warm * 0.28, 0.76 + warm * 0.2, 0.86 + (1 - warm) * 0.14)
      tints[i * 3 + 0] = color.r
      tints[i * 3 + 1] = color.g
      tints[i * 3 + 2] = color.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
    return geometry
  }, [])

  const dustMaterial = useMemo(() => {
    const material = createStarMaterial()
    material.uniforms.uBrightness.value = 0.72
    material.depthTest = false
    return material
  }, [])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    // 只有位置/朝向跟随相机；亮度与构图完全不动（稳定的背景）
    group.position.copy(state.camera.position)
    group.quaternion.copy(state.camera.quaternion)
    if (dustRef.current) {
      dustRef.current.rotation.z = state.clock.elapsedTime * 0.002
    }
    dustMaterial.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
    /**
     * v7.2：近处尘埃只在开场存在，进入图谱的过程中随镜头一起退掉。
     * 太阳和轨道弧不再是这一层画的——它们就是图谱里的真太阳与真轨道，
     * 所以"主页背景"和"图谱背景"本来就同源，没有可切换的东西。
     */
    dustMaterial.uniforms.uBrightness.value = 0.72 * (1 - sceneReveal.value)
  })

  return (
    <group ref={groupRef} visible={visible}>
      {/* 尘埃层 */}
      <points ref={dustRef} geometry={dust} material={dustMaterial} frustumCulled={false} />
    </group>
  )
}
