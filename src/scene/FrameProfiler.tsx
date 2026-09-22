import { useFrame } from '@react-three/fiber'
import { markFrameEnd, markFrameStart } from '../utils/perfSampler'

/**
 * 主线程耗时采样（v9.4）。
 *
 * 用一前一后两个 useFrame 夹住整帧：priority -1000 最先跑，priority 1000
 * 最后跑，中间是全部 useFrame 回调、DOM 标签写入与 PostFX 的渲染提交。
 * 两者之差就是"这一帧主线程真正忙了多久"，HUD 拿它算 CPU 占用率。
 */
export function FrameProfiler() {
  useFrame(() => markFrameStart(performance.now()), -1000)
  useFrame(() => markFrameEnd(performance.now()), 1000)
  return null
}
