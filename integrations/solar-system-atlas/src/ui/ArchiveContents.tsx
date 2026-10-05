import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAtlasStore } from '../state/atlasStore'
import { useDeviceClass } from '../responsive/useDevice'

type Entry = { title: string; target: HTMLElement }
export function ArchiveContents({ identity }: { identity: string }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 120, height: 400, compact: false })
  const language = useAtlasStore(s => s.language)
  const device = useDeviceClass()
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => {
    const archive = anchor.current?.closest<HTMLElement>('.archive')
    if (!archive) return
    setHost(document.querySelector('.ui-layer'))
    let headings: HTMLElement[] = []
    let frame = 0
    const measure = () => {
      const box = archive.getBoundingClientRect()
      const compact = box.left < 165
      archive.classList.toggle('archive--with-rail', compact)
      setPosition({ left: compact ? box.left + 10 : box.left - 146,
        top: Math.max(90, box.top + (compact ? 92 : 8)),
        height: Math.max(80, Math.min(box.bottom - 20, innerHeight - 94) - Math.max(90, box.top + (compact ? 92 : 8))), compact })
      let index = 0
      headings.forEach((heading, i) => { if (heading.getBoundingClientRect().top <= box.top + (device === 'mobile' ? 140 : 115)) index = i })
      setActive(index)
    }
    const scan = () => {
      headings = Array.from(archive.querySelectorAll<HTMLElement>('.archive__section > h4')).filter(h => !h.closest('.archive__full'))
      headings.forEach((h, i) => { h.id = `archive-${identity}-${i}` })
      setEntries(headings.map(target => ({ title: target.textContent?.trim() ?? '', target })))
      measure()
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    observer.observe(archive)
    const mutations = new MutationObserver(scan)
    mutations.observe(archive, { childList: true, subtree: true })
    archive.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    archive.addEventListener('animationend', schedule)
    scan()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect();
      archive.classList.remove('archive--with-rail'); archive.removeEventListener('scroll', schedule);
      archive.removeEventListener('animationend', schedule); window.removeEventListener('resize', schedule) }
  }, [identity, language, device])
  return <><span ref={anchor} hidden />{host && entries.length > 1 ? createPortal(
    <nav className="archive-rail" data-compact={position.compact} style={{ left: position.left, top: position.top, maxHeight: position.height }} aria-label={language === 'zh' ? '档案目录' : 'Archive contents'}>
      <div className="archive-rail__title">{language === 'zh' ? '目录' : 'CONTENTS'}<small>{String(entries.length).padStart(2, '0')}</small></div>
      <div className="archive-rail__list">{entries.map(({title,target}, index) => <button key={`${identity}-${index}`} type="button" aria-current={active === index ? 'location' : undefined} onClick={() => {
        const archive = target.closest<HTMLElement>('.archive')
        if (archive) archive.scrollTo({ top: archive.scrollTop + target.getBoundingClientRect().top - archive.getBoundingClientRect().top - (device === 'mobile' ? 128 : 96), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
        setActive(index)
      }}><small>{String(index + 1).padStart(2,'0')}</small><span>{title}</span></button>)}</div>
    </nav>, host) : null}</>
}
