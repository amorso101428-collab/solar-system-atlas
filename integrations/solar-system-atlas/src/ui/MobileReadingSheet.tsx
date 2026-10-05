import { useEffect } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import { useDeviceClass } from '../responsive/useDevice'
import { gestureManager } from '../gesture'

/** Mobile records have one bounded reading viewport, not a translated desktop
 * panel. Keep swipe-to-dismiss on the header without moving the contents rail
 * independently or leaving the last paragraphs underneath the bottom dock. */
export function MobileReadingSheet() {
  const device = useDeviceClass()
  const activeUi = useAtlasStore(s => s.activeUi)
  const focusId = useAtlasStore(s => s.focusId)
  useEffect(() => {
    if (device !== 'mobile' || !['detail', 'catalog'].includes(activeUi ?? '')) return
    const element = document.querySelector<HTMLElement>('.archive, .catalogpanel')
    if (!element) return
    return gestureManager.registerSheet(element, '.archive__top', {
      onDragMove: () => {},
      onDragEnd: (_state, dy) => { if (dy > 100) useAtlasStore.getState().closeUi() },
      getState: () => 'expanded',
    })
  }, [device, activeUi, focusId])
  return null
}
