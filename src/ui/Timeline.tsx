import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OBJECTS, FIRST_LAUNCH_YEAR, CURRENT_YEAR } from '../data/objects'
import { useAtlasStore } from '../state/atlasStore'
import { useT } from '../i18n'
import { yearOf } from '../utils/formatters'
import { setTimeScale } from '../utils/clock'
import { audio } from '../audio/audioManager'

const SPAN = CURRENT_YEAR - FIRST_LAUNCH_YEAR

interface Span {
  id: string
  name: string
  nameCn: string
  start: number
  end: number
  row: number
}

interface EventDot {
  id: string
  year: number
  importance: number
  row: number
  title: string
}

/**
 * 时间轴（方案书 §16 / §17）。
 *
 * 不是"一条只剩下年份和圆点的线"，而是四层结构叠出来的时间线：
 *   1 年份标尺   连续的主轴 + 每年刻度 + 每十年标签
 *   2 事件标记   按重要度分大小、分三层错开排布，避免挤成一团
 *   3 任务跨度   重要任务从发射到结束的横条
 *   4 当前时刻   贯穿整条时间线的游标
 *
 * 数据全部来自 objects.ts 的 launched / timeline 字段，不在 JSX 里写死年份。
 */

function buildTimeline() {
  const spans: Span[] = []
  const events: EventDot[] = []

  const sorted = [...OBJECTS].sort((a, b) => yearOf(a.launched) - yearOf(b.launched))
  const rowEnds: number[] = [-Infinity, -Infinity, -Infinity]

  for (const object of sorted) {
    const start = yearOf(object.launched)
    const last = object.timeline[object.timeline.length - 1]
    const lastYear = last ? yearOf(last.date) : start
    const end = object.status === 'ACTIVE' || object.status === 'EXTENDED' || object.status === 'IN TRANSIT'
      ? CURRENT_YEAR
      : Math.max(start + 1, lastYear)

    const importance = object.importance ?? 2

    if (importance === 1) {
      let row = 0
      while (row < 2 && rowEnds[row]! > start - 1) row++
      rowEnds[row] = end
      spans.push({
        id: object.id,
        name: object.name,
        nameCn: object.nameCn,
        start,
        end,
        row,
      })
    }

    if (importance <= 2) {
      // 事件点最多叠三层：同一年太挤的时候往下让
      const taken = new Set(
        events.filter((entry) => Math.abs(entry.year - start) < 0.9).map((entry) => entry.row)
      )
      let row = 0
      while (row < 3 && taken.has(row)) row++
      row = Math.min(row, 2)
      events.push({
        id: object.id,
        year: start,
        importance,
        row,
        title: `${object.name} · ${object.launched}`,
      })
    }
  }

  return { spans, events }
}

export function Timeline() {
  const t = useT()
  const timelineYear = useAtlasStore((state) => state.timelineYear)
  const setTimelineYear = useAtlasStore((state) => state.setTimelineYear)
  const select = useAtlasStore((state) => state.select)
  const playing = useAtlasStore((state) => state.playing)
  const togglePlay = useAtlasStore((state) => state.togglePlay)
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const { spans, events } = useMemo(buildTimeline, [])

  const percent = useCallback((year: number) => ((year - FIRST_LAUNCH_YEAR) / SPAN) * 100, [])

  const stats = useMemo(() => {
    let launched = 0
    let active = 0
    let deep = 0
    for (const object of OBJECTS) {
      const year = yearOf(object.launched)
      if (year > timelineYear) continue
      launched++
      const ended =
        object.status === 'DECAYED' ||
        object.status === 'IMPACTED' ||
        object.status === 'LOST' ||
        (object.status === 'COMPLETED' && object.timeline.length > 0 &&
          yearOf(object.timeline[object.timeline.length - 1]!.date) <= timelineYear)
      if (!ended) active++
      if (object.category === 'DEEP_SPACE' || object.system === 'deep') deep++
    }
    return { launched, active, deep }
  }, [timelineYear])

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      // 拖动时间轴时的极轻 tick（v6 §7）：audioManager 内部按 60ms 节流，
      // 绝不是每一帧一声。
      audio.emit('timeline.tick')
      setTimelineYear(FIRST_LAUNCH_YEAR + ratio * SPAN)
    },
    [setTimelineYear]
  )

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (draggingRef.current) updateFromClientX(event.clientX)
    }
    const onUp = () => {
      draggingRef.current = false
      // 松手一记"确认音"（v7 §14）：拖动过程只有低频 tick，不能 100 次拖动 100 个声音
      audio.emit('timeline.commit')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [updateFromClientX])

  // 回放：让整张图谱的运动速度提上去（世界时钟的倍率）
  useEffect(() => {
    setTimeScale(playing ? 3.4 : 1)
    return () => setTimeScale(1)
  }, [playing])

  // 回放时年份自己走
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const state = useAtlasStore.getState()
      const next = state.timelineYear + dt * 3.2
      state.setTimelineYear(next > CURRENT_YEAR ? FIRST_LAUNCH_YEAR : next)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const ticks: number[] = []
  for (let year = FIRST_LAUNCH_YEAR; year <= CURRENT_YEAR; year += 1) ticks.push(year)

  const era = timelineYear < 1980 ? 'early' : timelineYear < 2000 ? 'mid' : 'modern'
  const eraEvent = events
    .filter((event) => event.importance === 1 && Math.abs(event.year - timelineYear) <= 2)
    .slice(0, 3)

  return (
    <section className="timeline" data-era={era}>
      <div className="timeline__head">
        <span className="timeline__year">{timelineYear}</span>
        <span className="timeline__stat">
          {stats.launched} <i>{t('stats.objects')}</i>
        </span>
        <span className="timeline__stat">
          {stats.active} <i>{t('stats.operating')}</i>
        </span>
        <span className="timeline__stat">
          {stats.deep} <i>{t('stats.deep')}</i>
        </span>
        <button
          type="button"
          className="timeline__play"
          aria-pressed={playing}
          onClick={togglePlay}
        >
          {playing ? `■ ${t('timeline.stop')}` : `▶ ${t('timeline.play')}`}
        </button>
        <span className="timeline__hint">{t('timeline.hint')}</span>
      </div>

      <div className="timeline__annotation">
        {eraEvent.length > 0
          ? eraEvent.map((event) => (
              <span key={event.id}>
                <b>{event.year}</b>
                {event.title.split(' · ')[0]}
              </span>
            ))
          : null}
      </div>

      <div
        className="timeline__track"
        ref={trackRef}
        onPointerDown={(event) => {
          draggingRef.current = true
          updateFromClientX(event.clientX)
        }}
      >
        {/* 主轴：连续的一条线，而不是只剩刻度 */}
        <div className="timeline__axis" />

        {/* 每一年一根刻度，每十年一根长刻度 */}
        <div className="timeline__ticks">
          {ticks.map((year) => (
            <i
              key={year}
              className={`timeline__tick${year % 10 === 0 ? ' timeline__tick--major' : ''}`}
              style={{ left: `${percent(year)}%` }}
            />
          ))}
        </div>

        {/* 任务跨度条 */}
        <div className="timeline__spans">
          {spans.map((span) => (
            <i
              key={span.id}
              className="timeline__span"
              data-row={span.row}
              title={`${span.name} · ${span.start}→${span.end}`}
              style={{
                left: `${percent(span.start)}%`,
                width: `${Math.max(percent(span.end) - percent(span.start), 0.4)}%`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                select(span.id)
              }}
            />
          ))}
        </div>

        {/* 事件标记 */}
        <div className="timeline__events">
          {events.map((event) => (
            <i
              key={event.id}
              className={`timeline__dot${event.year <= timelineYear ? ' is-before' : ''}`}
              data-row={event.row}
              data-importance={event.importance}
              style={{ left: `${percent(event.year)}%` }}
              title={event.title}
              onPointerDown={(pointerEvent) => {
                pointerEvent.stopPropagation()
                select(event.id)
              }}
            />
          ))}
        </div>

        {/* 年份标签 */}
        <div className="timeline__labels">
          {ticks
            .filter((year) => year % 10 === 0)
            .map((year) => (
              <b key={year} className="timeline__tick-label" style={{ left: `${percent(year)}%` }}>
                {year}
              </b>
            ))}
        </div>

        <div className="timeline__cursor" style={{ left: `${percent(timelineYear)}%` }} />
      </div>

    </section>
  )
}
