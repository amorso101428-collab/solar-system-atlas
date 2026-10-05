export function isEarthLink(search: string) {
  const p = new URLSearchParams(search);
  return ['globe', 'map', 'depth'].includes((p.get('view') || '').toLowerCase()) ||
    p.get('intro') === '0' || p.get('from') === 'solar' ||
    ['sel', 'lesson', 'mode'].some(key => p.has(key));
}
export function solarEntry(search: string) { return '/solar/' + (search || ''); }
