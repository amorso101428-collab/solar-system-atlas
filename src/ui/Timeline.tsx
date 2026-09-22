import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OBJECTS, FIRST_LAUNCH_YEAR, CURRENT_YEAR } from '../data/objects'
import { useAtlasStore } from '../state/atlasStore'
import { useT } from '../i18n'
import { yearOf } from '../utils/formatters'
import { setTimeScale } from '../utils/clock'
import { audio } from '../audio/audioManager'
import { useDeviceClass } from '../responsive/useDevice'
import { DrawerMotion } from '../motion/DrawerMotion'
import { attachTimelineGesture } from '../gesture/TimelineGesture'
import { pushTimelineTarget } from '../state/timelineTime'

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
  const timelineExpanded = useAtlasStore((state) => state.timelineExpanded)
  const device = useDeviceClass()
  /**
   * 时间轴抽屉只在**手机**上启用（V1.1 §2：collapsed 约 72px）。
   * iPad 继续用 V1 那套紧凑时间线，桌面完全不变。
   */
  const timelineDrawer = device === 'mobile'
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const panelRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<DrawerMotion | null>(null)
  const drawerMetricsRef = useRef({ collapsed: 72, expanded: 320 })

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
    (clientX: number, throttle = false) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      // 拖动时间轴时的极轻 tick（v6 §7）：audioManager 内部按 60ms 节流，
      // 绝不是每一帧一声。
      audio.emit('timeline.tick')
      const year = FIRST_LAUNCH_YEAR + ratio * SPAN
      /**
       * V1.1 §6：手指拖动期间，**场景用的连续值**直接写进 timelineTime，
       * store 里的年份（UI 文字 / 统计）按 50ms 节流同步。
       * 桌面鼠标拖动走 else 分支，与 V1 完全一致。
       */
      if (throttle) {
        const publish = pushTimelineTarget(year, false)
        if (publish !== null) useAtlasStore.getState().syncTimelineYear(publish)
        return
      }
      setTimelineYear(year)
    },
    [setTimelineYear]
  )

  /**
   * ------------------------- 触摸惯性（V1 §22） -------------------------
   *
   * 手指划一下、抬起来之后，时间线要自己滑一段再停下，而不是"一格一格地跳"。
   *
   *   finger drag → release → inertia → decelerate → settle
   *
   * 惯性只接**手指**：鼠标拖动在桌面上仍然一抬手就停（桌面零变化）。
   */
  const flingRef = useRef({ x: 0, time: 0, velocity: 0, touch: false })
  const inertiaRef = useRef<number | null>(null)

  const stopInertia = useCallback(() => {
    if (inertiaRef.current !== null) {
      cancelAnimationFrame(inertiaRef.current)
      inertiaRef.current = null
    }
  }, [])

  useEffect(() => stopInertia, [stopInertia])

  const startInertia = useCallback(() => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    /** 速度单位：年 / 毫秒（和拖动同一条坐标换算） */
    let velocity = flingRef.current.velocity
    if (Math.abs(velocity) < 0.0006) return
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(now - last, 40)
      last = now
      const next = useAtlasStore.getState().timelineYear + velocity * dt
      const clamped = Math.min(CURRENT_YEAR, Math.max(FIRST_LAUNCH_YEAR, next))
      /** 连续值立刻生效（场景），UI 文字节流同步（§6） */
      const publish = pushTimelineTarget(clamped, false)
      if (publish !== null) useAtlasStore.getState().syncTimelineYear(publish)
      // 摩擦：每毫秒衰减 0.3%，约 0.6s 收住（spring 的观感交给 clocks 的阻尼追赶）
      velocity *= Math.pow(0.997, dt)
      if (Math.abs(velocity) < 0.0006 || clamped !== next) {
        inertiaRef.current = null
        useAtlasStore.getState().syncTimelineYear(clamped)
        audio.emit('timeline.commit')
        return
      }
      inertiaRef.current = requestAnimationFrame(step)
    }
    inertiaRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) return
      updateFromClientX(event.clientX, flingRef.current.touch)
      const now = performance.now()
      const dt = Math.max(now - flingRef.current.time, 1)
      const rect = trackRef.current?.getBoundingClientRect()
      if (rect) {
        const deltaYears = ((event.clientX - flingRef.current.x) / rect.width) * SPAN
        // 只保留"最新一帧"的速度，去掉前面几帧的噪声
        flingRef.current.velocity = flingRef.current.velocity * 0.6 + (deltaYears / dt) * 0.4
      }
      flingRef.current.x = event.clientX
      flingRef.current.time = now
    }
    const onUp = (event: PointerEvent) => {
      const wasDragging = draggingRef.current
      draggingRef.current = false
      // 手指划出去的惯性（鼠标不参与，桌面行为不变）
      if (wasDragging && flingRef.current.touch && event.pointerType !== 'mouse') {
        startInertia()
        return
      }
      // 松手一记"确认音"（v7 §14）：拖动过程只有低频 tick，不能 100 次拖动 100 个声音
      audio.emit('timeline.commit')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [startInertia, updateFromClientX])

  /**
   * ------------------- 两态抽屉 + 弹簧吸附（V1.1 §2 / §3 / §4） -------------------
   *
   *   手指竖向拖 → 抽屉跟手（连续位置）
   *   松手       → 速度 + 位置决定吸附到 collapsed / expanded
   *   横向拖      → 不参与，仍然交给轨道去拖年份
   *
   * 位置写在 `--tl-y` 上（transform），面板高度固定为 expanded，
   * 于是拖动只碰合成层。桌面端整段不执行。
   */
  useEffect(() => {
    if (!timelineDrawer) return
    const element = panelRef.current
    if (!element) return

    const readMetrics = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const safeBottom =
        Number.parseFloat(getComputedStyle(element).getPropertyValue('--safe-bottom')) || 0
      // §3：collapsed = 72 + 安全区；expanded = clamp(0.46vh, 320, 520)
      const collapsed = 72 + safeBottom
      const desired = Math.min(Math.max(viewportHeight * 0.46, 320), 520)
      // 短屏（横屏手机）不能让抽屉比视口还高，至少给场景留 140px
      const expanded = Math.max(collapsed + 40, Math.min(desired, viewportHeight - 140))
      return { collapsed, expanded }
    }

    const metrics = readMetrics()
    drawerMetricsRef.current = metrics
    const motion = new DrawerMotion({
      position: metrics.collapsed,
      onFrame: (position) => {
        element.style.setProperty('--tl-y', `${(metrics.expanded - position).toFixed(1)}px`)
      },
      onSettle: (position) => {
        const expanded = position > (metrics.collapsed + metrics.expanded) / 2
        if (expanded !== useAtlasStore.getState().timelineExpanded) {
          useAtlasStore.getState().setTimelineExpanded(expanded)
        }
      },
    })
    drawerRef.current = motion
    element.style.setProperty('--tl-h', `${metrics.expanded}px`)
    motion.jumpTo(metrics.collapsed)

    const detachGesture = attachTimelineGesture({
      element,
      motion,
      snaps: () => [metrics.collapsed, metrics.expanded],
      softMin: metrics.collapsed,
      softMax: metrics.expanded,
      onDragStart: () => {
        element.dataset.dragging = 'yes'
      },
      onDragEnd: () => {
        delete element.dataset.dragging
      },
    })

    const onResize = () => {
      const next = readMetrics()
      metrics.collapsed = next.collapsed
      metrics.expanded = next.expanded
      drawerMetricsRef.current = metrics
      element.style.setProperty('--tl-h', `${metrics.expanded}px`)
      motion.setPosition(Math.min(Math.max(motion.position, metrics.collapsed), metrics.expanded))
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.visualViewport?.addEventListener('resize', onResize, { passive: true })

    return () => {
      detachGesture()
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      motion.dispose()
      drawerRef.current = null
    }
  }, [timelineDrawer])

  /** 点击把手：collapsed ⇄ expanded（§2 的两个状态） */
  const toggleDrawer = useCallback(() => {
    const motion = drawerRef.current
    if (!motion) return
    const { collapsed, expanded } = drawerMetricsRef.current
    const open = motion.position > (collapsed + expanded) / 2
    motion.animateTo(open ? collapsed : expanded)
    audio.emit(open ? 'menu.close' : 'menu.open')
  }, [])

  /** 程序化控制（菜单、自检、深链）：store 变了就用同一条弹簧追过去 */
  useEffect(() => {
    const motion = drawerRef.current
    if (!motion || motion.holding) return
    const { collapsed, expanded } = drawerMetricsRef.current
    const target = timelineExpanded ? expanded : collapsed
    if (Math.abs(target - motion.position) < 1 && !motion.moving) return
    motion.animateTo(target)
  }, [timelineExpanded])

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

  /**
   * 抽屉展开后的事件清单（§2）：
   * 按"到此刻为止已经发生的重要事件"倒序取 8 条，点击直接聚焦到那个对象。
   */
  const drawerEvents = timelineDrawer
    ? events
        .filter((event) => event.year <= timelineYear)
        .sort((a, b) => b.year - a.year)
        .slice(0, 8)
    : []

  return (
    <section
      className="timeline"
      data-era={era}
      ref={panelRef}
      data-open={timelineExpanded ? 'yes' : 'no'}
    >
      {timelineDrawer ? (
        <div className="timeline__grab">
          <button
            type="button"
            aria-label={t('timeline.showing')}
            aria-expanded={timelineExpanded}
            onClick={toggleDrawer}
          >
            <i />
          </button>
        </div>
      ) : null}
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
          stopInertia()
          draggingRef.current = true
          flingRef.current = {
            x: event.clientX,
            time: performance.now(),
            velocity: 0,
            touch: event.pointerType !== 'mouse',
          }
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

      {timelineDrawer ? (
        <div className="timeline__drawer">
          <div className="timeline__drawer-head">
            <span>TIME / {Math.floor(timelineYear)}</span>
            <span>
              {drawerEvents.length} {t('timeline.events')}
            </span>
          </div>
          <ul className="timeline__drawer-list">
            {drawerEvents.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => {
                    audio.emit('object.focus')
                    select(event.id)
                  }}
                >
                  <b>{event.year}</b>
                  <span>{event.title.split(' · ')[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

    </section>
  )
}
