import { useEffect, useMemo, useRef, useState } from 'react'
import { bootGroups, runPreload, type BootProgress } from '../utils/preload'
import { CharacterRevealText } from './CharacterRevealText'

/**
 * 未来复古·圆形天文仪器启动界面（v8 §1–§5）。
 *
 * 设计意图：1960–80 年代的航天仪器 + 模拟计算机 + 观测设备，
 * **不是**赛博朋克、不是雷达游戏 UI、不是普通 loading 转圈。
 *
 *   outer ring    极慢自转（20s）+ 72 格刻度
 *   middle ring   分段刻度 + 反向自转（7s）
 *   inner ring    进度弧 + 2s 一圈的扫描线
 *   圆心          字符解码出来的系统读数
 *
 * 加载完成之后圆盘向外扩张、淡出——它就是后面太阳系轨道的"视觉种子"，
 * 而它背后那一帧**已经是**真实位置的太阳系俯视图（详见 CameraRig 的 topShot）。
 */
const MIN_HOLD_MS = 1200
const MERGE_MS = 980

const EMPTY: BootProgress = {
  ratio: 0,
  groupIndex: 1,
  groupCount: 3,
  groupLabel: 'EPHEMERIS',
  groupLabelCn: '星历与轨道',
  index: 0,
  total: 1,
  current: '',
}

const OUTER_TICKS = 72
const MIDDLE_TICKS = 24
const INNER_RADIUS = 128

export function BootScreen({ onDone, hold = false }: { onDone: () => void; hold?: boolean }) {
  const [progress, setProgress] = useState<BootProgress>(EMPTY)
  const [phase, setPhase] = useState<'loading' | 'merging'>('loading')
  const doneRef = useRef(false)
  const groups = useMemo(() => bootGroups(), [])

  useEffect(() => {
    const signal = { stopped: false }
    const startedAt = performance.now()
    const timers: number[] = []

    void runPreload(setProgress, signal).then(async () => {
      if (signal.stopped || doneRef.current) return
      const elapsed = performance.now() - startedAt
      if (elapsed < MIN_HOLD_MS) {
        await new Promise((resolve) => timers.push(window.setTimeout(resolve, MIN_HOLD_MS - elapsed)))
      }
      if (signal.stopped || doneRef.current) return
      doneRef.current = true
      if (hold) return
      setPhase('merging')
      timers.push(window.setTimeout(onDone, MERGE_MS))
    })

    return () => {
      signal.stopped = true
      timers.forEach(window.clearTimeout)
    }
  }, [hold, onDone])

  const ratio = progress.ratio
  const percent = Math.round(ratio * 100)
  const circumference = 2 * Math.PI * INNER_RADIUS

  return (
    <div className="boot" data-phase={phase}>
      <div className="boot__scrim" />

      <div className="boot__disc">
        <svg viewBox="-200 -200 400 400" aria-hidden>
          {/* 外环：72 格刻度，20 秒一圈 */}
          <g className="boot__ring boot__ring--outer">
            <circle r="188" className="boot__stroke" />
            <circle r="172" className="boot__stroke boot__stroke--dim" />
            {Array.from({ length: OUTER_TICKS }).map((_, index) => {
              const angle = (index / OUTER_TICKS) * Math.PI * 2
              const inner = index % 6 === 0 ? 158 : 166
              return (
                <line
                  key={index}
                  x1={Math.sin(angle) * inner}
                  y1={-Math.cos(angle) * inner}
                  x2={Math.sin(angle) * 171}
                  y2={-Math.cos(angle) * 171}
                  className={index % 6 === 0 ? 'boot__tick boot__tick--major' : 'boot__tick'}
                />
              )
            })}
          </g>

          {/* 中环：反向自转的细分刻度 */}
          <g className="boot__ring boot__ring--middle">
            <circle r="150" className="boot__stroke boot__stroke--dim" />
            {Array.from({ length: MIDDLE_TICKS }).map((_, index) => {
              const angle = (index / MIDDLE_TICKS) * Math.PI * 2
              return (
                <line
                  key={index}
                  x1={Math.sin(angle) * 142}
                  y1={-Math.cos(angle) * 142}
                  x2={Math.sin(angle) * 150}
                  y2={-Math.cos(angle) * 150}
                  className="boot__tick"
                />
              )
            })}
          </g>

          {/* 内环：进度弧 + 2 秒一圈的扫描线 */}
          <g className="boot__ring boot__ring--inner">
            <circle r={INNER_RADIUS} className="boot__stroke boot__stroke--dim" />
            <circle
              r={INNER_RADIUS}
              className="boot__progress"
              strokeDasharray={`${(circumference * ratio).toFixed(2)} ${circumference.toFixed(2)}`}
              transform="rotate(-90)"
            />
            <g className="boot__scan">
              <line x1="0" y1={-INNER_RADIUS} x2="0" y2={-INNER_RADIUS + 46} />
            </g>
            <line className="boot__crosshair" x1="-6" y1="0" x2="6" y2="0" />
            <line className="boot__crosshair" x1="0" y1="-6" x2="0" y2="6" />
          </g>
        </svg>

        <div className="boot__core">
          <CharacterRevealText
            key={progress.groupLabel}
            text={progress.groupLabel}
            startAt={0.06}
            stagger={0.03}
            charDuration={0.24}
            sound={false}
          />
          <div className="boot__percent">{String(percent).padStart(3, '0')}%</div>
          <div className="boot__stage-cn">{progress.groupLabelCn}</div>
        </div>
      </div>

      <ul className="boot__stages">
        {groups.map((group, index) => {
          const state =
            progress.groupIndex > index + 1
              ? 'done'
              : progress.groupIndex === index + 1
                ? ratio >= 1
                  ? 'done'
                  : 'active'
                : 'pending'
          return (
            <li key={group.id} data-state={state}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{group.label}</span>
              <em>{group.labelCn}</em>
            </li>
          )
        })}
      </ul>

      <div className="boot__readout">
        <span>EPOCH 2026-09-21 · HELIOCENTRIC</span>
        <span>{progress.current.replace(/^\//, '').slice(0, 42) || 'STANDBY'}</span>
        <span>
          {progress.index}/{progress.total} · {progress.groupIndex}/{progress.groupCount}
        </span>
      </div>
    </div>
  )
}
