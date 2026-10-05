type Particle = { x:number; y:number; vx:number; vy:number; life:number; age:number; radius:number; hue:number; phase:number }
/** Original solar emitter, shared without importing a second React runtime. */
export function installUIParticles(node:HTMLCanvasElement|null,disabled=false){
  const ctx = node?.getContext('2d')
  if (!node || !ctx || disabled) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let particles: Particle[] = [], frame = 0, last = 0, lastHover = 0
  const resize = () => { const dpr = Math.min(devicePixelRatio, 2); node.width = innerWidth*dpr; node.height = innerHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0) }
  const draw = (now:number) => {
    frame = 0
    const dt = Math.min((now-last)/1000, .035); last = now
    ctx.clearRect(0,0,innerWidth,innerHeight)
    particles = particles.filter(p => p.age < p.life)
    for (const p of particles) {
    p.age += dt; p.vx *= Math.exp(-dt*.6); p.vy -= dt*4
    p.x += (p.vx + Math.sin(p.phase+p.age*3)*5)*dt; p.y += p.vy*dt
    const alpha = Math.sin(Math.PI*Math.min(p.age/p.life,1))*.72
    ctx.fillStyle = `hsla(${p.hue},45%,78%,${alpha})`
    ctx.shadowColor = `hsla(${p.hue},55%,72%,${alpha*.65})`; ctx.shadowBlur = 5
    ctx.beginPath(); ctx.arc(p.x,p.y,p.radius*(1-p.age/p.life*.45),0,Math.PI*2);ctx.fill()
    }
    if (particles.length) frame = requestAnimationFrame(draw)
  }
  const emit = (x:number,y:number,count:number,spread=8) => {
    if (reduced.matches || document.hidden || document.querySelector('.atlas[data-immersive="true"]')) return
    for (let i=0;i<count;i++) { const a=Math.random()*Math.PI*2, speed=10+Math.random()*37
    particles.push({ x:x+(Math.random()-.5)*spread, y:y+(Math.random()-.5)*spread,
      vx:Math.cos(a)*speed, vy:Math.sin(a)*speed-8, age:0,life:.55+Math.random()*1.1,
      radius:.55+Math.random()*.9,hue:Math.random()<.78?35+Math.random()*12:190+Math.random()*30,phase:Math.random()*6.28 }) }
    if(particles.length>160)particles.splice(0,particles.length-160)
    if(!frame){last=performance.now();frame=requestAnimationFrame(draw)}
  }
  const selector='.ui-layer button,.ui-layer summary,.ui-layer label,a'
  const interaction = (event:Event) => {
    const target = (event.target as Element)?.closest<HTMLElement>(selector)
    if (!target || target.closest('.intro')) return
    const box=target.getBoundingClientRect(), pointer=event as PointerEvent
    if(event.type==='pointerover'){if(target.contains(pointer.relatedTarget as Node) || performance.now()-lastHover<100)return;lastHover=performance.now()}
    emit(pointer.clientX || box.left+box.width/2,pointer.clientY || box.top+box.height/2,event.type==='click'?30:10)
  }
  const open = (event:AnimationEvent) => {
    const target=event.target as Element
    if(!target.matches('.archive,.navmenu,.catalogpanel,.workspace-panel,.nav-menu,.earth-search-results'))return
    const box=target.getBoundingClientRect()
    for(let i=0;i<5;i++)emit(box.left+box.width*(i+.5)/5,box.top+8,6,16)
  }
  const clear = () => { if(document.hidden || reduced.matches){particles=[];cancelAnimationFrame(frame);frame=0;ctx.clearRect(0,0,innerWidth,innerHeight)} }
  resize(); window.addEventListener('resize',resize)
  document.addEventListener('pointerover',interaction); document.addEventListener('click',interaction);document.addEventListener('focusin',interaction)
  document.addEventListener('animationstart',open);document.addEventListener('visibilitychange',clear);reduced.addEventListener('change',clear)
  return () => {cancelAnimationFrame(frame);ctx.clearRect(0,0,innerWidth,innerHeight);window.removeEventListener('resize',resize);document.removeEventListener('pointerover',interaction);document.removeEventListener('click',interaction);document.removeEventListener('focusin',interaction);document.removeEventListener('animationstart',open);document.removeEventListener('visibilitychange',clear);reduced.removeEventListener('change',clear)}
}
