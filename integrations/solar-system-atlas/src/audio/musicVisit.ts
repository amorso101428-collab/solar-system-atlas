/** Each new visit/refresh starts enabled. An internal universe↔Earth hand-off
 * carries the current choice exactly once so navigation cannot unmute it. */
const KEY='atlas.music.handoff'
export function initialMusicEnabled():boolean {
  try {
    const raw=sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    const saved=raw?JSON.parse(raw):null
    return saved && typeof saved.enabled==='boolean' && Date.now()-saved.at>=0 && Date.now()-saved.at<10000 ? saved.enabled : true
  } catch { return true }
}
export function carryMusicChoice(enabled:boolean):void {
  try { sessionStorage.setItem(KEY,JSON.stringify({enabled,at:Date.now()})) } catch {}
}
