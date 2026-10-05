import { PERF_MAX_DPR } from '../utils/perf'
import { deviceClassOf, getLayoutMode, type DeviceClass } from './device'

/**
 * 渲染档位（方案书 §31 / §32）。
 *
 * 桌面档位的每一个数值都**必须**等于 V1 之前的常量，这样 desktop 的
 * 画面与性能特征一模一样；降级只发生在 tablet / mobile 上。
 */
export interface RenderProfile {
  device: DeviceClass
  /** 设备像素比上限：手机 1.35 / 平板 1.6 / 桌面沿用 1.5 */
  maxDpr: number
  /** 星场数量倍率（§31：手机进一步降 particle count） */
  starScale: number
  /** 后处理 bloom 强度倍率（§31：移动端降低 postprocessing） */
  bloomScale: number
  /** 是否启用体积光 / 重型太阳特效（§34：移动端默认关闭） */
  heavyEffects: boolean
}

export const RENDER_PROFILES: Record<DeviceClass, RenderProfile> = {
  desktop: {
    device: 'desktop',
    maxDpr: PERF_MAX_DPR,
    starScale: 1,
    bloomScale: 1,
    heavyEffects: true,
  },
  tablet: {
    device: 'tablet',
    maxDpr: 1.6,
    /**
     * 真机反馈"背景像一片噪点"：星点密度要按**屏幕面积**对齐桌面的观感。
     * 桌面 13300 颗铺在 1574×760 上，约每 90px² 一颗；
     * 平板 0.55 / 手机 0.3 之后，两边的每像素密度与桌面基本一致。
     */
    starScale: 0.55,
    bloomScale: 1,
    heavyEffects: false,
  },
  mobile: {
    device: 'mobile',
    maxDpr: 1.35,
    starScale: 0.3,
    bloomScale: 1,
    heavyEffects: false,
  },
}

export function renderProfileForDevice(device: DeviceClass): RenderProfile {
  return RENDER_PROFILES[device]
}

export function currentRenderProfile(): RenderProfile {
  return RENDER_PROFILES[deviceClassOf(getLayoutMode())]
}

/**
 * 渲染像素比上限。
 *
 * §32 给的建议值是"手机 ≤1.35 / 平板 ≤1.6"，但桌面端原本的上限是 1.5——
 * 这里把桌面档位锁死在 PERF_MAX_DPR（1.5），不借用平板的 1.6，
 * 否则桌面就悄悄变清晰了，不再是零变化。
 */
export function maxDprFor(mode: string): number {
  switch (mode) {
    case 'mobile-portrait':
    case 'mobile-landscape':
      return 1.35
    case 'tablet-portrait':
    case 'tablet-landscape':
      return 1.6
    default:
      return PERF_MAX_DPR
  }
}
