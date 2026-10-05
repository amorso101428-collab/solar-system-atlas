import type * as THREE from 'three'

/**
 * 共享的渲染器句柄（v9 §23）。
 *
 * 遥测 HUD 需要 `renderer.info`（draw calls / triangles / textures）
 * 与 GPU 信息字符串，但它在 3D 层内部创建。这里放一个模块级引用，
 * AtlasCanvas 创建渲染器时写入，HUD 读取——两端都不需要经过 React。
 */
export const glStats: {
  renderer: THREE.WebGLRenderer | null
  /** 场景根节点（v9.4：显存估算要遍历它） */
  scene: THREE.Object3D | null
} = { renderer: null, scene: null }

/**
 * 各行星当前的压暗系数（v9.2 自检用）。
 * 由 Planets 每帧写入、调试钩子读取——用来验证"聚焦时其他天体确实被压暗"。
 */
export const planetDim = new Map<string, number>()
