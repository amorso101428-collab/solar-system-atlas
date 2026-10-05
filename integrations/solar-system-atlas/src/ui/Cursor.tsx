import { useEffect, useRef } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import { installAtlasCursor } from '../../../../src/lib/atlasCursor'

/** The same cursor controller and markup as the Earth layer. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  const hovering = useAtlasStore(state => !!state.hoveredId)
  useEffect(() => installAtlasCursor(ref.current), [])
  return <div className="atlas-cursor" ref={ref} data-ui="no" data-target={hovering ? 'yes' : 'no'} data-pressed="no" aria-hidden="true">
    <i className="atlas-cursor__ring"/><i className="atlas-cursor__x"/><i className="atlas-cursor__y"/><i className="atlas-cursor__dot"/>
  </div>
}
