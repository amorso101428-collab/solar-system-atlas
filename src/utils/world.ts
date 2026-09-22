import * as THREE from 'three'
import {
  computeLayout,
  type Layout,
  type MoonAnchor,
  type ObjectAnchor,
  type PlanetAnchor,
  type SystemDisk,
} from './layout'
import { diskFrame } from './diskFrame'
import { smoothYear } from './clock'
import type { SystemId } from '../data/types'
import { useAtlasStore } from '../state/atlasStore'

export interface WorldSnapshot {
  t: number
  /** 系统盘方向版本：盘转了就要重算一次布局 */
  frameVersion: number
  /** 系统盘方向（正对镜头），渲染层用它摆轨道盘 */
  quaternion: THREE.Quaternion
  layout: Layout
  planets: Map<SystemId, PlanetAnchor>
  moons: Map<string, MoonAnchor>
  objects: Map<string, ObjectAnchor>
  systems: Map<SystemId, SystemDisk>
}

let cachedT = Number.NaN
let cachedFrameVersion = -1
let cachedYear = Number.NaN
let cached: WorldSnapshot | null = null

/**
 * 同一帧内所有组件读到同一份快照：布局只计算一次，
 * 避免每个组件各自算一遍椭圆采样（那是每帧上千个 Vector3）。
 * 盘的方向（yaw/pitch）也进缓存键：盘一转，节点位置就得跟着重算。
 */
export function getWorld(t: number): WorldSnapshot {
  /**
   * 时间轴年份决定"真实位置"模式下每颗行星的黄经，所以它也是缓存键的一部分。
   * v7 §13：这里读的是**平滑年份**——拖动时间轴时所有天体连续移动，不是瞬移。
   */
  const year = smoothYear()
  if (
    cached &&
    Math.abs(t - cachedT) < 1e-6 &&
    cachedFrameVersion === diskFrame.version &&
    cachedYear === year
  ) {
    return cached
  }
  const layout = computeLayout(t, diskFrame, year)
  cached = {
    t,
    frameVersion: diskFrame.version,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(diskFrame.matrix),
    layout,
    planets: new Map(layout.planets.map((anchor) => [anchor.planet.id, anchor])),
    moons: new Map(layout.moons.map((anchor) => [anchor.id, anchor])),
    objects: new Map(layout.objects.map((anchor) => [anchor.object.id, anchor])),
    systems: new Map(layout.systems.map((disk) => [disk.id, disk])),
  }
  cachedT = t
  cachedFrameVersion = diskFrame.version
  cachedYear = year
  return cached
}

/** 目标权重：时间轴负责显隐，筛选负责降对比 */
export function objectWeight(launchYear: number, matchesFilter: boolean, timelineYear: number): number {
  const timeWeight = launchYear > timelineYear ? 0 : Math.min(1, (timelineYear - launchYear) / 2)
  const filterWeight = matchesFilter ? 1 : 0.16
  return Math.max(0, timeWeight) * filterWeight
}
