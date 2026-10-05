/** One instrument cursor for both atlases; idle frames stop after settling. */
export function installAtlasCursor(element: HTMLDivElement | null, reduced = false) {
  if (!element) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let px = innerWidth / 2, py = innerHeight / 2, x = px, y = py, frame = 0;
  const draw = () => {
    frame = 0;
    const factor = reduced || motion.matches ? 1 : .34;
    x += (px - x) * factor; y += (py - y) * factor;
    element.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    if (Math.abs(px - x) + Math.abs(py - y) > .1) frame = requestAnimationFrame(draw);
  };
  const sync = () => {
    element.closest('.atlas')?.setAttribute('data-custom-cursor', fine.matches ? 'yes' : 'no');
    element.style.opacity = '0';
  };
  const move = (event: PointerEvent) => {
    if (!fine.matches || event.pointerType === 'touch') return;
    px = event.clientX; py = event.clientY; element.style.opacity = '1';
    const target = event.target instanceof Element ? event.target : null;
    element.dataset.ui = target?.closest('button,a,input,label,select,textarea,summary,[role="button"],[role="slider"],.timeline__track') ? 'yes' : 'no';
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const down = (event: PointerEvent) => { if (event.pointerType !== 'touch') element.dataset.pressed = 'yes'; };
  const up = () => { element.dataset.pressed = 'no'; };
  const leave = () => { element.style.opacity = '0'; up(); };
  const visibility = () => { if (document.hidden) { leave(); cancelAnimationFrame(frame); frame = 0; } };
  sync(); fine.addEventListener('change', sync);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up); window.addEventListener('blur', leave);
  document.addEventListener('pointerleave', leave); document.addEventListener('visibilitychange', visibility);
  return () => {
    cancelAnimationFrame(frame); fine.removeEventListener('change', sync);
    element.closest('.atlas')?.removeAttribute('data-custom-cursor');
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down);
    window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    window.removeEventListener('blur', leave); document.removeEventListener('pointerleave', leave);
    document.removeEventListener('visibilitychange', visibility);
  };
}
