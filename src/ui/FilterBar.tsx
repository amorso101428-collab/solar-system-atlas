import { FILTERS } from '../data/filters'
import { useAtlasStore } from '../state/atlasStore'

/** 筛选不删除对象，只改变对比与亮度（DESIGN.md §13）。 */
export function FilterBar() {
  const activeFilter = useAtlasStore((state) => state.activeFilter)
  const setFilter = useAtlasStore((state) => state.setFilter)

  return (
    <div className="filters" role="group" aria-label="filter">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          className="filters__item"
          aria-pressed={activeFilter === filter.id}
          onClick={() => setFilter(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
