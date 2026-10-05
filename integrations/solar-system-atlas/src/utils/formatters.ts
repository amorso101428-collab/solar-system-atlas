const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** 1977-09-05 → 05 SEP 1977，档案面板用 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  const monthLabel = MONTHS[Number(month) - 1] ?? month
  return `${day} ${monthLabel} ${year}`
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

/** 任务年龄：从发射到给定年份 */
export function missionYears(iso: string, currentYear = 2026): number {
  return Math.max(0, currentYear - yearOf(iso))
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 距离从 0 到 1 的归一化（用于标尺），采用对数压缩避免深空把内侧压扁 */
export function distanceRatio(au: number): number {
  const min = Math.log10(1)
  const max = Math.log10(180)
  return Math.min(1, Math.max(0, (Math.log10(Math.max(au, 1)) - min) / (max - min)))
}

export function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'var(--node)'
    case 'EXTENDED':
      return 'var(--accent-yellow)'
    case 'COMPLETED':
      return 'var(--ink-muted)'
    case 'DECAYED':
    case 'LOST':
    case 'IMPACTED':
      return 'var(--ink-faint)'
    default:
      return 'var(--ink-dim)'
  }
}
