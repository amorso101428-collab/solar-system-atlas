import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { adaptiveQuality } from './AdaptiveQualityManager'
import { qualityDpr } from './QualityProfile'
import { useQualitySettings } from './useQuality'

/**
 * 把自适应画质接进渲染循环（V1.1 §11 / §16）。
 *
 *   · 每帧上报帧时间（只有当设备不是桌面时才统计）
 *   · 换档时改渲染分辨率；桌面完全不参与，交给原来的 PerfGovernor
 */
export function QualityController() {
  const setDpr = useThree((state) => state.setDpr)
  const settings = useQualitySettings()
  const active = adaptiveQuality.active

  useFrame((_state, delta) => {
    if (!active) return
    adaptiveQuality.reportFrame(delta * 1000)
  })

  useEffect(() => {
    if (!active) return
    setDpr(qualityDpr(settings.level))
  }, [active, setDpr, settings.level])

  return null
}
