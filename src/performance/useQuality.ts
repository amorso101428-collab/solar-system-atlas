import { useSyncExternalStore } from 'react'
import { adaptiveQuality } from './AdaptiveQualityManager'
import { settingsForLevel, type QualitySettings } from './QualityProfile'

/** 订阅当前画质档位（只在换档时触发重渲染，不是每帧） */
export function useQualitySettings(): QualitySettings {
  const level = useSyncExternalStore(
    adaptiveQuality.subscribe,
    () => adaptiveQuality.level,
    () => adaptiveQuality.level
  )
  return settingsForLevel(level)
}
