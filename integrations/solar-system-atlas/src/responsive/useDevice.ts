import { useSyncExternalStore } from 'react'
import {
  deviceClassOf,
  getLayoutMode,
  type DeviceClass,
  type LayoutMode,
  subscribeLayoutMode,
  usesVerticalDetail,
} from './device'

/** 当前布局模式（§02）。桌面端恒为 'desktop'。 */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribeLayoutMode, getLayoutMode, getLayoutMode)
}

export function useDeviceClass(): DeviceClass {
  return deviceClassOf(useLayoutMode())
}

export function useVerticalDetail(): boolean {
  return usesVerticalDetail(useLayoutMode())
}
