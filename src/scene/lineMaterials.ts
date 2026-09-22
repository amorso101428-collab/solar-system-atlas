import * as THREE from 'three'

/**
 * 线系统（DESIGN.md §3）。层级越深线越淡，只有 hover/选中才允许变亮。
 * 用少数几个共享材质，避免每条轨道一个材质导致 draw call 爆炸。
 */

export const orbitLineMaterial = new THREE.LineBasicMaterial({
  color: '#6f6a5f',
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
})

export const ringLineMaterial = new THREE.LineBasicMaterial({
  color: '#5c574d',
  transparent: true,
  opacity: 0.15,
  depthWrite: false,
})

export const measureLineMaterial = new THREE.LineBasicMaterial({
  color: '#6b6455',
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
})

export const emphasisLineMaterial = new THREE.LineBasicMaterial({
  color: '#c58a55',
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})
