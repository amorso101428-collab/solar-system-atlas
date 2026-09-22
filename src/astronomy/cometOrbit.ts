import * as THREE from 'three'
import type { CometDef } from '../data/comets'
import { mapAuToVisualSmooth } from './visualScale'

/**
 * 彗星轨道（v5 §14）。
 *
 * 用真实的高偏心率轨道要素在黄道坐标里解二体问题：
 *   半长轴 a、偏心率 e、倾角 i、升交点黄经 Ω、近日点幅角 ω、J2000 平近点角 M0。
 * 视觉半径仍走 AU → 视觉半径的同一条非线性曲线，所以"离太阳多远"是可比的。
 * 场景坐标约定：x = 黄道 X，y = 黄道 Z（向上），z = 黄道 Y。
 */

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
const DAYS_PER_YEAR = 365.25

/** 解出给定时刻的真近点角与半径（视觉单位） */
function solve(comet: CometDef, year: number) {
  // v9.1：连续年份（Date.UTC 会把年份取整，那会让彗星只在跨年时跳一次）
  const days = (year - 2000) * DAYS_PER_YEAR
  const period = comet.periodYears * DAYS_PER_YEAR
  const n = 360 / period
  const M = THREE.MathUtils.degToRad(comet.m0 + n * days)
  let E = M
  for (let i = 0; i < 6; i++) {
    E -= (E - comet.e * Math.sin(E) - M) / (1 - comet.e * Math.cos(E))
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + comet.e) * Math.sin(E / 2), Math.sqrt(1 - comet.e) * Math.cos(E / 2))
  const rAu = comet.a * (1 - comet.e * Math.cos(E))
  return { nu, rAu }
}

/** 轨道面 → 场景坐标：u 在近日点方向，v 在其垂直方向 */
function toWorld(
  comet: CometDef,
  rAu: number,
  nu: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const node = THREE.MathUtils.degToRad(comet.node)
  const peri = THREE.MathUtils.degToRad(comet.peri)
  const inc = THREE.MathUtils.degToRad(comet.i)
  const u = nu + peri - node
  // v8.1：彗星轨道用**光滑**映射。分段线性映射在每个行星停点都有斜率突变，
  // 椭圆会被折出棱角（"轨道不规则"的根因），这里换成单调三次插值版本。
  const r = mapAuToVisualSmooth(rAu)
  const xEcl = r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc))
  const yEcl = r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc))
  const zEcl = r * Math.sin(u) * Math.sin(inc)
  return out.set(xEcl, zEcl, yEcl)
}

/** 彗星此刻的位置（视觉坐标） */
export function cometPosition(comet: CometDef, year: number, out = new THREE.Vector3()): THREE.Vector3 {
  const { nu, rAu } = solve(comet, year)
  return toWorld(comet, rAu, nu, out)
}

/** 生成整条轨道曲线（高偏心率的椭圆，不是圆） */
export function cometOrbitPoints(comet: CometDef, segments = 480): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  // 按偏近点角 E 均匀采样：高偏心率轨道上，按真近点角采样会在近日点附近
  // 留下长长的直线段，远日点又密得没必要。E 均匀才是几何上最均匀的取点。
  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * Math.PI * 2
    const rAu = comet.a * (1 - comet.e * Math.cos(E))
    const nu = 2 * Math.atan2(Math.sqrt(1 + comet.e) * Math.sin(E / 2), Math.sqrt(1 - comet.e) * Math.cos(E / 2))
    points.push(toWorld(comet, rAu, nu, new THREE.Vector3()))
  }
  return points
}

/** 该时刻的日心距离（AU）：用于决定彗发与彗尾的强度 */
export function cometSunDistance(comet: CometDef, year: number): number {
  return solve(comet, year).rAu
}
