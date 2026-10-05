import { useEffect, useRef } from 'react';
import { installAtlasCursor } from '../lib/atlasCursor';
import { useAtlas } from '../state/store';
export function AtlasCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const hovering = useAtlas(s => !!s.hover), reduced = useAtlas(s => s.reducedMotion);
  useEffect(() => installAtlasCursor(ref.current, reduced), [reduced]);
  return <div className="atlas-cursor" ref={ref} data-ui="no" data-target={hovering ? 'yes' : 'no'} data-pressed="no" aria-hidden="true">
    <i className="atlas-cursor__ring"/><i className="atlas-cursor__x"/><i className="atlas-cursor__y"/><i className="atlas-cursor__dot"/>
  </div>;
}
