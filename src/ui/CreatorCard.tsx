import { useAtlasStore } from '../state/atlasStore'

/**
 * 作者署名（v9 §8 / §34）。
 *
 * 目的很直接：把作品和作者身份绑定在一起，别人搬走项目也会带着这段信息。
 * 两处使用：
 *   · 主页标题下方的一行版权署名（不抢主视觉）；
 *   · 图谱右上角"作者"入口展开的完整面板（三个平台 + 首发说明）。
 */
export const CREATOR = {
  /** 署名（v9.1）：版权行用 ESSELANO，各平台账号见 links */
  name: 'ESSELANO',
  alias: '氕氘氚',
  firstRelease: '小红书',
  links: [
    {
      id: 'xiaohongshu',
      label: '小红书',
      handle: '@氕氘氚',
      url: 'https://xhslink.cn/o/fskerDlA06',
      note: '作品首发',
    },
    {
      id: 'bilibili',
      label: '哔哩哔哩',
      handle: '氕氘氚_ESSELANO',
      url: 'https://b23.tv/x0VaefT',
      note: '视频版',
    },
    {
      id: 'douyin',
      label: '抖音',
      handle: '氕氘氚',
      url: 'https://www.douyin.com/search/53390931982',
      note: 'id 53390931982',
    },
  ],
} as const

/** 主页那一行 */
export function CreatorLine() {
  return (
    <div className="creatorline">
      <span>© 2026 {CREATOR.name}</span>
      {/* v9.1：三个平台全部可点击跳转（小红书是作品首发地） */}
      {CREATOR.links.map((link) => (
        <span className="creatorline__item" key={link.id}>
          <span className="creatorline__sep">·</span>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={`${link.label} ${link.handle}${link.note ? ` · ${link.note}` : ''}`}
          >
            {link.label}
          </a>
        </span>
      ))}
    </div>
  )
}

/** 图谱里展开的完整面板 */
export function CreatorPanel() {
  const open = useAtlasStore((state) => state.creatorOpen)
  const toggle = useAtlasStore((state) => state.toggleCreator)
  if (!open) return null

  return (
    <div className="creatorpanel">
      <div className="creatorpanel__head">
        <b>ABOUT · 关于作者</b>
        <button type="button" onClick={() => toggle(false)}>
          关闭 ✕
        </button>
      </div>
      <p className="creatorpanel__name">{CREATOR.name}</p>
      <p className="creatorpanel__note">
        本站为个人创作的天文科普可视化作品（{CREATOR.alias} / {CREATOR.name}），
        {CREATOR.firstRelease}首发。转载、引用请注明作者与出处。
      </p>
      <ul className="creatorpanel__links">
        {CREATOR.links.map((link) => (
          <li key={link.id}>
            <a href={link.url} target="_blank" rel="noreferrer">
              <b>{link.label}</b>
              <span>{link.handle}</span>
              <em>{link.note}</em>
            </a>
          </li>
        ))}
      </ul>
      <p className="creatorpanel__foot">© 2026 {CREATOR.name} · All rights reserved</p>
    </div>
  )
}
