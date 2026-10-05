/** Navigation must not depend on a WebGL flight or a delayed callback. */
export function oceanEntry(language: 'zh' | 'en', arrival = { lon: 28, lat: -8 }) {
  const lon = Number.isFinite(arrival.lon) ? ((arrival.lon + 180) % 360 + 360) % 360 - 180 : 28
  const lat = Number.isFinite(arrival.lat) ? Math.max(-90, Math.min(90, arrival.lat)) : -8
  return '/?' + new URLSearchParams({ view: 'globe', from: 'solar', handoff: '1', lang: language,
    lon: lon.toFixed(3), lat: lat.toFixed(3) })
}

/** Explicit assignment also works in embedded browsers that handle anchor
 * activation themselves. Optional visit state can never cancel navigation. */
export function navigateOcean(language: 'zh' | 'en', arrival: { lon: number; lat: number },
  prepare: () => void, navigate: (url: string) => void) {
  try { prepare() } catch {}
  navigate(oceanEntry(language, arrival))
}
