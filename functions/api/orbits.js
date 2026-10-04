export async function onRequestGet() {
  try {
    const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON', { cf: { cacheTtl: 7200, cacheEverything: true }, signal: AbortSignal.timeout(12000) })
    if (!response.ok) return new Response('Orbit source unavailable', { status: 503 })
    const records = await response.json()
    if (!Array.isArray(records)) return new Response('Invalid orbit response', { status: 502 })
    return Response.json(records, { headers: { 'Cache-Control': 'public, max-age=7200', 'X-Orbit-Fetched-At': new Date().toISOString() } })
  } catch { return new Response('Orbit source unavailable', { status: 503 }) }
}
