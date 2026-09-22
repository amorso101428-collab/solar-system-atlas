import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/audioManager'

/**
 * 字符解码（方案书 §1.2）。
 *
 * 不是 fade-in：每个字符先被随机符号占位，再一个个锁定成最终字形；
 * 锁定之后不再闪烁。节奏短、频率高、结束干净——不做 Matrix 瀑布。
 */

const DEFAULT_SCRAMBLE = '█▓▒░#%&*+=<>/\\0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

interface Props {
  text: string
  className?: string
  /** 第一个字符开始解码的时刻（秒） */
  startAt?: number
  /** 每相邻两个字符之间的间隔（秒） */
  stagger?: number
  /** 单个字符从随机到锁定的时长（秒） */
  charDuration?: number
  scrambleChars?: string
  /** 每帧随机字符的刷新间隔（毫秒） */
  tick?: number
  /** 字符锁定时的轻微电子声（v6 §7：字符跳动也是音效事件） */
  sound?: boolean
}

export function CharacterRevealText({
  text,
  className,
  startAt = 0,
  stagger = 0.032,
  charDuration = 0.26,
  scrambleChars = DEFAULT_SCRAMBLE,
  tick = 34,
  sound = true,
}: Props) {
  const [display, setDisplay] = useState<string[]>(() => text.split(''))
  const displayRef = useRef<string[]>(display)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)

  useEffect(() => {
    const chars = text.split('')
    setDisplay(chars.map((char) => (char === ' ' ? ' ' : scrambleChars[0] ?? char)))
    startRef.current = null

    // 用 performance.now() 而不是 rAF 的时间戳：某些环境（无头浏览器、虚拟时间、
    // 后台标签页）里 rAF 时间戳会停住，字符就会永远卡在半解码的样子。
    const step = () => {
      const now = performance.now()
      if (startRef.current === null) {
        startRef.current = now
        lastTickRef.current = now
      }
      const elapsed = (now - startRef.current) / 1000 + startAt
      const shouldTick = now - lastTickRef.current >= tick
      if (shouldTick) lastTickRef.current = now

      let done = true
      let locked = 0
      const next = chars.map((char, index) => {
        if (char === ' ') return ' '
        const resolveAt = startAt + index * stagger + charDuration
        if (elapsed >= resolveAt) {
          if (displayRef.current[index] !== char) locked++
          return char
        }
        done = false
        if (elapsed < startAt + index * stagger) return ' '
        if (shouldTick) {
          return scrambleChars[Math.floor(Math.random() * scrambleChars.length)] ?? char
        }
        return displayRef.current[index] ?? char
      })

      setDisplay(next)
      displayRef.current = next
      // 字符锁定那一刻给一记极轻的电子音（audioManager 内部按 50ms 节流）
      if (sound && locked > 0) audio.emit('text.tick')
      if (!done) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    // 兜底：动画总时长走完之后无条件落到最终文本。
    // 保证标题最终一定是清晰的，不会被任何调度问题留在"模糊/乱码"状态。
    const total = (startAt + (chars.length - 1) * stagger + charDuration + 0.12) * 1000
    const settle = window.setTimeout(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setDisplay(chars)
      displayRef.current = chars
    }, total)

    return () => {
      window.clearTimeout(settle)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [text, startAt, stagger, charDuration, scrambleChars, tick, sound])

  return (
    <span className={className} aria-label={text}>
      {display.map((char, index) => (
        <span
          key={index}
          /**
           * 空格必须单独标记（v7 §16）：`.intro__title span` 是 inline-block，
           * 而**纯空白的 inline-block 会被折叠成 0 宽**——"HUMAN ARTIFACTS"
           * 于是读成一个词。CSS 里给 .is-space 一个固定的词间距。
           */
          className={`decode-char${char === text[index] ? ' is-final' : ''}${
            char === ' ' ? ' is-space' : ''
          }`}
          aria-hidden="true"
        >
          {char}
        </span>
      ))}
    </span>
  )
}
