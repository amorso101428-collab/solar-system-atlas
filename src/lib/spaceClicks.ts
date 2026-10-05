/** Slow double-click/tap: space is a dismissal target on the first press. */
export function createSpaceClicks(interval = 750, tolerance = 24) {
  let previous: {time:number;x:number;y:number} | null = null;
  return {
    reset(){ previous = null; },
    click(time:number, x:number, y:number): 'close' | 'open' {
      const match = previous && time >= previous.time && time - previous.time <= interval
        && Math.hypot(x - previous.x, y - previous.y) <= tolerance;
      previous = match ? null : {time,x,y};
      return match ? 'open' : 'close';
    },
  };
}
