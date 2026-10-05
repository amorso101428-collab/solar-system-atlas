/** Drag velocity is sampled over time; release integrates exponential friction.
 * Units are radians and seconds. The same model serves both globe renderers. */
export class AngularMomentum {
  private samples: {from:number; to:number; x:number; y:number}[] = []
  private last = 0
  private velocity = {x:0, y:0}
  readonly friction = 1 / 0.62
  begin(now:number) { this.reset(); this.last = now }
  reset() { this.samples = []; this.velocity = {x:0,y:0}; this.last = 0 }
  sample(x:number, y:number, now:number) {
    if (!Number.isFinite(x+y+now) || now <= this.last) return
    this.samples.push({from:this.last, to:now, x,y})
    this.last = now
    this.samples = this.samples.filter(s => s.to > now - .09)
  }
  release(now:number, reducedMotion=false) {
    this.velocity = {x:0,y:0}
    if (reducedMotion || now-this.last > .1 || !this.samples.length) { this.samples=[]; return }
    let x=0,y=0,time=0
    for (const s of this.samples) {
      const duration=s.to-s.from, overlap=s.to-Math.max(s.from,now-.09)
      if (overlap <= 0) continue
      x+=s.x*overlap/duration; y+=s.y*overlap/duration; time+=overlap
    }
    this.samples=[]
    if (time <= 0) return
    x/=time; y/=time
    const speed=Math.hypot(x,y)
    // Slow positioning must stay still. Limit the throw of a very fast flick.
    if (speed < .045) return
    // A damped hand-off loses some energy at release, keeping the coast modest.
    const scale=Math.min(1,.55/speed)*.55
    this.velocity={x:x*scale,y:y*scale}
  }
  get active() { return Math.hypot(this.velocity.x,this.velocity.y) > .001 }
  step(seconds:number) {
    if (!this.active || !Number.isFinite(seconds) || seconds <= 0) return {x:0,y:0}
    // Long frame gaps (background tabs) end a gesture instead of jumping ahead.
    if (seconds > .25) { this.reset(); return {x:0,y:0} }
    const decay=Math.exp(-this.friction*seconds), distance=(1-decay)/this.friction
    const delta={x:this.velocity.x*distance,y:this.velocity.y*distance}
    this.velocity.x*=decay; this.velocity.y*=decay
    if (!this.active) this.velocity={x:0,y:0}
    return delta
  }
}
