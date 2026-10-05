import { useEffect, useState } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import { getCatalogStats } from '../scene/EarthCatalog'

/** 真实在轨目录开关：数字直接来自 CelesTrak，不是装饰。 */
export function CatalogToggle() {
  const visible = useAtlasStore((state) => state.catalogVisible)
  const toggle = useAtlasStore((state) => state.toggleCatalog)
  const [count, setCount] = useState<number | null>(getCatalogStats()?.count ?? null)

  useEffect(() => {
    if (count !== null) return
    const timer = window.setInterval(() => {
      const stats = getCatalogStats()
      if (stats) {
        setCount(stats.count)
        window.clearInterval(timer)
      }
    }, 300)
    return () => window.clearInterval(timer)
  }, [count])

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={visible}
      onClick={toggle}
      title="CelesTrak 实时在轨目录（全量）"
    >
      <i className="chip__dot" />
      ORBIT CATALOG {count !== null ? count.toLocaleString('en-US') : '—'}
    </button>
  )
}
