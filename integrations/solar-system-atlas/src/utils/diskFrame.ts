import * as THREE from 'three'

/**
 * 系统盘基准。
 *
 * 侧视图是这张图谱的构图基础（镜头几乎沿着黄道面看过去）。
 * 如果卫星轨道也躺在黄道面里，它们会全部塌成一条线，叠在一起没法读。
 * 所以每个天体系统的卫星轨道 / 航天器轨道都画在同一张"盘"上，
 * 而这张盘永远正对镜头：侧视图里它是完整的、可分辨的椭圆。
 *
 * layout（算节点位置）与 Planets（画轨道线）共用这里的基向量，
 * 保证任何时刻节点都精确落在自己的轨道上。
 */
export interface DiskFrame {
  yaw: number
  pitch: number
  /** 方向变化的版本号：世界快照靠它判断要不要重算 */
  version: number
  /** 盘内 x 轴（屏幕右） */
  right: THREE.Vector3
  /** 盘内 y 轴（屏幕上） */
  up: THREE.Vector3
  /** 盘面法线，指向镜头 */
  normal: THREE.Vector3
  matrix: THREE.Matrix4
}

export const diskFrame: DiskFrame = {
  yaw: 0.02,
  pitch: 0.06,
  version: 0,
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  normal: new THREE.Vector3(0, 0, 1),
  matrix: new THREE.Matrix4(),
}

function rebuild(): void {
  const cy = Math.cos(diskFrame.yaw)
  const sy = Math.sin(diskFrame.yaw)
  const cp = Math.cos(diskFrame.pitch)
  const sp = Math.sin(diskFrame.pitch)
  diskFrame.right.set(cy, 0, -sy)
  diskFrame.up.set(-sy * sp, cp, -cy * sp)
  diskFrame.normal.crossVectors(diskFrame.right, diskFrame.up)
  diskFrame.matrix.makeBasis(diskFrame.right, diskFrame.up, diskFrame.normal)
}

rebuild()

/** 每帧由 CameraRig 在其它 useFrame 之前调用，返回 true 表示盘的方向变了 */
export function applyDiskFrame(yaw: number, pitch: number): boolean {
  if (Math.abs(yaw - diskFrame.yaw) < 1e-4 && Math.abs(pitch - diskFrame.pitch) < 1e-4) return false
  diskFrame.yaw = yaw
  diskFrame.pitch = pitch
  diskFrame.version += 1
  rebuild()
  return true
}

/**
 * 图谱姿态的角度（v5 §4 / v6 §11）。
 *
 * 默认是**共面的科普排列侧视图**：行星排成一串，而且镜头**正好躺在黄道面里**
 * （yaw = pitch = 0，正交投影），于是所有日心轨道、小行星带、黄道网格
 * 全部塌成过太阳的一条水平线——这才是"工程制图"该有的侧视图。
 *
 * 旧版给了 0.1 rad（≈5.7°）的俯仰：外行星那条一百多单位的轨道会被投成
 * 上下十几个单位的椭圆扇面，整张图读起来是"斜着看一盘轨道"，不是一条线。
 * 每颗行星自己的卫星轨道盘仍然正对镜头，所以那些同心圆不受影响。
 *
 * 想换成"以太阳为中心的全局真实位置"，那是 positionMode = REAL 时的另一套构图。
 */
export const SIDE_VIEW_YAW = 0
export const SIDE_VIEW_PITCH = 0
