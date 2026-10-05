// Exaggerated display shell; fade away before regional/surface exploration.
export const CLOUD_DISPLAY_HEIGHT=45000;
export function cloudVisibility(eyeHeight:number) {
  if(!Number.isFinite(eyeHeight))return 0;
  const f=Math.max(0,Math.min(1,(eyeHeight-350000)/1650000));
  return f*f*(3-2*f);
}
