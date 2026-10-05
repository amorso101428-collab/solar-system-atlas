// Radius 1 = 6371 km. Minimum altitude ~5.1 km remains outside data shells.
export const MIN_CAMERA_DISTANCE=1.0008;
export const MAX_CAMERA_DISTANCE=9;
export function clampCameraDistance(distance:number){return Math.max(MIN_CAMERA_DISTANCE,Math.min(MAX_CAMERA_DISTANCE,Number.isFinite(distance)?distance:4));}
